import type { FastifyInstance } from 'fastify';
import type { LLMProvider } from '@async-agent/shared';
import { generateId } from '@async-agent/shared';
import { z } from 'zod';
import { DAGExecutor, type DecomposerJob } from '../../agent/dagExecutor.js';
import type { ToolRegistry } from '../../agent/tools/index.js';
import { createLLMProvider } from '../../agent/providers/index.js';
import { agents, dags } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

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
}

export async function dagRoutes(fastify: FastifyInstance, options: DAGRoutesOptions) {
  const { log, db } = fastify;
  const { llmProvider, toolRegistry } = options;

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
      });

      const body = inputSchema.parse(request.body);
      const goalText = body['goal-text'];
      const agentName = body.agentName;

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
          return reply.code(200).send({
            status: 'clarification_required',
            clarification_query: dag.clarification_query,
            result: dag,
            usage,
            generation_stats
          });
        }

        if (dag.validation.coverage === 'high') {
          return reply.code(200).send({
            status: 'success',
            result: dag,
            usage,
            generation_stats,
            attempts: attempt,
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
   * POST /execute-dag - Execute a previously created DAG
   * 
   * @param request.body - Complete DecomposerJob object from /create-dag
   * 
   * @returns {200} Success - DAG execution completed
   * @returns {200} Clarification Required - Job requires clarification
   * @returns {400} Bad Request - Invalid DecomposerJob structure
   * @returns {500} Server Error - DAG execution failed
   */
  fastify.post('/execute-dag', async (request, reply) => {
    try {
      const job = DecomposerJobSchema.parse(request.body) as DecomposerJob;

      if (job.clarification_needed) {
        return reply.code(200).send({
          status: 'clarification_required',
          clarification_query: job.clarification_query,
          job,
        });
      }

      log.info({ 
        originalRequest: job.original_request,
        totalTasks: job.sub_tasks.length 
      },'Starting DAG execution');

      const dagExecutor = new DAGExecutor({
        logger: log,
        llmProvider,
        toolRegistry,
      });

      const result = await dagExecutor.execute(job);

      const executionId = generateId('dag-exec');

      return reply.code(200).send({
        status: 'completed',
        executionId,
        result,
        originalRequest: job.original_request,
        tasksExecuted: job.sub_tasks.length,
      });

    } catch (error) {
      log.error({ err: error }, 'DAG execution failed');
      
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
}
