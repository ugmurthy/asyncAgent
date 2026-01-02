/**
 * Handler for POST /create-dag endpoint
 */
import type { FastifyInstance } from 'fastify';
import type { LLMProvider } from '@async-agent/shared';
import { generateId } from '@async-agent/shared';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { ToolRegistry } from '../../../../agent/tools/index.js';
import { createLLMProvider } from '../../../../agent/providers/index.js';
import { LlmExecuteTool } from '../../../../agent/tools/llmExecute.js';
import { agents, dags } from '../../../../db/schema.js';
import { validateCronExpression } from '../../../../utils/cron-validator.js';
import { CreateDagInputSchema, DecomposerJobSchema } from '../schemas.js';
import { extractCodeBlock, renumberSubTasks, truncate, truncateForLog } from '../utils.js';
import type { RouteContext, PlanningAttempt, PlanningUsageTotal } from '../types.js';

export function registerCreateDagRoute(
  fastify: FastifyInstance,
  context: RouteContext
) {
  const { log } = fastify;
  const db = (fastify as any).db;
  const { llmProvider, toolRegistry, dagScheduler } = context;

  /**
   * POST /create-dag - Create a DAG (Directed Acyclic Graph) from a goal description
   */
  fastify.post('/create-dag', async (request, reply) => {
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
        .replace(/\{\{tools\}\}/g, JSON.stringify(toolDefinitions))
        .replace(/\{\{currentDate\}\}/g, new Date().toLocaleString());

      let currentGoalText = goalText;
      currentGoalText = currentGoalText
         .replace(/\{\{currentDate\}\}/g, new Date().toLocaleString());

      const showGoalText = truncateForLog(goalText);
      let attempt = 0;
      const maxAttempts = 3;
      
      const planningAttempts: PlanningAttempt[] = [];
      const planningUsageTotal: PlanningUsageTotal = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let planningCostTotal = 0;
      let retryReason: 'initial' | 'retry_gaps' | 'retry_parse_error' | 'retry_validation' = 'initial';

      while (attempt < maxAttempts) {
        attempt++;
        log.info({ attempt, agentName, goalText: showGoalText }, 'Creating DAG with LLM inference');
        log.info({ model: (activeLLMProvider as any).model, provider: (activeLLMProvider as any).name }, 'LLM Provider Configuration');
        
        const response = await activeLLMProvider.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: currentGoalText },
          ],
          temperature: body.temperature ?? 0.7,
          maxTokens: body.max_tokens ?? 10000,
          ...(body.seed !== undefined && { seed: body.seed }),
        });

        const attemptUsage = response.usage;
        const attemptCost = response.costUsd;
        const attemptGenStats = response.generationStats;
        
        if (attemptUsage) {
          planningUsageTotal.promptTokens += attemptUsage.promptTokens ?? 0;
          planningUsageTotal.completionTokens += attemptUsage.completionTokens ?? 0;
          planningUsageTotal.totalTokens += attemptUsage.totalTokens ?? 0;
        }
        if (attemptCost != null) {
          planningCostTotal += attemptCost;
        }

        const MAX_RESPONSE_SIZE = 100_000;
        if (response.content.length > MAX_RESPONSE_SIZE) {
          log.error({ responseSize: response.content.length }, 'LLM response exceeds size limit');
          return reply.code(500).send({
            error: `Response too large: ${response.content.length} bytes`,
            maxSize: MAX_RESPONSE_SIZE,
          });
        }

        let result;
        log.info({ response: response.content }, 'LLM Response');
        try {
          result = extractCodeBlock(response.content);
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          
          planningAttempts.push({
            attempt,
            reason: retryReason,
            usage: attemptUsage,
            costUsd: attemptCost,
            errorMessage,
            generationStats: attemptGenStats,
          });
          
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
          retryReason = 'retry_parse_error';
          continue;
        }
        
        const usage = response?.usage ?? null;
        const generation_stats = response?.generationStats ?? null;
        const validatedResult = DecomposerJobSchema.safeParse(result);
        
        if (!validatedResult.success) {
          planningAttempts.push({
            attempt,
            reason: retryReason,
            usage: attemptUsage,
            costUsd: attemptCost,
            errorMessage: JSON.stringify(validatedResult.error.issues),
            generationStats: attemptGenStats,
          });
          
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
          retryReason = 'retry_validation';
          continue;
        }

        planningAttempts.push({
          attempt,
          reason: retryReason,
          usage: attemptUsage,
          costUsd: attemptCost,
          generationStats: attemptGenStats,
        });

        let dag = validatedResult.data;

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
          dag = renumberSubTasks(dag);
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
              
              planningAttempts.push({
                attempt,
                reason: 'title_master',
                usage: llmResult.usage,
                costUsd: llmResult.costUsd,
                generationStats: llmResult.generationStats,
              });
              
              if (llmResult.usage) {
                planningUsageTotal.promptTokens += llmResult.usage.promptTokens ?? 0;
                planningUsageTotal.completionTokens += llmResult.usage.completionTokens ?? 0;
                planningUsageTotal.totalTokens += llmResult.usage.totalTokens ?? 0;
              }
              if (llmResult.costUsd != null) {
                planningCostTotal += llmResult.costUsd;
              }
            } else {
              log.warn('TitleMaster agent not found or inactive');
            }
          } catch (titleError) {
            log.error({ err: titleError }, 'Error calling TitleMaster');
          }
          
          dag.original_request = goalText;
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
            planningTotalUsage: planningUsageTotal,
            planningTotalCostUsd: planningCostTotal.toString(),
            planningAttempts,
          });

          log.info({ 
            dagId, 
            agentName, 
            goalText: showGoalText,
            cronSchedule: body.cronSchedule,
            scheduleActive: scheduleActive,
            planningCost: planningCostTotal,
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

          return reply.code(200).send({
            status: 'success',
            dagId
          });
        }

        if (dag.validation.gaps && dag.validation.gaps.length > 0) {
          const gapsText = dag.validation.gaps.map((gap, idx) => `${idx + 1}. ${gap}`).join('\n');
          currentGoalText = `${goalText}\n\nEnsure following gaps are covered:\n${gapsText}`;
          
          log.info({ gaps: dag.validation.gaps, attempt }, 'Retrying with gaps addressed');
          retryReason = 'retry_gaps';
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
}
