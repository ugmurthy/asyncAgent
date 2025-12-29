/**
 * Handlers for DAG execution endpoints
 */
import type { FastifyInstance } from 'fastify';
import type { LLMProvider } from '@async-agent/shared';
import { generateId } from '@async-agent/shared';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { DAGExecutor, type DecomposerJob } from '../../../../agent/dagExecutor.js';
import { LlmExecuteTool } from '../../../../agent/tools/llmExecute.js';
import type { ToolRegistry } from '../../../../agent/tools/index.js';
import { createLLMProvider } from '../../../../agent/providers/index.js';
import { agents, dags, dagExecutions, subSteps } from '../../../../db/schema.js';
import { dagEventBus } from '../../../../events/bus.js';
import { validateCronExpression } from '../../../../utils/cron-validator.js';
import { 
  CreateDagInputSchema, 
  DecomposerJobSchema, 
  ExecuteDagInputSchema,
  ExecutionIdParamsSchema,
  DagExperimentsInputSchema
} from '../schemas.js';
import { extractJsonCodeBlock, truncate, truncateForLog } from '../utils.js';
import type { RouteContext } from '../types.js';

export function registerExecuteDagRoutes(
  fastify: FastifyInstance,
  context: RouteContext
) {
  const { log } = fastify;
  const db = (fastify as any).db;
  const { llmProvider, toolRegistry, dagScheduler } = context;

  /**
   * POST /create-and-execute-dag - Create a DAG and immediately execute it if successful
   */
  fastify.post('/create-and-execute-dag', async (request, reply) => {
    try {
      const body = CreateDagInputSchema.parse(request.body);
      const goalText = body['goal-text'];
      const agentName = body.agentName;
      
      const scheduleActive = body.scheduleActive ?? !!body.cronSchedule;

      if (body.cronSchedule) {
        const validation = validateCronExpression(body.cronSchedule);
        if (!validation.valid) {
          return reply.code(400).send({
            error: 'Invalid cron expression',
            details: validation.error,
          });
        }
        log.info({ 
          cronSchedule: body.cronSchedule, 
          nextRuns: validation.nextRuns 
        }, 'Valid cron schedule provided');
      }

      let activeLLMProvider: LLMProvider;
      try {
        if (body.provider && body.model) {
          log.info({ 
            requestedProvider: body.provider, 
            requestedModel: body.model 
          }, 'Creating custom LLM provider for this request');
          
          activeLLMProvider = createLLMProvider({
            provider: body.provider as 'openai' | 'openrouter' | 'ollama' | 'openrouter-fetch',
            model: body.model,
          });

          const validationResult = await activeLLMProvider.validateToolCallSupport(body.model);
          if (!validationResult.supported) {
            throw new Error(
              `Model ${body.model} does not support tool calling. ${validationResult.message || ''}`
            );
          }
        } else {
          activeLLMProvider = llmProvider;
        }
      } catch (providerError) {
        const errorMessage = providerError instanceof Error ? providerError.message : String(providerError);
        log.error({ err: errorMessage }, 'Failed to create LLM provider');
        return reply.code(400).send({
          status: 'failed',
          error: 'Invalid LLM provider configuration',
          details: errorMessage,
        });
      }

      const agent = await db.query.agents.findFirst({
        where: and(eq(agents.name, agentName), eq(agents.active, true)),
      });

      if (!agent) {
        return reply.code(404).send({
          status: 'failed',
          error: `Agent '${agentName}' not found OR not active`,
        });
      }
      
      const toolDefinitions = toolRegistry.getAllDefinitions();
      const systemPrompt = agent.promptTemplate
        .replace(/\{\{tools\}\}/g, JSON.stringify(toolDefinitions))
        .replace(/\{\{currentDate\}\}/g, new Date().toLocaleString());

      let currentGoalText = goalText;
      const showGoalText = truncateForLog(goalText);
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        log.info({ attempt, agentName, goalText: showGoalText }, 'Creating DAG with LLM inference (create-and-execute)');
        log.info({ model: (activeLLMProvider as any).model, provider: (activeLLMProvider as any).name || (activeLLMProvider as any).provider }, 'LLM Provider Configuration');
        
        const response = await activeLLMProvider.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: currentGoalText },
          ],
          temperature: body.temperature ?? 0.7,
          maxTokens: body.max_tokens ?? 10000,
          ...(body.seed !== undefined && { seed: body.seed }),
        });
        
        const MAX_RESPONSE_SIZE = 100_000;
        if (response.content.length > MAX_RESPONSE_SIZE) {
          log.error({ responseSize: response.content.length }, 'LLM response exceeds size limit');
          return reply.code(500).send({
            status: 'failed',
            error: `Response too large: ${response.content.length} bytes`,
            maxSize: MAX_RESPONSE_SIZE,
          });
        }

        let result;
        try {
          result = extractJsonCodeBlock(response.content);
        } catch (parseError) {
          log.error({ 
            err: parseError, 
            attempt,
            responsePreview: response.content.slice(0, 500) 
          }, 'Failed to parse LLM response as JSON');
          
          if (attempt >= maxAttempts) {
            return reply.code(500).send({
              status: 'failed',
              error: 'LLM response is not valid JSON after multiple attempts',
              attempts: attempt,
              responsePreview: response.content.slice(0, 500),
            });
          }
          continue;
        }
        const usage = response?.usage ?? null;
        const generation_stats = response?.generationStats ?? null;
        const validatedResult = DecomposerJobSchema.safeParse(result);
        
        if (!validatedResult.success) {
          log.error({ 
            errors: validatedResult.error.issues,
            attempt 
          }, 'DAG validation failed');
          
          if (attempt >= maxAttempts) {
            return reply.code(400).send({
              status: 'failed',
              error: 'Invalid DAG structure after multiple attempts',
              validation_errors: validatedResult.error.issues,
              attempts: attempt,
              result,
            });
          }
          continue;
        }

        const dag = validatedResult.data;

        if (dag.clarification_needed) {
          return reply.code(200).send({
            status: 'clarification_required',
            clarification_query: dag.clarification_query,
            result: dag,
            usage,
            generation_stats
          });
        }

        if (dag.validation.coverage === 'high') {
          const dagId = generateId();
          
          let dagTitle: string | null = null;
          try {
            const titleMasterAgent = await db.query.agents.findFirst({
              where: and(eq(agents.name, 'TitleMaster'), eq(agents.active, true)),
            });

            if (titleMasterAgent) {
              const llmExecuteTool = new LlmExecuteTool();
              const llmResult = await llmExecuteTool.execute({
                provider: titleMasterAgent.provider as any,
                model: titleMasterAgent.model,
                task: titleMasterAgent.promptTemplate,
                prompt: truncate(goalText),
              }, {
                logger: log,
                toolRegistry,
                db
              });
              
              dagTitle = llmResult.content;
              log.info({ dagTitle }, 'Generated DAG title from TitleMaster');
            } else {
              log.warn('TitleMaster agent not found or inactive');
            }
          } catch (titleError) {
            log.error({ err: titleError }, 'Error calling TitleMaster');
          }

          await db.insert(dags).values({
            id: dagId,
            status: 'success',
            result: dag,
            usage,
            generationStats: generation_stats,
            attempts: attempt,
            agentName,
            dagTitle,
            cronSchedule: body.cronSchedule || null,
            scheduleActive: scheduleActive,
            timezone: body.timezone,
            params: {
              goalText,
              agentName,
              provider: body.provider,
              model: body.model,
              temperature: body.temperature ?? 0.7,
              max_tokens: body.max_tokens ?? 10000,
              seed: body.seed,
            },
          });

          log.info({ 
            dagId, 
            agentName, 
            goalText: showGoalText,
            cronSchedule: body.cronSchedule,
            scheduleActive: scheduleActive 
          }, 'DAG saved to database');

          if (dagScheduler && body.cronSchedule && scheduleActive) {
            dagScheduler.registerDAGSchedule({
              id: dagId,
              cronSchedule: body.cronSchedule,
              scheduleActive: scheduleActive,
              timezone: body.timezone,
            });
            log.info({ dagId, cronSchedule: body.cronSchedule, timezone: body.timezone }, 'DAG schedule registered');
          }

          const executionId = generateId('dag-exec');
          const job = dag as DecomposerJob;
          
          log.info({ 
            executionId,
            dagId,
            primaryIntent: job.intent.primary,
            totalTasks: job.sub_tasks.length 
          }, 'Starting DAG execution (create-and-execute)');

          try {
            await db.insert(dagExecutions).values({
              id: executionId,
              dagId: dagId,
              originalRequest: goalText,
              primaryIntent: job.intent.primary,
              status: 'pending',
              totalTasks: job.sub_tasks.length,
            });

            await db.insert(subSteps).values(
              job.sub_tasks.map(task => ({
                id: generateId('sub-step'),
                executionId: executionId,
                taskId: task.id,
                description: task.description,
                thought: task.thought,
                actionType: task.action_type,
                toolOrPromptName: task.tool_or_prompt.name,
                toolOrPromptParams: task.tool_or_prompt.params || {},
                dependencies: task.dependencies,
                status: 'pending' as const,
              }))
            );

            log.info({ executionId }, 'Initial execution records created');
          } catch (dbError) {
            log.error({ err: dbError, executionId }, 'Failed to create initial execution records');
            return reply.code(500).send({
              status: 'failed',
              dagId,
              error: 'DAG created but failed to initialize execution records',
              details: dbError instanceof Error ? dbError.message : String(dbError),
            });
          }

          const dagExecutor = new DAGExecutor({
            logger: log,
            llmProvider,
            toolRegistry,
            db,
          });

          dagExecutor.execute(job, executionId, dagId, goalText).catch(async (error) => {
            log.error({ err: error, executionId }, 'DAG execution failed in background');
            
            try {
              const execution = await db.query.dagExecutions.findFirst({
                where: eq(dagExecutions.id, executionId),
              });
              
              if (execution && execution.status !== 'suspended' && execution.status !== 'failed') {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await db.update(dagExecutions)
                  .set({
                    status: 'suspended',
                    suspendedReason: errorMessage,
                    suspendedAt: new Date(),
                  })
                  .where(eq(dagExecutions.id, executionId));
                
                dagEventBus.emit('dag:event', {
                  type: 'execution.suspended',
                  executionId,
                  timestamp: Date.now(),
                  reason: errorMessage,
                });
              }
            } catch (updateError) {
              log.error({ err: updateError, executionId }, 'Failed to update execution status after error');
            }
          });

          return reply.code(202).send({
            status: 'executing',
            dagId,
            executionId,
            originalRequest: goalText,
            totalTasks: job.sub_tasks.length,
            usage,
            generation_stats,
            message: 'DAG created and execution started. Connect to SSE stream for live updates.',
          });
        }

        if (dag.validation.gaps && dag.validation.gaps.length > 0) {
          const gapsText = dag.validation.gaps.map((gap, idx) => `${idx + 1}. ${gap}`).join('\n');
          currentGoalText = `${goalText}\n\nEnsure following gaps are covered:\n${gapsText}`;
          
          log.info({ gaps: dag.validation.gaps, attempt }, 'Retrying with gaps addressed');
          continue;
        }

        const dagId = generateId();
        await db.insert(dags).values({
          id: dagId,
          status: 'success',
          result: dag,
          usage,
          generationStats: generation_stats,
          attempts: attempt,
          agentName,
          params: {
            goalText,
            agentName,
            provider: body.provider,
            model: body.model,
            temperature: body.temperature ?? 0.7,
            max_tokens: body.max_tokens ?? 10000,
            seed: body.seed,
          },
        });

        const executionId = generateId('dag-exec');
        const job = dag as DecomposerJob;

        await db.insert(dagExecutions).values({
          id: executionId,
          dagId: dagId,
          originalRequest: goalText,
          primaryIntent: job.intent.primary,
          status: 'pending',
          totalTasks: job.sub_tasks.length,
        });

        await db.insert(subSteps).values(
          job.sub_tasks.map(task => ({
            id: generateId('sub-step'),
            executionId: executionId,
            taskId: task.id,
            description: task.description,
            thought: task.thought,
            actionType: task.action_type,
            toolOrPromptName: task.tool_or_prompt.name,
            toolOrPromptParams: task.tool_or_prompt.params || {},
            dependencies: task.dependencies,
            status: 'pending' as const,
          }))
        );

        const dagExecutor = new DAGExecutor({
          logger: log,
          llmProvider,
          toolRegistry,
          db,
        });

        dagExecutor.execute(job, executionId, dagId, goalText).catch(async (error) => {
          log.error({ err: error, executionId }, 'DAG execution failed in background');
        });

        return reply.code(202).send({
          status: 'executing',
          dagId,
          executionId,
          originalRequest: goalText,
          totalTasks: job.sub_tasks.length,
          usage,
          generation_stats,
          message: 'DAG created and execution started. Connect to SSE stream for live updates.',
        });
      }

      return reply.code(500).send({
        status: 'failed',
        error: 'Failed to create DAG after maximum attempts',
        max_attempts: maxAttempts,
      });

    } catch (error) {
      log.error({ err: error }, 'Create-and-execute DAG failed');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          status: 'failed',
          error: 'Invalid input parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        status: 'failed',
        error: errorMessage,
      });
    }
  });

  /**
   * POST /execute-dag - Execute a previously created DAG
   */
  fastify.post('/execute-dag', async (request, reply) => {
    try {
      const body = ExecuteDagInputSchema.parse(request.body);
      const { dagId } = body;

      const dagRecord = await db.query.dags.findFirst({
        where: eq(dags.id, dagId),
      });

      if (!dagRecord) {
        return reply.code(404).send({
          error: `DAG with id '${dagId}' not found`,
        });
      }

      log.info({ dagId }, 'Retrieved DAG for execution');
      let resultStr = JSON.stringify(dagRecord.result)
                        .replace(/\{\{currentDate\}\}/g, new Date().toLocaleString())
                        .replace(/\{\{Today\}\}/gi, new Date().toLocaleString());
      log.debug({ result: JSON.parse(resultStr) }, 'Placeholder replaced');
      const job = DecomposerJobSchema.parse(JSON.parse(resultStr)) as DecomposerJob;

      if (job.clarification_needed) {
        return reply.code(200).send({
          status: 'clarification_required',
          clarification_query: job.clarification_query,
          validation: job.validation
        });
      }

      const executionId = generateId('dag-exec');
      
      log.info({ 
        executionId,
        dagId,
        primaryIntent: job.intent.primary,
        totalTasks: job.sub_tasks.length 
      }, 'Starting DAG execution');

      const originalGoalText = (dagRecord.params as any)?.goalText || job.original_request;

      try {
        await db.insert(dagExecutions).values({
          id: executionId,
          dagId: dagId || null,
          originalRequest: originalGoalText,
          primaryIntent: job.intent.primary,
          status: 'pending',
          totalTasks: job.sub_tasks.length,
        });

        await db.insert(subSteps).values(
          job.sub_tasks.map(task => ({
            id: generateId('sub-step'),
            executionId: executionId,
            taskId: task.id,
            description: task.description,
            thought: task.thought,
            actionType: task.action_type,
            toolOrPromptName: task.tool_or_prompt.name,
            toolOrPromptParams: task.tool_or_prompt.params || {},
            dependencies: task.dependencies,
            status: 'pending' as const,
          }))
        );

        log.info({ executionId }, 'Initial execution records created');
      } catch (dbError) {
        log.error({ err: dbError, executionId }, 'Failed to create initial execution records');
        return reply.code(500).send({
          status: 'failed',
          error: 'Failed to initialize execution records',
          details: dbError instanceof Error ? dbError.message : String(dbError),
        });
      }

      const dagExecutor = new DAGExecutor({
        logger: log,
        llmProvider,
        toolRegistry,
        db,
      });

      dagExecutor.execute(job, executionId, dagId, originalGoalText).catch(async (error) => {
        log.error({ err: error, executionId }, 'DAG execution failed in background');
        
        try {
          const execution = await db.query.dagExecutions.findFirst({
            where: eq(dagExecutions.id, executionId),
          });
          
          if (execution && execution.status !== 'suspended' && execution.status !== 'failed') {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await db.update(dagExecutions)
              .set({
                status: 'suspended',
                suspendedReason: errorMessage,
                suspendedAt: new Date(),
              })
              .where(eq(dagExecutions.id, executionId));
            
            dagEventBus.emit('dag:event', {
              type: 'execution.suspended',
              executionId,
              timestamp: Date.now(),
              reason: errorMessage,
            });
          }
        } catch (updateError) {
          log.error({ err: updateError, executionId }, 'Failed to update execution status after error');
        }
      });

      return reply.code(202).send({
        status: 'started',
        executionId,
        dagId,
        originalRequest: originalGoalText,
        totalTasks: job.sub_tasks.length,
        message: 'DAG execution started. Connect to SSE stream for live updates.',
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to start DAG execution');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid input parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        status: 'failed',
        error: errorMessage,
      });
    }
  });

  /**
   * POST /resume-dag/:executionId - Resume a suspended or failed DAG execution
   */
  fastify.post('/resume-dag/:executionId', async (request, reply) => {
    try {
      const params = ExecutionIdParamsSchema.parse(request.params);
      const { executionId } = params;

      const execution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, executionId),
      });

      if (!execution) {
        return reply.code(404).send({
          error: `Execution with id '${executionId}' not found`,
        });
      }

      if (!['suspended', 'failed'].includes(execution.status)) {
        return reply.code(400).send({
          error: `Cannot resume execution with status '${execution.status}'. Only 'suspended' or 'failed' executions can be resumed.`,
          currentStatus: execution.status,
        });
      }

      if (!execution.dagId) {
        return reply.code(400).send({
          error: 'Execution has no associated DAG. Cannot resume.',
        });
      }

      const dagRecord = await db.query.dags.findFirst({
        where: eq(dags.id, execution.dagId),
      });

      if (!dagRecord) {
        return reply.code(404).send({
          error: `DAG with id '${execution.dagId}' not found`,
        });
      }

      const job = DecomposerJobSchema.parse(dagRecord.result) as DecomposerJob;
      const originalGoalText = (dagRecord.params as any)?.goalText || job.original_request;

      await db.update(dagExecutions)
        .set({
          lastRetryAt: new Date(),
          retryCount: sql`${dagExecutions.retryCount} + 1`,
        })
        .where(eq(dagExecutions.id, executionId));

      log.info({
        executionId,
        dagId: execution.dagId,
        retryCount: execution.retryCount + 1,
        previousStatus: execution.status,
      }, 'Resuming DAG execution');

      const dagExecutor = new DAGExecutor({
        logger: log,
        llmProvider,
        toolRegistry,
        db,
      });

      const executePromise = dagExecutor.execute(job, executionId, execution.dagId, originalGoalText);
      
      await Promise.race([
        executePromise,
        new Promise(resolve => setTimeout(resolve, 100))
      ]).catch((error) => {
        throw error;
      });

      executePromise.catch((error) => {
        log.error({ err: error, executionId }, 'DAG resume failed during execution');
      });

      return reply.code(202).send({
        status: 'resumed',
        executionId,
        dagId: execution.dagId,
        retryCount: execution.retryCount + 1,
        message: 'DAG execution resumed. Connect to SSE stream for live updates.',
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to resume DAG execution');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        status: 'failed',
        error: errorMessage,
      });
    }
  });

  /**
   * POST /dag-experiments - Log DAG creation experiments with multiple model/temperature combinations
   */
  fastify.post('/dag-experiments', async (request, reply) => {
    try {
      const body = DagExperimentsInputSchema.parse(request.body);
      const { 'goal-text': goalText, models, provider, agentName, temperatures, seed } = body;

      log.info({ 
        goalText, 
        modelsCount: models.length, 
        temperaturesCount: temperatures.length,
        totalExperiments: models.length * temperatures.length, 
      }, 'Starting DAG experiments');

      const experimentResults: Array<{
        model: string;
        temperature: number;
        dagId: string | null;
        success: boolean;
        error?: string;
      }> = [];

      for (const model of models) {
        for (const temperature of temperatures) {
          const requestBody = {
            'goal-text': goalText,
            agentName,
            provider,
            model,
            temperature,
            seed,
          };

          log.info({ requestBody }, 'DAG experiment request body');
          
          const response = await fastify.inject({
            method: 'POST',
            url: '/api/v1/create-dag',
            payload: requestBody,
          });

          const responseData = response.json();
          let dagId: string | null = null;
          let success = false;
          let error: string | undefined;

          try {
            if (response.statusCode === 200 && responseData.result) {
              dagId = generateId('dag');
              
              await db.insert(dags).values({
                id: dagId,
                status: responseData.status || 'unknown',
                result: responseData.result,
                usage: responseData.usage || null,
                generationStats: responseData.generation_stats || null,
                attempts: responseData.attempts || 0,
                params: requestBody,
              });

              success = true;
              log.info({ dagId, model, temperature }, 'DAG record inserted successfully');
            } else {
              error = `Request failed with status ${response.statusCode}`;
              log.warn({ model, temperature, statusCode: response.statusCode }, 'DAG creation request failed');
            }
          } catch (insertError) {
            error = insertError instanceof Error ? insertError.message : String(insertError);
            log.error({ err: insertError, model, temperature }, 'Failed to insert DAG record');
          }

          experimentResults.push({
            dagId,
            model,
            temperature,
            success,
            error,
          });
        }
      }

      const successCount = experimentResults.filter(r => r.success).length;
      const failureCount = experimentResults.filter(r => !r.success).length;

      return reply.code(200).send({
        status: 'completed',
        totalExperiments: experimentResults.length,
        successCount,
        failureCount,
        results: experimentResults,
      });

    } catch (error) {
      log.error({ err: error }, 'DAG experiments failed');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid input parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * POST /dag-run - Run a previously created DAG by retrieving it and executing
   */
  fastify.post('/dag-run', async (request, reply) => {
    try {
      const body = ExecuteDagInputSchema.parse(request.body);
      const { dagId } = body;

      const dagRecord = await db.query.dags.findFirst({
        where: eq(dags.id, dagId),
      });

      if (!dagRecord) {
        return reply.code(404).send({
          error: `DAG with id '${dagId}' not found`,
        });
      }

      log.info({ dagId }, 'Retrieved DAG, forwarding to execute-dag');

      const executeResponse = await fastify.inject({
        method: 'POST',
        url: '/api/v1/execute-dag',
        payload: dagRecord.result,
      });

      const executeData = executeResponse.json();

      return reply.code(executeResponse.statusCode).send(executeData);

    } catch (error) {
      log.error({ err: error }, 'DAG run failed');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid input parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });
}
