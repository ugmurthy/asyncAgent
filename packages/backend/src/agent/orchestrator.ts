import type { Database } from '../db/client.js';
import type { Logger } from '../util/logger.js';
import type { LLMProvider } from '@async-agent/shared';
import { generateStepId } from '@async-agent/shared';
import { AgentPlanner } from './planner.js';
import { ToolRegistry } from './tools/index.js';
import { runs, steps } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface OrchestratorConfig {
  db: Database;
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
}

export class AgentOrchestrator {
  private planner: AgentPlanner;

  constructor(private config: OrchestratorConfig) {
    this.planner = new AgentPlanner(config.llmProvider, config.logger);
  }

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

      // Update run status to running
      await db.update(runs)
        .set({ 
          status: 'running', 
          startedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      const goal = run.goal;
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
        const planResult = await this.planner.plan({
          objective: goal.objective,
          workingMemory,
          stepHistory,
          stepsRemaining,
          tools: toolDefinitions,
        });

        const stepStartTime = Date.now();

        // Record thought
        let observation: string | undefined;
        let toolName: string | undefined;
        let toolInput: Record<string, any> | undefined;
        let stepError: string | undefined;

        // Execute tool calls if any
        if (planResult.toolCalls && planResult.toolCalls.length > 0) {
          const toolCall = planResult.toolCalls[0]; // Execute first tool call
          toolName = toolCall.name;
          toolInput = toolCall.arguments;

          logger.info(`Executing tool: ${toolName}`, toolInput);

          try {
            const tool = toolRegistry.get(toolName);
            if (!tool) {
              throw new Error(`Tool not found: ${toolName}`);
            }

            // Validate input
            const validatedInput = tool.inputSchema.parse(toolInput);

            // Execute tool
            const result = await tool.execute(validatedInput, {
              logger,
              db,
              runId,
              abortSignal: abortController.signal,
            });

            observation = typeof result === 'string' 
              ? result 
              : JSON.stringify(result, null, 2);

            // Update working memory with result
            workingMemory = {
              ...workingMemory,
              [`step_${currentStep}_${toolName}`]: result,
            };

          } catch (error) {
            stepError = error instanceof Error ? error.message : String(error);
            observation = `Error: ${stepError}`;
            logger.error(`Tool execution failed:`, error);
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
      const summary = await this.planner.generateSummary({
        objective: goal.objective,
        workingMemory,
        stepHistory,
        stepsRemaining: 0,
        tools: toolDefinitions,
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

      // TODO: Send webhook notification if configured
      if (goal.webhookUrl) {
        logger.info(`Webhook notification skipped (not implemented yet)`);
      }

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
