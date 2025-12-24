import type { Logger } from '../util/logger.js';
import type { LLMProvider } from '@async-agent/shared';
import { generateId } from '@async-agent/shared';
import { ToolRegistry } from './tools/index.js';
import type { Database } from '../db/index.js';
import { dagExecutions, subSteps, agents, type SubStep } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { dagEventBus } from '../events/bus.js';
import { LlmExecuteTool } from '../agent/tools/llmExecute.js';

export interface SubTask {
  id: string;
  description: string;
  thought: string;
  action_type: 'tool' | 'inference';
  tool_or_prompt: {
    name: string;
    params?: Record<string, any>;
  };
  expected_output: string;
  dependencies: string[];
}

export interface DecomposerJob {
  original_request: string;
  title: string,
  intent: {
    primary: string;
    sub_intents: string[];
  };
  entities: Array<{
    entity: string;
    type: string;
    grounded_value: string;
  }>;
  sub_tasks: SubTask[];
  synthesis_plan: string;
  validation: {
    coverage: string;
    gaps: string[];
    iteration_triggers: string[];
  };
  clarification_needed: boolean;
  clarification_query?: string;
}

export interface DAGExecutorConfig {
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
  db: Database;
}

export interface GlobalContext {
  formatted: string;
  totalTasks: number;
}

export interface TaskExecutionResult {
  content: any;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  costUsd?: number;
  generationStats?: Record<string, any>;
}

export class DAGExecutor {
  constructor(private config: DAGExecutorConfig) {
    this.config.logger.info({
      provider: this.config.llmProvider.constructor.name,
      model: (this.config.llmProvider as any).model || 'unknown'
    }, 'DAGExecutor created');
  }

  private validate_sub_tasks(job: DecomposerJob): { 
    valid: boolean; 
    errors: Array<{ taskId: string; toolName: string; error: string }> 
  } {
    const errors: Array<{ taskId: string; toolName: string; error: string }> = [];

    for (const task of job.sub_tasks) {
      if (task.action_type === 'inference') {
        continue;
      }

      if (task.action_type === 'tool') {
        const tool = this.config.toolRegistry.get(task.tool_or_prompt.name);
        
        if (!tool) {
          errors.push({
            taskId: task.id,
            toolName: task.tool_or_prompt.name,
            error: `Tool not found in registry: ${task.tool_or_prompt.name}`
          });
          continue;
        }

        const params = task.tool_or_prompt.params || {};
        
        try {
          tool.inputSchema.parse(params);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            taskId: task.id,
            toolName: task.tool_or_prompt.name,
            error: `Schema validation failed: ${errorMessage}`
          });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
  
  private extractUrls(text: string): string[] {
    // Regular expression to match common URL patterns
    // Handles: http(s)://example.com, www.example.com, and paths/queries
    const urlRegex = /(https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    
    // Extract matches and filter out empty strings
    const matches = text.match(urlRegex) || [];
    
    // Optional: Prepend 'https://' to URLs without protocol for consistency
    return matches.map(url => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
      }
      return url;
    }).filter(url => url.length > 0);
  }

  private buildGlobalContext(job: DecomposerJob): GlobalContext {
    const entitiesStr = job.entities.length > 0
      ? job.entities.map(e => `• ${e.entity} (${e.type}): ${e.grounded_value}`).join('\n')
      : 'None';

    const formatted = `# Global Context
**Request:** ${job.original_request}
**Primary Intent:** ${job.intent.primary}
**Sub-intents:** ${job.intent.sub_intents.join('; ') || 'None'}
**Entities:**
${entitiesStr}
**Synthesis Goal:** ${job.synthesis_plan}`;

    return { formatted, totalTasks: job.sub_tasks.length };
  }

  private buildInferencePrompt(
    task: SubTask,
    globalContext: GlobalContext,
    taskResults: Map<string, any>
  ): string {
    const MAX_DEP_LENGTH = 2000;

    const depsStr = task.dependencies
      .filter(id => id !== 'none' && taskResults.has(id))
      .map(id => {
        const result = taskResults.get(id);
        const str = typeof result === 'string' ? result : JSON.stringify(result);
        return `[Task ${id}]: ${str.length > MAX_DEP_LENGTH ? str.slice(0, MAX_DEP_LENGTH) + '...' : str}`;
      })
      .join('\n\n') || 'None';

    return `You are an expert assistant executing a sub-task within a larger workflow.

${globalContext.formatted}

# Current Task [${task.id}/${globalContext.totalTasks}]
**Description:** ${task.description}
**Reasoning:** ${task.thought}
**Expected Output:** ${task.expected_output}

# Dependencies
${depsStr}

# Instruction
${task.tool_or_prompt.params?.prompt || task.description}

Respond with ONLY the expected output format. Build upon dependencies for coherence and align with the global context.`;
  }

  private resolveDependencies(
    params: Record<string, any>,
    taskResults: Map<string, any>,
    logger: Logger,
    tool: string
  ): { resolvedParams: Record<string, any>; singleDependency: any | null } {
    const resolvedParams = { ...params };
    let singleDependency: any = null;
    const DEPENDENCY_PATTERN = /<Results? (?:from|of) Task (\d+)>/g;

    for (const [key, value] of Object.entries(resolvedParams)) {
      // followig line commented 19/Nov/25
      // as params:urls sometime has an object (array) - we don't want that ignored 
      //if (typeof value !== 'string') continue;

      //const exactMatch = value.match(/^<Results? (?:from|of) Task (\d+)>$/);
      
      // if (exactMatch) {
      //   this.handleExactMatch(exactMatch, key, params, tool, taskResults, logger, resolvedParams, (result) => {
      //     singleDependency = result;
      //   });
      // } else if (value.match(DEPENDENCY_PATTERN)) {
      //   this.handleMultipleMatches(value, key, tool, taskResults, logger, resolvedParams);
      // }

      // Following check isn't necessary : coding agent glitch 19/Nov/25
      //if (value.match(DEPENDENCY_PATTERN)) {
         this.handleMultipleMatches(value, key, tool, taskResults, logger, resolvedParams);
      //}
      // experimental function to detect dependencies
      //const result=this.extractTaskNumbers(value);
      //if (result.length>0){
      //  logger.info({result},'result');
      //} 
    }

    //logger.debug({ resolvedParams, singleDependency }, 'resolvedParams, singleDependency');
    return { resolvedParams, singleDependency };
  }
// this function is not longer used but a good one for extracting task #'s
  private  extractTaskNumbers(text:string) {
    const results = [];

    // Helper to add a result
    const addResult = (numbers, matchedText) => {
        const sorted = [...new Set(numbers)].sort((a, b) => a - b);
        results.push({
            numbers: sorted,
            text: matchedText.trim()
        });
    };

    const seenTexts = new Set(); // avoid duplicates from overlapping matches

    // ──────────────────────────────────────────────────────────────
    // 1. Range patterns: "Task 1 to Task 5", "Tasks 3–7", "Task8-Task12"
    // ──────────────────────────────────────────────────────────────
    const rangeRegex = /\b(Task|Tasks)\b[\s\S]*?\b(\d+)\s*(?:to|through|[-–—−])\s*\b(\d+)\b/gi;
    let match;
    while ((match = rangeRegex.exec(text)) !== null) {
        const start = parseInt(match[2], 10);
        const end = parseInt(match[3], 10);
        const numbers = [];
        for (let i = start; i <= end; i++) numbers.push(i);

        const matchedText = match[0];
        if (!seenTexts.has(matchedText)) {
            seenTexts.add(matchedText);
            addResult(numbers, matchedText);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // 2. List patterns: "Task 1 and Task 3", "Tasks 2, 4, and 6", etc.
    // ──────────────────────────────────────────────────────────────
    const listRegex = /\b(Task|Tasks)[\s\S]*?\b(and|&)\b[\s\S]*?\b\d+\b/gi;
    while ((match = listRegex.exec(text)) !== null) {
        const segment = match[0];
        const numMatches = [...segment.matchAll(/\b\d+\b/g)];
        const numbers = numMatches.map(m => parseInt(m[0], 10));

        if (numbers.length >= 2) {
            if (!seenTexts.has(segment)) {
                seenTexts.add(segment);
                addResult(numbers, segment);
            }
        }
    }

    // ──────────────────────────────────────────────────────────────
    // 3. Single task: "Just Task 10", "Task15", etc.
    // ──────────────────────────────────────────────────────────────
    const singleRegex = /\b(Task|Tasks)\b[\s#:]*\b(\d+)\b(?![\s\S]*?(?:to|through|[-–—−]|and|&))/gi;
    while ((match = singleRegex.exec(text)) !== null) {
        const num = parseInt(match[2], 10);
        const matchedText = match[0].trim();
        if (!seenTexts.has(matchedText)) {
            seenTexts.add(matchedText);
            addResult([num], matchedText);
        }
    }

    return results;
}


  private handleExactMatch(
    exactMatch: RegExpMatchArray,
    key: string,
    params: Record<string, any>,
    tool: string,
    taskResults: Map<string, any>,
    logger: Logger,
    resolvedParams: Record<string, any>,
    setSingleDependency: (result: any) => void
  ): void {
    const depTaskId = exactMatch[1];
    const depResult = taskResults.get(depTaskId);
    
    if (depResult === undefined) return;

    const resultStr = typeof depResult === 'string' ? depResult : JSON.stringify(depResult);
    logger.debug(`╰─dependency ${key}`);
    logger.debug(`╰─dependency ${depTaskId}:${resultStr}`);
    
    const isSingleParam = Object.keys(params).length === 1 || (key === 'url' && Array.isArray(depResult));
    
    if (isSingleParam) {
      setSingleDependency(tool === 'fetchURLs' ? { [key]: depResult } : depResult);
    } else {
      resolvedParams[key] = depResult;
    }
  }

  private handleMultipleMatches(
    value: string,
    key: string,
    tool: string,
    taskResults: Map<string, any>,
    logger: Logger,
    resolvedParams: Record<string, any>
  ): void {
    const DEPENDENCY_PATTERN = /<Results? (?:from|of) Task (\d+)>/g;
    const matches = [...String(value).matchAll(DEPENDENCY_PATTERN)];
    
    logger.debug({matches},`╰─matches ${tool}`);

    if (tool === 'fetchURLs') {
      resolvedParams[key] = this.resolveFetchURLs(matches, key, taskResults, logger);
    } else {
      resolvedParams[key] = this.resolveStringReplacements(value, matches, key, taskResults, logger);
    }
  }

  private resolveFetchURLs(
    matches: RegExpMatchArray[],
    key: string,
    taskResults: Map<string, any>,
    logger: Logger
  ): string[] {
    const urlArray: string[] = [];

    for (const match of matches) {
      const depTaskId = match[1];
      const depResult = taskResults.get(depTaskId);
      
      const urls = Array.isArray(depResult)
        ? depResult.map((obj) => obj.url).filter(Boolean)
        : typeof depResult === 'string'
        ? this.extractUrls(depResult)
        : [];

      if (urls.length) {
        urlArray.push(...urls);
      }
      
      logger.info(`╰─dependency reference in '${key}': Task ${depTaskId} - URLs`);
    }

    return urlArray;
  }

  private resolveStringReplacements(
    value: string,
    matches: RegExpMatchArray[],
    key: string,
    taskResults: Map<string, any>,
    logger: Logger
  ): string {
    let resolvedValue = value;

    for (const match of matches) {
      const depTaskId = match[1];
      const depResult = taskResults.get(depTaskId);
      
      if (depResult !== undefined) {
        const replacementValue = typeof depResult === 'string' ? depResult : JSON.stringify(depResult);
        resolvedValue = resolvedValue.replace(match[0], replacementValue);
        logger.info(`  ╰─dependency reference in '${key}': Task ${depTaskId} - string replacements`);
      }
    }

    return resolvedValue;
  }

  async execute(job: DecomposerJob, executionId?: string, dagId?: string, originalRequest?: string): Promise<string> {
    const { logger, llmProvider, toolRegistry, db } = this.config;
    // Use provided originalRequest (from DAG params) or fall back to job.original_request
    const effectiveOriginalRequest = originalRequest || job.original_request;

    if (job.clarification_needed) {
      throw new Error(`Clarification needed: ${job.clarification_query}`);
    }

    const execId = executionId || generateId('dag-exec');
    const startTime = Date.now();
    const isResuming = !!executionId;

    logger.info( { 
      executionId: execId,
      dagId,
      totalTasks: job.sub_tasks.length,
      primaryIntent: job.intent.primary,
      isResuming 
    }, isResuming ? 'Resuming DAG execution' : 'Starting DAG execution');

    try {
      // Check if execution record already exists
      const existingExecution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, execId),
      });

      if (isResuming) {
        // When resuming, verify sub-steps exist
        const existingSubSteps = await db.query.subSteps.findMany({
          where: eq(subSteps.executionId, execId),
        });

        if (!existingSubSteps || existingSubSteps.length === 0) {
          throw new Error(
            `Cannot resume execution '${execId}': No sub-steps found. ` +
            `The execution may not have been properly initialized or all sub-tasks were already completed.`
          );
        }

        logger.info({ 
          executionId: execId, 
          subStepsCount: existingSubSteps.length 
        }, 'Resuming execution with existing sub-steps');

        // Update execution status to running
        await db.update(dagExecutions)
          .set({ status: 'running', startedAt: new Date() })
          .where(eq(dagExecutions.id, execId));

        dagEventBus.emit('dag:event', {
          type: 'execution.resumed',
          executionId: execId,
          timestamp: Date.now(),
          totalTasks: existingSubSteps.length,
        });
      } else if (existingExecution) {
        // Execution record already exists (created by route), just update status to running
        logger.info({ executionId: execId }, 'Using existing execution record, updating to running');
        
        await db.update(dagExecutions)
          .set({ status: 'running', startedAt: new Date() })
          .where(eq(dagExecutions.id, execId));

        dagEventBus.emit('dag:event', {
          type: 'execution.started',
          executionId: execId,
          timestamp: Date.now(),
          totalTasks: job.sub_tasks.length,
          originalRequest: effectiveOriginalRequest,
        });
      } else {
        // Create new execution (fallback for backward compatibility)
        await db.insert(dagExecutions).values({
          id: execId,
          dagId: dagId || null,
          originalRequest: effectiveOriginalRequest,
          primaryIntent: job.intent.primary,
          status: 'running',
          totalTasks: job.sub_tasks.length,
          startedAt: new Date(),
        });

        await db.insert(subSteps).values(
          job.sub_tasks.map(task => ({
            id: generateId('sub-step'),
            executionId: execId,
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

        dagEventBus.emit('dag:event', {
          type: 'execution.created',
          executionId: execId,
          timestamp: Date.now(),
          totalTasks: job.sub_tasks.length,
          originalRequest: effectiveOriginalRequest,
        });

        logger.info({ executionId: execId }, 'DAG execution record created');
      }
    } catch (dbError) {
      logger.error({ err: dbError, executionId: execId }, 'Failed to create/resume DAG execution record');
      throw dbError;
    }

    const taskResults = new Map<string, any>();
    const executedTasks = new Set<string>();
    const globalContext = this.buildGlobalContext(job);

    try {
      const canExecute = (task: SubTask): boolean => {
        if (task.dependencies.length === 0 || task.dependencies.includes('none')) {
          return true;
        }
        return task.dependencies.every(dep => executedTasks.has(dep));
      };

    const executeTask = async (task: SubTask): Promise<TaskExecutionResult> => {
      const taskStartTime = Date.now();
      logger.info({id:task.id,description:task.description},`Executing sub-task`);
      logger.info({tool_or_prompt:task.tool_or_prompt},`╰─task_or_prompt`)
      
      await db.update(subSteps)
        .set({ status: 'running', startedAt: new Date() })
        .where(and(
          eq(subSteps.taskId, task.id),
          eq(subSteps.executionId, execId)
        ));

      dagEventBus.emit('dag:event', {
        type: 'substep.started',
        executionId: execId,
        subStepId: task.id,
        taskId: parseInt(task.id),
        timestamp: Date.now(),
        description: task.description,
      });

      if (task.action_type === 'tool' && task.tool_or_prompt.name !== 'inference') {
        const tool = toolRegistry.get(task.tool_or_prompt.name);
        if (!tool) {
          throw new Error(`Tool not found: ${task.tool_or_prompt.name}`);
        }

        const params = task.tool_or_prompt.params || {};
        const { resolvedParams, singleDependency } = this.resolveDependencies(params, taskResults, logger,task.tool_or_prompt.name);
        const validatedInput = tool.inputSchema.parse(singleDependency !== null ? singleDependency : resolvedParams);

        const result = await tool.execute(validatedInput, {
          logger,
          runId: `dag-${Date.now()}`,
          abortSignal: new AbortController().signal,
        });

        return { content: result };
      } else if (task.action_type === 'inference' || task.tool_or_prompt.name === 'inference') {
        const fullPrompt = this.buildInferencePrompt(task, globalContext, taskResults);
        const agentName = task.tool_or_prompt.name;
        const agent = await db.query.agents.findFirst({
          where: eq(agents.name, agentName),
        });

        if (!agent) {
          throw new Error(`No agent found with name: ${agentName}`);
        }

        const llmExecuteTool = new LlmExecuteTool();

        const result = await llmExecuteTool.execute({
          provider: agent.provider as 'openai' | 'openrouter' | 'openrouter-fetch' | 'ollama',
          model: agent.model,
          task: agent.promptTemplate,
          prompt: fullPrompt,
        }, {
          db,
          logger,
          runId: `dag-${Date.now()}`,
          abortSignal: new AbortController().signal,
        });

        return {
          content: result.content,
          usage: result.usage,
          costUsd: result.costUsd,
          generationStats: result.generationStats,
        };
      }

      throw new Error(`Unknown action type: ${task.action_type}`);
    };

    while (executedTasks.size < job.sub_tasks.length) {
      const readyTasks = job.sub_tasks.filter(
        task => !executedTasks.has(task.id) && canExecute(task)
      );

      if (readyTasks.length === 0) {
        const remaining = job.sub_tasks.filter(task => !executedTasks.has(task.id));
        throw new Error(
          `DAG execution deadlock. Remaining tasks: ${remaining.map(t => t.id).join(', ')}`
        );
      }

      await Promise.all(
        readyTasks.map(async (task) => {
          const taskStartTime = Date.now();
          try {
            const execResult = await executeTask(task);
            taskResults.set(task.id, execResult.content);
            executedTasks.add(task.id);
            
            const serializedResult = typeof execResult.content === 'string' 
              ? execResult.content 
              : JSON.stringify(execResult.content);
            
            logger.debug({taskId: task.id, result: serializedResult},`╰─task ${task.id} result after executeTask():`)
            
            await db.update(subSteps)
              .set({ 
                status: 'completed',
                result: serializedResult,
                completedAt: new Date(),
                durationMs: Date.now() - taskStartTime,
                usage: execResult.usage,
                costUsd: execResult.costUsd?.toString(),
                generationStats: execResult.generationStats,
              })
              .where(and(
                eq(subSteps.taskId, task.id),
                eq(subSteps.executionId, execId)
              ));

            dagEventBus.emit('dag:event', {
              type: 'substep.completed',
              executionId: execId,
              subStepId: task.id,
              taskId: parseInt(task.id),
              timestamp: Date.now(),
              durationMs: Date.now() - taskStartTime,
              result: serializedResult,
            });
            
            logger.info(`Task ${task.id} completed successfully`);
          } catch (error) {
            logger.error({ err: error }, `Task ${task.id} failed`);
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            await db.update(subSteps)
              .set({ 
                status: 'failed',
                error: errorMessage,
                completedAt: new Date(),
                durationMs: Date.now() - taskStartTime,
              })
              .where(and(
                eq(subSteps.taskId, task.id),
                eq(subSteps.executionId, execId)
              ));

            dagEventBus.emit('dag:event', {
              type: 'substep.failed',
              executionId: execId,
              subStepId: task.id,
              taskId: parseInt(task.id),
              timestamp: Date.now(),
              error: errorMessage,
            });
            
            throw error;
          }
        })
      );
    }

    logger.info('All tasks completed, running synthesis');

    const synthesisResult = await this.synthesize(
      job.synthesis_plan,
      taskResults,
      llmProvider,
      logger,
      execId,
      db
    );

    logger.info('Synthesis completed, running validation');

    const validatedResult = await this.validate(synthesisResult.content, logger);

    const allSubSteps = await db.query.subSteps.findMany({
      where: eq(subSteps.executionId, execId),
    });

    const statusData = this.deriveExecutionStatus(allSubSteps);

    const totalUsage = this.aggregateUsage(allSubSteps);
    const totalCostUsd = this.aggregateCost(allSubSteps);

    await db.update(dagExecutions)
      .set({
        status: statusData.status,
        completedTasks: statusData.completedTasks,
        failedTasks: statusData.failedTasks,
        waitingTasks: statusData.waitingTasks,
        finalResult: validatedResult,
        synthesisResult: synthesisResult.content,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        totalUsage,
        totalCostUsd: totalCostUsd?.toString(),
      })
      .where(eq(dagExecutions.id, execId));

    if (statusData.status === 'completed' || statusData.status === 'partial') {
      dagEventBus.emit('dag:event', {
        type: 'execution.completed',
        executionId: execId,
        timestamp: Date.now(),
        status: statusData.status,
        completedTasks: statusData.completedTasks,
        failedTasks: statusData.failedTasks,
        durationMs: Date.now() - startTime,
        finalResult: validatedResult,
      });
    } else if (statusData.status === 'failed') {
      dagEventBus.emit('dag:event', {
        type: 'execution.failed',
        executionId: execId,
        timestamp: Date.now(),
        error: 'Execution failed',
        completedTasks: statusData.completedTasks,
        failedTasks: statusData.failedTasks,
      });
    }

      logger.info({ executionId: execId, status: statusData.status }, 'DAG execution completed');

      return validatedResult;
    } catch (error) {
      await this.suspendExecution(execId, error);
      throw error;
    }
  }

  private async suspendExecution(executionId: string, error: unknown): Promise<void> {
    const { db, logger } = this.config;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({ executionId, err: error }, 'Suspending execution due to error');
    
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

  private deriveExecutionStatus(subSteps: SubStep[]): {
    status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'partial';
    completedTasks: number;
    failedTasks: number;
    waitingTasks: number;
  } {
    const completed = subSteps.filter(s => s.status === 'completed').length;
    const failed = subSteps.filter(s => s.status === 'failed').length;
    const running = subSteps.filter(s => s.status === 'running').length;
    const waiting = subSteps.filter(s => s.status === 'waiting').length;
    const total = subSteps.length;

    let status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'partial';
    
    if (waiting > 0) {
      status = 'waiting';
    } else if (failed > 0 && completed + failed === total) {
      status = failed === total ? 'failed' : 'partial';
    } else if (completed === total) {
      status = 'completed';
    } else if (running > 0 || completed > 0) {
      status = 'running';
    } else {
      status = 'pending';
    }

    return { status, completedTasks: completed, failedTasks: failed, waitingTasks: waiting };
  }

  private async synthesize(
    plan: string,
    taskResults: Map<string, any>,
    llmProvider: LLMProvider,
    logger: Logger,
    executionId: string,
    db: Database
  ): Promise<TaskExecutionResult> {
    const context = Array.from(taskResults.entries())
      .map(([taskId, result]) => {
        const resultStr = typeof result === 'string' 
          ? result 
          : JSON.stringify(result, null, 2);
        return `Task ${taskId} result:\n${resultStr}`;
      })
      .join('\n\n');

    const synthesisPrompt = `${plan}

Available task results:
${context}

Generate the final report in Markdown format as specified in the synthesis plan.`;

    const startTime = Date.now();
    
    const response = await llmProvider.chat({
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant that synthesizes information into well-formatted Markdown reports.' 
        },
        { role: 'user', content: synthesisPrompt }
      ],
      temperature: 0.5,
    });

    const synthesisSubStepId = generateId('sub-step');
    await db.insert(subSteps).values({
      id: synthesisSubStepId,
      executionId,
      taskId: '__SYNTHESIS__',
      description: 'Final synthesis of all task results',
      thought: 'Aggregating results into final output',
      actionType: 'inference',
      toolOrPromptName: '__synthesis__',
      toolOrPromptParams: { taskCount: taskResults.size },
      dependencies: Array.from(taskResults.keys()),
      status: 'completed',
      startedAt: new Date(startTime),
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
      usage: response.usage,
      costUsd: response.costUsd?.toString(),
      generationStats: response.generationStats,
      result: response.content,
    });

    logger.debug({ synthesisSubStepId, usage: response.usage, costUsd: response.costUsd }, 'Synthesis sub-step created');

    return {
      content: response.content,
      usage: response.usage,
      costUsd: response.costUsd,
      generationStats: response.generationStats,
    };
  }

  private async validate(
    output: string,
    logger: Logger
  ): Promise<string> {
    logger.info('Validation step (pass-through)');
    return output;
  }

  private aggregateUsage(allSubSteps: SubStep[]): { promptTokens: number; completionTokens: number; totalTokens: number } | null {
    let hasUsage = false;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for (const step of allSubSteps) {
      if (step.usage) {
        hasUsage = true;
        promptTokens += step.usage.promptTokens ?? 0;
        completionTokens += step.usage.completionTokens ?? 0;
        totalTokens += step.usage.totalTokens ?? 0;
      }
    }

    return hasUsage ? { promptTokens, completionTokens, totalTokens } : null;
  }

  private aggregateCost(allSubSteps: SubStep[]): number | null {
    let totalCost = 0;
    let hasCost = false;

    for (const step of allSubSteps) {
      if (step.costUsd) {
        hasCost = true;
        totalCost += parseFloat(step.costUsd);
      }
    }

    return hasCost ? totalCost : null;
  }
}
