import type { FastifyInstance } from 'fastify';
import type { LLMProvider } from '@async-agent/shared';
import { generateId } from '@async-agent/shared';
import { z } from 'zod';
import { DAGExecutor, type DecomposerJob } from '../../agent/dagExecutor.js';
import { LlmExecuteTool } from '../../agent/tools/llmExecute.js';
import type { ToolRegistry } from '../../agent/tools/index.js';
import { createLLMProvider } from '../../agent/providers/index.js';
import { agents, dags, dagExecutions, subSteps } from '../../db/schema.js';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';
import { dagEventBus, type DAGEvent } from '../../events/bus.js';
import { validateCronExpression } from '../../utils/cron-validator.js';
import cronstrue from 'cronstrue';

/**
 * Extracts and parses JSON content from a markdown code block.
 * @param response - The markdown string containing a JSON code block
 * @returns The parsed JSON object
 * @throws Error if no JSON code block is found or parsing fails
 */
function extractJsonCodeBlock(response: string): unknown {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch || !jsonMatch[1]) {
    throw new Error('No JSON code block found in response');
  }
  return JSON.parse(jsonMatch[1].trim());
}

/**
 * Extracts and parses JSON content from a markdown code block with detailed diagnostics.
 * Provides specific error locations and context for large JSON objects.
 * @param response - The markdown string containing a JSON code block
 * @returns The parsed JSON object
 * @throws Error with detailed diagnostics if extraction or parsing fails
 */
function extractCodeBlock(response: string): unknown {
  // Try to find ```json code block
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch || !jsonMatch[1]) {
    // Fallback: try to find any ``` code block
    const anyMatch = response.match(/```\s*([\s\S]*?)\s*```/);
    if (!anyMatch || !anyMatch[1]) {
      throw new Error('No JSON code block found in response');
    }
  }

  const jsonContent = (jsonMatch?.[1] || response).trim();

  // Attempt to parse JSON
  try {
    return JSON.parse(jsonContent);
  } catch (parseError) {
    // Provide detailed diagnostics
    const error = parseError as SyntaxError;
    const errorMessage = error.message;

    // Try to extract line and position info from error message
    const positionMatch = errorMessage.match(/position (\d+)/);
    const position = positionMatch ? parseInt(positionMatch[1], 10) : null;

    // Find line number from position
    let lineNumber = 1;
    let columnNumber = 1;
    let currentPos = 0;

    if (position !== null) {
      const lines = jsonContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for newline
        if (currentPos + lineLength > position) {
          lineNumber = i + 1;
          columnNumber = position - currentPos + 1;
          break;
        }
        currentPos += lineLength;
      }
    }

    // Extract context around error
    const lines = jsonContent.split('\n');
    const contextStart = Math.max(0, lineNumber - 3);
    const contextEnd = Math.min(lines.length, lineNumber + 2);
    const context = lines
      .slice(contextStart, contextEnd)
      .map((line, idx) => {
        const actualLineNum = contextStart + idx + 1;
        const marker = actualLineNum === lineNumber ? '>>> ' : '    ';
        return `${marker}${String(actualLineNum).padStart(4, ' ')}: ${line}`;
      })
      .join('\n');

    const diagnosticMessage = [
      `JSON Parse Error: ${errorMessage}`,
      `Location: Line ${lineNumber}, Column ${columnNumber}`,
      `Content Preview (lines ${contextStart + 1}-${contextEnd}):`,
      context,
      `Total size: ${jsonContent.length} characters, ${lines.length} lines`,
    ].join('\n');

    throw new Error(diagnosticMessage);
  }
}

function truncate(str:string,numChars=2000):string {
  if (str.length <= numChars) return str;
  return str.slice(0, numChars);
}

const SubTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  thought: z.string(),
  action_type: z.enum(['tool', 'inference']),
  tool_or_prompt: z.object({
    name: z.string(),
    params: z.record(z.any()).optional(),
  }),
  expected_output: z.string(),
  dependencies: z.array(z.string()),
});

const DecomposerJobSchema = z.object({
  original_request: z.string(),
  intent: z.object({
    primary: z.string(),
    sub_intents: z.array(z.string()),
  }),
  entities: z.array(z.object({
    entity: z.string(),
    type: z.string(),
    grounded_value: z.string(),
  })),
  sub_tasks: z.array(SubTaskSchema),
  synthesis_plan: z.string(),
  validation: z.object({
    coverage: z.string(),
    gaps: z.array(z.string()),
    iteration_triggers: z.array(z.string()),
  }),
  clarification_needed: z.boolean(),
  clarification_query: z.string().optional(),
}).refine(
  (data) => {
    if (data.clarification_needed) {
      return typeof data.clarification_query === 'string' && data.clarification_query.length > 0;
    }
    return true;
  },
  {
    message: 'clarification_query is required when clarification_needed is true',
    path: ['clarification_query'],
  }
);

interface DAGRoutesOptions {
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
  dagScheduler?: any;
}

export async function dagRoutes(fastify: FastifyInstance, options: DAGRoutesOptions) {
  const { log, db } = fastify;
  const { llmProvider, toolRegistry, dagScheduler } = options;

  /**
   * POST /create-dag - Create a DAG (Directed Acyclic Graph) from a goal description
   * 
   * @param request.body.goal-text - The goal description to decompose into tasks
   * @param request.body.agentName - Name of the agent to use for DAG creation
   * @param request.body.provider - (Optional) LLM provider override (openai|openrouter|ollama)
   * @param request.body.model - (Optional) LLM model override
   * @param request.body.max_tokens - (Optional) Maximum tokens for LLM response
   * @param request.body.temperature - (Optional) LLM temperature (0-2)
   * @param request.body.seed - (Optional) Random seed for reproducibility
   * 
   * @returns {200} Success - DAG created successfully
   * @returns {200} Clarification Required - LLM needs more information
   * @returns {400} Bad Request - Invalid input or LLM configuration
   * @returns {404} Not Found - Agent not found or inactive
   * @returns {500} Server Error - DAG creation failed or response parsing error
   */
  fastify.post('/create-dag', async (request, reply) => {
    try {
      const inputSchema = z.object({
        'goal-text': z.string().min(1),
        agentName: z.string().min(1),
        provider: z.string().optional(),
        model: z.string().optional(),
        max_tokens: z.number().optional(),
        temperature: z.number().optional(),
        seed: z.number().optional(),
        cronSchedule: z.string().optional(),
        scheduleActive: z.boolean().optional(),
        timezone: z.string().optional().default('UTC'),
      });

      const body = inputSchema.parse(request.body);
      const goalText = body['goal-text'];
      const agentName = body.agentName;
      
      // Default scheduleActive to true if cronSchedule is provided, unless explicitly set to false
      const scheduleActive = body.scheduleActive ?? !!body.cronSchedule;

      // Validate cron schedule if provided
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

      // Determine which LLM provider to use
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

          // Validate tool call support
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
          error: 'Invalid LLM provider configuration',
          details: errorMessage,
        });
      }

      const agent = await db.query.agents.findFirst({
        where: and(eq(agents.name, agentName), eq(agents.active, true)),
      });

      if (!agent) {
        return reply.code(404).send({
          error: `Agent '${agentName}' not found OR not active`,
        });
      }
      
      const toolDefinitions = toolRegistry.getAllDefinitions();
      const systemPrompt = agent.promptTemplate
        .replace(/\{\{tools\}\}/g,JSON.stringify(toolDefinitions))
        .replace(/\{\{currentDate\}\}/g, new Date().toLocaleString());

      let currentGoalText = goalText;

      // Look here to replace place holders in goaltext
      currentGoalText = currentGoalText
         .replace(/\{\{currentDate\}\}/g, new Date().toLocaleString());

      let showGoalText = goalText.length>50?`${goalText.slice(0,50)}...`:goalText;
      let attempt = 0;
      const maxAttempts = 3;
      //log.info({systemPrompt},'System Prompt')

      while (attempt < maxAttempts) {
        attempt++;
        log.info({ attempt, agentName, goalText: showGoalText }, 'Creating DAG with LLM inference');
        log.info({ model: activeLLMProvider.model, provider: activeLLMProvider.provider }, 'LLM Provider Configuration');
        
        const response = await activeLLMProvider.chat ({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: currentGoalText },
          ],
          temperature: body.temperature ?? 0.7,
          maxTokens: body.max_tokens ?? 10000,
          ...(body.seed !== undefined && { seed: body.seed }),
        });

        const MAX_RESPONSE_SIZE = 100_000; // 100KB limit
        if (response.content.length > MAX_RESPONSE_SIZE) {
          log.error({ responseSize: response.content.length }, 'LLM response exceeds size limit');
          return reply.code(500).send({
            error: `Response too large: ${response.content.length} bytes`,
            maxSize: MAX_RESPONSE_SIZE,
          });
        }

        let result;
        //log.info({ response }, 'LLM response');
        try {
          result = extractCodeBlock(response.content);
        } catch (parseError) {
          log.error({ 
            err: parseError, 
            attempt,
            responsePreview: response.content.slice(0, 500) 
          }, 'Failed to parse LLM response as JSON');
          
          if (attempt >= maxAttempts) {
            return reply.code(500).send({
              error: 'LLM response is not valid JSON after multiple attempts',
              attempts: attempt,
              responsePreview: response.content.slice(0, 500),
            });
          }
          continue;
        }
        const usage = response?.usage ?? null;
        const generation_stats = response?.generation_stats ?? null;
        const validatedResult = DecomposerJobSchema.safeParse(result);
        
        if (!validatedResult.success) {
          log.error({ 
            errors: validatedResult.error.issues,
            attempt 
          }, 'DAG validation failed');
          
          if (attempt >= maxAttempts) {
            return reply.code(400).send({
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
          log.info({ clarification_query: dag.clarification_query }, 'Clarification required');
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
          
          // Call TitleMaster to generate dag_title
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
          /// to ensure goalText is retained as is in dag
          dag.original_request=goalText;
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

          // Register with scheduler if schedule is active
          if (dagScheduler && body.cronSchedule && scheduleActive) {
            dagScheduler.registerDAGSchedule({
              id: dagId,
              cronSchedule: body.cronSchedule,
              scheduleActive: scheduleActive,
              timezone: body.timezone,
            });
            log.info({ dagId, cronSchedule: body.cronSchedule, timezone: body.timezone }, 'DAG schedule registered');
          }

          return reply.code(200).send({
            status: 'success',
            dagId
          });
        }

        if (dag.validation.gaps && dag.validation.gaps.length > 0) {
          const gapsText = dag.validation.gaps.map((gap, idx) => `${idx + 1}. ${gap}`).join('\n');
          currentGoalText = `${goalText}\n\nEnsure following gaps are covered:\n${gapsText}`;
          
          log.info({ gaps: dag.validation.gaps, attempt }, 'Retrying with gaps addressed');
          continue;
        }

        return reply.code(200).send({
          status: 'success',
          result: dag,
          usage,
          generation_stats,
          attempts: attempt,
        });
      }

      return reply.code(500).send({
        error: 'Failed to create DAG after maximum attempts',
        max_attempts: maxAttempts,
      });

    } catch (error) {
      log.error({ err: error }, 'DAG creation failed');
      
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
   * POST /create-and-execute-dag - Create a DAG and immediately execute it if successful
   * 
   * @param request.body.goal-text - The goal description to decompose into tasks
   * @param request.body.agentName - Name of the agent to use for DAG creation
   * @param request.body.provider - (Optional) LLM provider override (openai|openrouter|ollama)
   * @param request.body.model - (Optional) LLM model override
   * @param request.body.max_tokens - (Optional) Maximum tokens for LLM response
   * @param request.body.temperature - (Optional) LLM temperature (0-2)
   * @param request.body.seed - (Optional) Random seed for reproducibility
   * @param request.body.cronSchedule - (Optional) Cron schedule for recurring execution
   * @param request.body.scheduleActive - (Optional) Whether the schedule is active
   * @param request.body.timezone - (Optional) Timezone for the schedule
   * 
   * @returns {202} Success - DAG created and execution started
   * @returns {200} Clarification Required - LLM needs more information
   * @returns {400} Bad Request - Invalid input or LLM configuration
   * @returns {404} Not Found - Agent not found or inactive
   * @returns {500} Server Error - DAG creation or execution failed
   */
  fastify.post('/create-and-execute-dag', async (request, reply) => {
    try {
      const inputSchema = z.object({
        'goal-text': z.string().min(1),
        agentName: z.string().min(1),
        provider: z.string().optional(),
        model: z.string().optional(),
        max_tokens: z.number().optional(),
        temperature: z.number().optional(),
        seed: z.number().optional(),
        cronSchedule: z.string().optional(),
        scheduleActive: z.boolean().optional(),
        timezone: z.string().optional().default('UTC'),
      });

      const body = inputSchema.parse(request.body);
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
        .replace(/\{\{tools\}\}/g,JSON.stringify(toolDefinitions))
        .replace(/\{\{currentDate\}\}/g, new Date().toLocaleString());

      let currentGoalText = goalText;
      let showGoalText = goalText.length>50?`${goalText.slice(0,50)}...`:goalText;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        log.info({ attempt, agentName, goalText: showGoalText }, 'Creating DAG with LLM inference (create-and-execute)');
        log.info({ model: activeLLMProvider.model, provider: activeLLMProvider.provider }, 'LLM Provider Configuration');
        
        const response = await activeLLMProvider.chat ({
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
        const generation_stats = response?.generation_stats ?? null;
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

          // Immediately execute the DAG
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

        // Fallback: DAG created but coverage is not high - still save and execute
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
   * 
   * @param request.body.dagId - The ID of the DAG to retrieve and execute
   * 
   * @returns {202} Success - DAG execution started
   * @returns {200} Clarification Required - Job requires clarification
   * @returns {400} Bad Request - Invalid dagId parameter
   * @returns {404} Not Found - DAG not found
   * @returns {500} Server Error - DAG execution failed
   */
  fastify.post('/execute-dag', async (request, reply) => {
    try {
      const inputSchema = z.object({
        dagId: z.string().min(1),
      });

      const body = inputSchema.parse(request.body);
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
                        .replace(/\{\{Today\}\}/gi, new Date().toLocaleString());;
      log.debug({result:JSON.parse(resultStr)},'Placeholder replaced')
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
      },'Starting DAG execution');

      // Use original goalText from DAG params (preserves formatting) instead of LLM's original_request
      const originalGoalText = (dagRecord.params as any)?.goalText || job.original_request;

      // Create initial execution record before starting async execution
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

      // Execute asynchronously in background - records already created with 'pending' status
      dagExecutor.execute(job, executionId, dagId, originalGoalText).catch(async (error) => {
        log.error({ err: error, executionId }, 'DAG execution failed in background');
        
        // Ensure execution is marked as suspended if not already handled
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

      // Return immediately with execution ID
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
   * 
   * @param request.params.executionId - The execution ID to resume
   * 
   * @returns {202} Accepted - Execution resumed successfully
   * @returns {400} Bad Request - Cannot resume execution with current status
   * @returns {404} Not Found - Execution or DAG not found
   * @returns {500} Server Error - Failed to resume execution
   */
  fastify.post('/resume-dag/:executionId', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        executionId: z.string().min(1),
      });

      const params = paramsSchema.parse(request.params);
      const { executionId } = params;

      // Fetch existing execution
      const execution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, executionId),
      });

      if (!execution) {
        return reply.code(404).send({
          error: `Execution with id '${executionId}' not found`,
        });
      }

      // Check if execution can be resumed
      if (!['suspended', 'failed'].includes(execution.status)) {
        return reply.code(400).send({
          error: `Cannot resume execution with status '${execution.status}'. Only 'suspended' or 'failed' executions can be resumed.`,
          currentStatus: execution.status,
        });
      }

      // Fetch the original DAG
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
      // Use original goalText from DAG params (preserves formatting) instead of LLM's original_request
      const originalGoalText = (dagRecord.params as any)?.goalText || job.original_request;

      // Update status to pending and increment retry count
      await db.update(dagExecutions)
        .set({
          //status: 'pending',
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

      // Resume execution using same execution ID
      // Execute async but return immediately after validation passes
      const executePromise = dagExecutor.execute(job, executionId, execution.dagId, originalGoalText);
      
      // Wait briefly to catch immediate validation errors (like missing sub-steps)
      await Promise.race([
        executePromise,
        new Promise(resolve => setTimeout(resolve, 100))
      ]).catch((error) => {
        // If error occurs during initial validation, throw it to be caught by outer try-catch
        throw error;
      });

      // Continue execution in background
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
   * 
   * @param request.body.goal-text - The goal description for experiments
   * @param request.body.models - Array of model names to test
   * @param request.body.temperatures - Array of temperature values to test
   * @param request.body.seed - Random seed for reproducibility across experiments
   * 
   * @returns {200} Success - Experiments logged (note: does not execute, only logs)
   * @returns {400} Bad Request - Invalid input parameters
   * @returns {500} Server Error - Experiment setup failed
   */
  fastify.post('/dag-experiments', async (request, reply) => {
    try {
      const inputSchema = z.object({
        'goal-text': z.string().min(1),
        models: z.array(z.string()).min(1),
        agentName: z.string().min(1),
        provider: z.string(),
        temperatures: z.array(z.number().min(0).max(2)).min(1),
        seed: z.number().int().optional().nullable(),
      });

      const body = inputSchema.parse(request.body);
      const { 'goal-text': goalText, models,provider,agentName, temperatures, seed } = body;

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
   * 
   * @param request.body.dagId - The ID of the DAG to retrieve and execute
   * 
   * @returns {200} Success - DAG retrieved and posted to /execute-dag
   * @returns {400} Bad Request - Invalid dagId parameter
   * @returns {404} Not Found - DAG not found
   * @returns {500} Server Error - Execution request failed
   */
  fastify.post('/dag-run', async (request, reply) => {
    try {
      const inputSchema = z.object({
        dagId: z.string().min(1),
      });

      const body = inputSchema.parse(request.body);
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

  /**
   * GET /dag-executions/:id - Get DAG execution details
   * 
   * @param request.params.id - The execution ID
   * 
   * @returns {200} Success - Execution details
   * @returns {404} Not Found - Execution not found
   * @returns {500} Server Error - Query failed
   */
  fastify.get('/dag-executions/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const execution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, id),
        with: {
          subSteps: {
            orderBy: (subSteps, { asc }) => [asc(subSteps.taskId)],
          },
        },
      });

      if (!execution) {
        return reply.code(404).send({
          error: `DAG execution with id '${id}' not found`,
        });
      }

      return reply.code(200).send(execution);

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve DAG execution');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
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
   * GET /dag-executions/:id/sub-steps - Get all sub-steps for an execution
   * 
   * @param request.params.id - The execution ID
   * 
   * @returns {200} Success - List of sub-steps
   * @returns {404} Not Found - Execution not found
   * @returns {500} Server Error - Query failed
   */
  fastify.get('/dag-executions/:id/sub-steps', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const execution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, id),
      });

      if (!execution) {
        return reply.code(404).send({
          error: `DAG execution with id '${id}' not found`,
        });
      }

      const steps = await db.query.subSteps.findMany({
        where: eq(subSteps.executionId, id),
        orderBy: (subSteps, { asc }) => [asc(subSteps.taskId)],
      });

      return reply.code(200).send({
        executionId: id,
        subSteps: steps,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve sub-steps');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
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
   * GET /dag-executions - List all DAG executions
   * 
   * @param request.query.limit - Maximum number of results (default: 50)
   * @param request.query.offset - Number of results to skip (default: 0)
   * @param request.query.status - Filter by status (optional)
   * 
   * @returns {200} Success - List of executions
   * @returns {500} Server Error - Query failed
   */
  fastify.get('/dag-executions', async (request, reply) => {
    try {
      const querySchema = z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.enum(['pending', 'running', 'waiting', 'completed', 'failed', 'partial']).optional(),
      });

      const { limit, offset, status } = querySchema.parse(request.query);

      const whereConditions = status ? eq(dagExecutions.status, status) : undefined;

      const executions = await db.query.dagExecutions.findMany({
        where: whereConditions,
        orderBy: desc(dagExecutions.createdAt),
        limit,
        offset,
      });

      return reply.code(200).send({
        executions,
        pagination: {
          limit,
          offset,
          count: executions.length,
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to list DAG executions');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid query parameters',
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
   * DELETE /dag/:id - Delete a DAG (only if no executions exist)
   * 
   * @param request.params.id - The DAG ID to delete
   * 
   * @returns {200} Success - DAG deleted
   * @returns {404} Not Found - DAG not found
   * @returns {409} Conflict - DAG has existing executions
   * @returns {500} Server Error - Deletion failed
   */
  fastify.delete('/dag/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const existingDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!existingDag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      const relatedExecutions = await db.query.dagExecutions.findMany({
        where: eq(dagExecutions.dagId, id),
      });

      if (relatedExecutions.length > 0) {
        return reply.code(409).send({
          error: `Cannot delete DAG: ${relatedExecutions.length} execution(s) exist for this DAG`,
          dagId: id,
          executionCount: relatedExecutions.length,
        });
      }

      await db.delete(dags).where(eq(dags.id, id));

      // Unregister from scheduler if it exists
      if (dagScheduler) {
        dagScheduler.unregisterDAGSchedule(id);
      }

      log.info({ dagId: id }, 'DAG deleted successfully');

      return reply.code(200).send({
        message: 'DAG deleted successfully',
        dagId: id,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to delete DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
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
   * DELETE /dag-executions/:id - Delete a DAG execution and cascade to related sub-steps
   * 
   * @param request.params.id - The execution ID to delete
   * 
   * @returns {200} Success - Execution deleted with cascade count
   * @returns {404} Not Found - Execution not found
   * @returns {500} Server Error - Deletion failed
   */
  fastify.delete('/dag-executions/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const existingExecution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, id),
      });

      if (!existingExecution) {
        return reply.code(404).send({
          error: `DAG execution with id '${id}' not found`,
        });
      }

      const relatedSubSteps = await db.query.subSteps.findMany({
        where: eq(subSteps.executionId, id),
      });

      await db.delete(dagExecutions).where(eq(dagExecutions.id, id));

      log.info({ 
        executionId: id, 
        cascadedSubSteps: relatedSubSteps.length 
      }, 'DAG execution deleted successfully');

      return reply.code(200).send({
        message: 'DAG execution deleted successfully',
        executionId: id,
        cascadeInfo: {
          relatedSubStepsDeleted: relatedSubSteps.length,
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to delete DAG execution');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
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
   * GET /dag-executions/:id/events - Server-Sent Events stream for DAG execution
   * 
   * @param request.params.id - The execution ID to stream events for
   * 
   * @returns {200} Success - SSE stream with execution events
   * @returns {404} Not Found - Execution not found
   */
  fastify.get('/dag-executions/:id/events', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    let params;
    try {
      params = paramsSchema.parse(request.params);
    } catch (error) {
      return reply.code(400).send({
        error: 'Invalid parameters',
        validation_errors: error instanceof z.ZodError ? error.issues : [],
      });
    }

    const { id } = params;

    const execution = await db.query.dagExecutions.findFirst({
      where: eq(dagExecutions.id, id),
      with: {
        subSteps: {
          orderBy: (subSteps, { asc }) => [asc(subSteps.taskId)],
        },
      },
    });

    if (!execution) {
      return reply.code(404).send({
        error: `DAG execution with id '${id}' not found`,
      });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    const sendEvent = (event: DAGEvent) => {
      try {
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        log.error({ err: error, executionId: id }, 'Failed to send SSE event');
      }
    };

    const onEvent = (event: DAGEvent) => {
      if (event.executionId === id) {
        sendEvent(event);
      }
    };

    dagEventBus.on('dag:event', onEvent);

    sendEvent({
      type: 'execution.updated',
      executionId: id,
      timestamp: Date.now(),
      status: execution.status,
      completedTasks: execution.completedTasks,
      failedTasks: execution.failedTasks,
      waitingTasks: execution.waitingTasks,
    });

    const heartbeatInterval = setInterval(() => {
      try {
        sendEvent({
          type: 'heartbeat',
          executionId: id,
          timestamp: Date.now(),
        });
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      dagEventBus.off('dag:event', onEvent);
      log.info({ executionId: id }, 'SSE connection closed');
    });

    request.raw.on('error', () => {
      clearInterval(heartbeatInterval);
      dagEventBus.off('dag:event', onEvent);
    });
  });

  /**
   * GET /dags - List all DAGs
   * 
   * @param request.query.limit - Maximum number of results (default: 50)
   * @param request.query.offset - Number of results to skip (default: 0)
   * @param request.query.status - Filter by status (optional)
   * 
   * @returns {200} Success - List of DAGs
   * @returns {500} Server Error - Query failed
   */
  fastify.get('/dags', async (request, reply) => {
    try {
      const querySchema = z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.string().optional(),
      });

      const { limit, offset, status } = querySchema.parse(request.query);

      const whereConditions = status ? eq(dags.status, status) : undefined;

      const dagList = await db.query.dags.findMany({
        where: whereConditions,
        orderBy: desc(dags.createdAt),
        limit,
        offset,
      });

      // Ensure dates are serializable
      const serializedDags = dagList.map(dag => ({
        ...dag,
        createdAt: dag.createdAt?.toISOString(),
        updatedAt: dag.updatedAt?.toISOString(),
      }));

      return reply.code(200).send({
        dags: serializedDags,
        pagination: {
          limit,
          offset,
          count: dagList.length,
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to list DAGs');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid query parameters',
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
   * GET /dags/scheduled - List all DAGs with a cron schedule
   * 
   * @returns {200} Success - List of scheduled DAGs with expanded cron descriptions
   * @returns {500} Server Error - Query failed
   */
  fastify.get('/dags/scheduled', async (request, reply) => {
    try {
      const scheduledDags = await db.query.dags.findMany({
        where: isNotNull(dags.cronSchedule),
        orderBy: desc(dags.updatedAt),
      });

      const results = scheduledDags.map(dag => {
        let scheduleDescription = 'Invalid schedule';
        if (dag.cronSchedule) {
          try {
            scheduleDescription = cronstrue.toString(dag.cronSchedule);
          } catch (e) {
            log.warn({ dagId: dag.id, schedule: dag.cronSchedule, err: e }, 'Failed to parse cron schedule');
          }
        }

        return {
          id: dag.id,
          dag_title: dag.dagTitle,
          cron_schedule: dag.cronSchedule,
          schedule_description: scheduleDescription,
          schedule_active: dag.scheduleActive
        };
      });

      return reply.code(200).send(results);

    } catch (error) {
      log.error({ err: error }, 'Failed to list scheduled DAGs');
      return reply.code(500).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /dags/:id - Get DAG by ID
   * 
   * @param request.params.id - The DAG ID
   * 
   * @returns {200} Success - DAG details
   * @returns {404} Not Found - DAG not found
   * @returns {500} Server Error - Query failed
   */
  fastify.get('/dags/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const dag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!dag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      return reply.code(200).send(dag);

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
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
   * PATCH /dags/:id - Update DAG
   * 
   * @param request.params.id - The DAG ID to update
   * @param request.body.status - Updated status (optional)
   * @param request.body.result - Updated result (optional)
   * @param request.body.params - Updated params (optional)
   * 
   * @returns {200} Success - DAG updated
   * @returns {404} Not Found - DAG not found
   * @returns {500} Server Error - Update failed
   */
  fastify.patch('/dags/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const bodySchema = z.object({
        status: z.string().optional(),
        result: z.record(z.any()).optional(),
        params: z.record(z.any()).optional(),
        cronSchedule: z.string().optional(),
        scheduleActive: z.boolean().optional(),
        timezone: z.string().optional(),
      });

      const { id } = paramsSchema.parse(request.params);
      const updateData = bodySchema.parse(request.body);

      // Validate cron schedule if being updated
      if (updateData.cronSchedule) {
        const validation = validateCronExpression(updateData.cronSchedule);
        if (!validation.valid) {
          return reply.code(400).send({
            error: 'Invalid cron expression',
            details: validation.error,
          });
        }
      }

      const existingDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!existingDag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      await db.update(dags)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(dags.id, id));

      const updatedDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      // Update scheduler if schedule fields changed
      if (dagScheduler && (updateData.cronSchedule !== undefined || updateData.scheduleActive !== undefined)) {
        const finalSchedule = updateData.cronSchedule ?? updatedDag?.cronSchedule;
        const finalActive = updateData.scheduleActive ?? updatedDag?.scheduleActive;
        
        if (finalSchedule && finalActive) {
          dagScheduler.updateDAGSchedule(id, finalSchedule, finalActive);
          log.info({ dagId: id, cronSchedule: finalSchedule, scheduleActive: finalActive }, 'DAG schedule updated');
        } else {
          dagScheduler.unregisterDAGSchedule(id);
          log.info({ dagId: id }, 'DAG schedule unregistered');
        }
      }

      log.info({ dagId: id, updates: Object.keys(updateData) }, 'DAG updated successfully');

      return reply.code(200).send(updatedDag);

    } catch (error) {
      log.error({ err: error }, 'Failed to update DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
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
   * DELETE /dags/:id - Delete a DAG (same as existing /dag/:id)
   * 
   * @param request.params.id - The DAG ID to delete
   * 
   * @returns {200} Success - DAG deleted
   * @returns {404} Not Found - DAG not found
   * @returns {409} Conflict - DAG has existing executions
   * @returns {500} Server Error - Deletion failed
   */
  fastify.delete('/dags/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const existingDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!existingDag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      const relatedExecutions = await db.query.dagExecutions.findMany({
        where: eq(dagExecutions.dagId, id),
      });

      if (relatedExecutions.length > 0) {
        return reply.code(409).send({
          error: `Cannot delete DAG: ${relatedExecutions.length} execution(s) exist for this DAG`,
          dagId: id,
          executionCount: relatedExecutions.length,
        });
      }

      await db.delete(dags).where(eq(dags.id, id));

      // Unregister from scheduler if it exists
      if (dagScheduler) {
        dagScheduler.unregisterDAGSchedule(id);
      }

      log.info({ dagId: id }, 'DAG deleted successfully');

      return reply.code(200).send({
        message: 'DAG deleted successfully',
        dagId: id,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to delete DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
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
