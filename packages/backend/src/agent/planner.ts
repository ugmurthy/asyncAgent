import type { LLMProvider, LLMCallParams, ToolDefinition } from '@async-agent/shared';
import type { Logger } from '../util/logger.js';
import { env } from '../util/env.js';

export interface PlannerContext {
  objective: string;
  workingMemory: Record<string, any>;
  stepHistory: Array<{
    stepNo: number;
    thought: string;
    toolName?: string;
    toolInput?: Record<string, any>;
    observation?: string;
  }>;
  stepsRemaining: number;
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  constraints?: string | string[];
}

export interface PlannerResult {
  thought: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  shouldFinish: boolean;
}

export class AgentPlanner {
  constructor(
    private llmProvider: LLMProvider,
    private logger: Logger,
    private promptTemplate?: string
  ) {}

  async plan(context: PlannerContext): Promise<PlannerResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context);

    this.logger.debug('Planning next step', {
      objective: context.objective,
      stepsRemaining: context.stepsRemaining,
      historyLength: context.stepHistory.length,
    });

    try {
      const temperature = context.temperature ?? parseFloat(env.DEFAULT_TEMPERATURE);
      const maxTokens = context.maxTokens ?? parseInt(env.DEFAULT_MAX_TOKENS);

      const response = await this.llmProvider.callWithTools({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: context.tools,
        temperature,
        maxTokens,
      });

      const shouldFinish = 
        (response.finishReason === 'stop' && (!response.toolCalls || response.toolCalls.length === 0)) ||
        context.stepsRemaining <= 0;

      return {
        thought: response.thought,
        toolCalls: response.toolCalls,
        shouldFinish,
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Planning failed');
      throw error;
    }
  }

  private buildSystemPrompt(context: PlannerContext): string {
    const toolsList = context.tools
      .map(t => `- ${t.function.name}: ${t.function.description}`)
      .join('\n');
    
    const workingMemory = JSON.stringify(context.workingMemory, null, 2);
    
    const constraintsText = context.constraints
      ? Array.isArray(context.constraints)
        ? context.constraints.map(c => `- ${c}`).join('\n')
        : context.constraints
      : '';
    
    const currentDate = new Date().toLocaleString();

    this.logger.debug('Prompt template placeholder values:', {
      usingCustomTemplate: !!this.promptTemplate,
      objective: context.objective,
      toolsList,
      stepsRemaining: context.stepsRemaining,
    workingMemory,
    constraints: constraintsText,
    currentDate,
    });

    if (this.promptTemplate) {
      // Check for unknown placeholders
      const knownPlaceholders = ['objective', 'toolsList', 'stepsRemaining', 'workingMemory', 'constraints', 'currentDate'];
      const placeholderPattern = /\{\{(\w+)\}\}/g;
      const foundPlaceholders = new Set<string>();
      let match;

      while ((match = placeholderPattern.exec(this.promptTemplate)) !== null) {
      foundPlaceholders.add(match[1]);
      }

      const unknownPlaceholders = Array.from(foundPlaceholders).filter(
      p => !knownPlaceholders.includes(p)
      );

      if (unknownPlaceholders.length > 0) {
        this.logger.warn('Unknown placeholders found in prompt template:', {
      unknownPlaceholders,
      knownPlaceholders,
      });
      }

      return this.promptTemplate
        .replace(/\{\{objective\}\}/g, context.objective)
        .replace(/\{\{toolsList\}\}/g, toolsList)
      .replace(/\{\{stepsRemaining\}\}/g, String(context.stepsRemaining))
      .replace(/\{\{workingMemory\}\}/g, workingMemory)
      .replace(/\{\{constraints\}\}/g, constraintsText)
      .replace(/\{\{currentDate\}\}/g, currentDate);
    }
    
    const constraintsSection = constraintsText
      ? `\nConstraints:\n${constraintsText}\n`
      : '';
    
    return `You are an autonomous AI agent designed to achieve goals by breaking them down into steps and using available tools.

Your objective: ${context.objective}

Available tools:
${context.tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n')}

Guidelines:
1. Think step-by-step to achieve the objective
2. Use tools to gather information, perform actions, and generate outputs
3. Keep track of what you've learned in working memory
4. When you have sufficient information or completed the task, provide a final summary
5. Be concise and focused on the objective
6. You have ${context.stepsRemaining} steps remaining in your budget
${constraintsSection}
Working memory (your scratchpad):
${JSON.stringify(context.workingMemory, null, 2)}`;
  }

  private buildUserPrompt(context: PlannerContext): string {
    if (context.stepHistory.length === 0) {
      return `This is the start of your task. Plan your first step to achieve the objective.`;
    }

    const recentSteps = context.stepHistory.slice(-3);
    const stepsText = recentSteps
      .map(step => {
        let text = `Step ${step.stepNo}: ${step.thought}`;
        if (step.toolName && step.observation) {
          text += `\nTool used: ${step.toolName}\nResult: ${step.observation.slice(0, 500)}`;
        }
        return text;
      })
      .join('\n\n');

    return `Recent steps:
${stepsText}

Based on what you've learned, what should be your next step? 
If you have enough information to complete the objective, provide a final summary and finish.`;
  }

  async generateSummary(context: PlannerContext): Promise<string> {
    const summaryPrompt = `Given the following objective and execution history, provide a concise summary of what was accomplished:

Objective: ${context.objective}

Execution history:
${context.stepHistory.map(s => `- Step ${s.stepNo}: ${s.thought}${s.observation ? `\n  Result: ${s.observation.slice(0, 200)}` : ''}`).join('\n')}

Working memory:
${JSON.stringify(context.workingMemory, null, 2)}

Provide a clear, concise summary of what was accomplished and any key findings or outputs.`;

    try {
      const temperature = context.temperature ?? parseFloat(env.DEFAULT_TEMPERATURE);
      const maxTokens = context.maxTokens ?? parseInt(env.DEFAULT_MAX_TOKENS);

      const response = await this.llmProvider.callWithTools({
        messages: [
          { role: 'user', content: summaryPrompt },
        ],
        tools: [],
        temperature: temperature * 0.7,
        maxTokens: Math.floor(maxTokens / 2),
      });

      return response.thought;
    } catch (error) {
      this.logger.error({ err: error }, 'Summary generation failed');
      return 'Summary generation failed. See execution history for details.';
    }
  }
}
