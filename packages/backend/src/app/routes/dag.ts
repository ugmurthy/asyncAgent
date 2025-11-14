import type { FastifyInstance } from 'fastify';
import type { LLMProvider } from '@async-agent/shared';
import { generateId } from '@async-agent/shared';
import { z } from 'zod';
import { DAGExecutor, type DecomposerJob } from '../../agent/dagExecutor.js';
import type { ToolRegistry } from '../../agent/tools/index.js';
import { createLLMProvider } from '../../agent/providers/index.js';
import { agents } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

function parseJsonFromMarkdown(response: string): unknown {
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
            provider: body.provider as 'openai' | 'openrouter' | 'ollama',
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
      
      //log.info({ tools: toolRegistry.getAllDefinitions() }, 'Available tool definitions');
      const toolDefinitions = toolRegistry.getAllDefinitions();
      const systemPrompt = agent.promptTemplate
        .replace(/\{\{tools\}\}/g,JSON.stringify(toolDefinitions))
        //.replace(/\{\{objective\}\}/g, goalText)
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

        let result;
        try {
          result = parseJsonFromMarkdown(response.content);
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
        const usage = response?.usage
        const generationId = response?.generationId
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
            generationId
          });
        }

        if (dag.validation.coverage === 'high') {
          return reply.code(200).send({
            status: 'success',
            result: dag,
            usage,
            generationId,
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
          generationId,
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

  fastify.post('/dag-experiments', async (request, reply) => {
    try {
      const inputSchema = z.object({
        'goal-text': z.string().min(1),
        models: z.array(z.string()).min(1),
        temperatures: z.array(z.number().min(0).max(2)).min(1),
        seed: z.number().int(),
      });

      const body = inputSchema.parse(request.body);
      const { 'goal-text': goalText, models, temperatures, seed } = body;

      log.info({ 
        goalText, 
        modelsCount: models.length, 
        temperaturesCount: temperatures.length,
        totalExperiments: models.length * temperatures.length 
      }, 'Starting DAG experiments');

      for (const model of models) {
        for (const temperature of temperatures) {
          const requestBody = {
            'goal-text': goalText,
            model,
            temperature,
            seed,
          };

          log.info({ requestBody }, 'DAG experiment request body');
        }
      }

      return reply.code(200).send({
        status: 'experiments_logged',
        totalExperiments: models.length * temperatures.length,
        models,
        temperatures,
        seed,
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
}
