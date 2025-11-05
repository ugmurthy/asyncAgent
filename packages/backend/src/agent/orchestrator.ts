import type { Database } from '../db/client.js';
import type { Logger } from '../util/logger.js';
import type { LLMProvider } from '@async-agent/shared';
import { generateStepId } from '@async-agent/shared';
import { AgentPlanner } from './planner.js';
import { ToolRegistry } from './tools/index.js';
import { runs, steps, agents } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface OrchestratorConfig {
  db: Database;
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
}

export class AgentOrchestrator {
  constructor(private config: OrchestratorConfig) {}

  async executeRun(runId: string): Promise<void> {
    const { db, logger, toolRegistry } = this.config;

    logger.info(`Starting run execution: ${runId}`);

    try {
      // Get run details
      const run = await db.query.runs.findFirst({
        where: eq(runs.id, runId),
        with: { goal: true },
      });

      if (!run) {
        throw new Error(`Run not found: ${runId}`);
      }

      const goal = run.goal;
      
      let promptTemplate: string | undefined;
      if (goal.agentId) {
        const agent = await db.query.agents.findFirst({
          where: eq(agents.id, goal.agentId),
        });
        
        if (agent) {
          promptTemplate = agent.promptTemplate;
        }
      }
      
      const planner = new AgentPlanner(
        this.config.llmProvider, 
        this.config.logger,
        promptTemplate
      );

      // Update run status to running
      await db.update(runs)
        .set({ 
          status: 'running', 
          startedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      const stepBudget = run.stepBudget;
      const allowedTools = goal.params?.allowedTools;
      
      // Get available tools
      const availableTools = allowedTools 
        ? toolRegistry.filterByNames(allowedTools)
        : toolRegistry.getAll();

      const toolDefinitions = availableTools.map(t => t.toJSONSchema());

      // Agent loop
      let workingMemory = run.workingMemory;
      let currentStep = 0;
      const stepHistory: Array<any> = [];

      const abortController = new AbortController();

      while (currentStep < stepBudget) {
        currentStep++;
        const stepsRemaining = stepBudget - currentStep;

        logger.info(`Executing step ${currentStep}/${stepBudget}`);

        // Plan next step
        const planResult = await planner.plan({
          objective: goal.objective,
          workingMemory,
          stepHistory,
          stepsRemaining,
          tools: toolDefinitions,
          temperature: goal.params?.temperature,
          maxTokens: goal.params?.maxTokens,
          constraints: goal.params?.constraints,
        });

        const stepStartTime = Date.now();

        // Record thought
        let observation: string | undefined;
        let toolName: string | undefined;
        let toolInput: Record<string, any> | undefined;
        let stepError: string | undefined;

        // Execute tool calls if any
        if (planResult.toolCalls && planResult.toolCalls.length > 0) {
          // Execute all tool calls in parallel
          const toolResults = await Promise.allSettled(
            planResult.toolCalls.map(async (toolCall) => {
              const tool = toolRegistry.get(toolCall.name);
              if (!tool) {
                throw new Error(`Tool not found: ${toolCall.name}`);
              }

              // Validate input
              const validatedInput = tool.inputSchema.parse(toolCall.arguments);

              // Execute tool
              const result = await tool.execute(validatedInput, {
                logger,
                db,
                runId,
                abortSignal: abortController.signal,
              });

              return { name: toolCall.name, result };
            })
          );

          // Process results
          const observations: string[] = [];
          const errors: string[] = [];
          
          toolResults.forEach((result, index) => {
            const toolCall = planResult.toolCalls![index];
            
            if (result.status === 'fulfilled') {
              const { name, result: toolResult } = result.value;
              
              // Store first tool name for backward compatibility
              if (!toolName) {
                toolName = name;
                toolInput = toolCall.arguments;
              }
              
              // Update working memory with result
              workingMemory = {
                ...workingMemory,
                [`step_${currentStep}_${name}_${index}`]: toolResult,
              };
              
              const resultStr = typeof toolResult === 'string' 
                ? toolResult 
                : JSON.stringify(toolResult, null, 2);
              observations.push(`[${name}] ${resultStr}`);
              
              logger.info(`Tool executed successfully: ${name}`);
            } else {
              const errorMsg = result.reason instanceof Error 
                ? result.reason.message 
                : String(result.reason);
              errors.push(`[${toolCall.name}] Error: ${errorMsg}`);
              logger.error(`Tool execution failed: ${toolCall.name}`, result.reason);
            }
          });

          // Combine all observations and errors
          observation = [...observations, ...errors].join('\n\n');
          
          if (errors.length > 0 && observations.length === 0) {
            stepError = errors.join('; ');
          }
        }

        const stepDuration = Date.now() - stepStartTime;

        // Save step to database
        await db.insert(steps).values({
          id: generateStepId(),
          runId,
          stepNo: currentStep,
          thought: planResult.thought,
          toolName,
          toolInput,
          observation,
          durationMs: stepDuration,
          error: stepError,
          createdAt: new Date(),
        });

        // Update step history
        stepHistory.push({
          stepNo: currentStep,
          thought: planResult.thought,
          toolName,
          toolInput,
          observation,
        });

        // Update run progress
        await db.update(runs)
          .set({ 
            stepsExecuted: currentStep,
            workingMemory,
          })
          .where(eq(runs.id, runId));

        // Check if should finish
        if (planResult.shouldFinish) {
          logger.info('Agent decided to finish');
          break;
        }

        // If error, continue to next step (agent can recover)
      }

      // Generate final summary
      const summary = await planner.generateSummary({
        objective: goal.objective,
        workingMemory,
        stepHistory,
        stepsRemaining: 0,
        tools: toolDefinitions,
        temperature: goal.params?.temperature,
        maxTokens: goal.params?.maxTokens,
      });

      // Mark run as completed
      await db.update(runs)
        .set({ 
          status: 'completed',
          endedAt: new Date(),
          workingMemory: {
            ...workingMemory,
            summary,
          },
        })
        .where(eq(runs.id, runId));

      logger.info(`Run completed: ${runId}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Run failed: ${runId}`, error);

      // Mark run as failed
      await db.update(runs)
        .set({ 
          status: 'failed',
          endedAt: new Date(),
          error: errorMsg,
        })
        .where(eq(runs.id, runId));

      throw error;
    }
  }
}
