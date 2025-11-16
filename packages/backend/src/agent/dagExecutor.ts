import type { Logger } from '../util/logger.js';
import type { LLMProvider } from '@async-agent/shared';
import { ToolRegistry } from './tools/index.js';

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
      if (typeof value !== 'string') continue;

      //const exactMatch = value.match(/^<Results? (?:from|of) Task (\d+)>$/);
      
      // if (exactMatch) {
      //   this.handleExactMatch(exactMatch, key, params, tool, taskResults, logger, resolvedParams, (result) => {
      //     singleDependency = result;
      //   });
      // } else if (value.match(DEPENDENCY_PATTERN)) {
      //   this.handleMultipleMatches(value, key, tool, taskResults, logger, resolvedParams);
      // }

      if (value.match(DEPENDENCY_PATTERN)) {
         this.handleMultipleMatches(value, key, tool, taskResults, logger, resolvedParams);
      }
      
    }

    //logger.debug({ resolvedParams, singleDependency }, 'resolvedParams, singleDependency');
    return { resolvedParams, singleDependency };
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
    logger.info(`╰─dependency ${key}`);
    logger.info(`╰─dependency ${depTaskId}:${resultStr}`);
    
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
    const matches = [...value.matchAll(DEPENDENCY_PATTERN)];
    
    //logger.info(`╰─tool ${tool}`);

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

  async execute(job: DecomposerJob): Promise<string> {
    const { logger, llmProvider, toolRegistry } = this.config;

    if (job.clarification_needed) {
      throw new Error(`Clarification needed: ${job.clarification_query}`);
    }

    logger.info( { 
      totalTasks: job.sub_tasks.length,
      primaryIntent: job.intent.primary 
    },'Starting DAG execution');

   
    const taskResults = new Map<string, any>();
    const executedTasks = new Set<string>();

    const canExecute = (task: SubTask): boolean => {
      if (task.dependencies.length === 0 || task.dependencies.includes('none')) {
        return true;
      }
      return task.dependencies.every(dep => executedTasks.has(dep));
    };

    const executeTask = async (task: SubTask): Promise<any> => {
      logger.info({id:task.id,description:task.description},`Executing sub-task`);
      logger.info({tool_or_prompt:task.tool_or_prompt},`╰─task_or_prompt`)
      if (task.action_type === 'tool') {
        logger.info({action_type:task.action_type,name:task.tool_or_prompt.name},' ╰─action_type,tool')
        const tool = toolRegistry.get(task.tool_or_prompt.name);
        // @TODO : Validate sub-task 
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

        return result;
      } else if (task.action_type === 'inference') {
        const params = task.tool_or_prompt.params || {};
        const { resolvedParams } = this.resolveDependencies(params, taskResults, logger);

        const promptText = resolvedParams.prompt || task.description;
        
        const context: Record<string, any> = {};
        for (const depId of task.dependencies) {
          if (depId !== 'none' && taskResults.has(depId)) {
            context[`task_${depId}`] = taskResults.get(depId);
          }
        }

        const contextStr = Object.entries(context)
          .map(([key, value]) => `${key}: ${JSON.stringify(value, null, 2)}`)
          .join('\n\n');

        const fullPrompt = `${promptText}\n\nContext from previous tasks:\n${contextStr}`;

        const response = await llmProvider.chat({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.7,
        });

        return response.content;
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
          try {
            const result = await executeTask(task);
            taskResults.set(task.id, result);
            executedTasks.add(task.id);
            logger.info(`Task ${task.id} completed successfully`);
          } catch (error) {
            logger.error({ err: error }, `Task ${task.id} failed`);
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
      logger
    );

    logger.info('Synthesis completed, running validation');

    const validatedResult = await this.validate(synthesisResult, logger);

    return validatedResult;
  }

  private async synthesize(
    plan: string,
    taskResults: Map<string, any>,
    llmProvider: LLMProvider,
    logger: Logger
  ): Promise<string> {
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

    return response.content;
  }

  private async validate(
    output: string,
    logger: Logger
  ): Promise<string> {
    logger.info('Validation step (pass-through)');
    return output;
  }
}
