import OpenAI from 'openai';
import type { LLMProvider, LLMCallParams, LLMResponse, LLMResponseWithUsage, ChatParams, ChatResponse, UsageInfo } from '@async-agent/shared';
import { validateOpenAIModel } from './validator.js';
import { logger } from '../../util/logger.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;

  constructor(apiKey: string, model: string, defaultMaxTokens: number) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.defaultMaxTokens = defaultMaxTokens;
  }

  async validateToolCallSupport(model: string): Promise<{ supported: boolean; message?: string }> {
    return validateOpenAIModel(model);
  }

  private extractUsage(response: OpenAI.Chat.Completions.ChatCompletion): UsageInfo | undefined {
    if (!response.usage) return undefined;
    return {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: params.messages as any,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      });

      const content = response.choices[0].message.content || '';
      const usage = this.extractUsage(response);
      
      if (usage) {
        logger.debug({ usage }, 'OpenAI chat response usage');
      }

      return { content, usage };
    } catch (error) {
      logger.error({ err: error }, 'OpenAI chat call failed');
      throw error;
    }
  }

  async callWithTools(params: LLMCallParams): Promise<LLMResponseWithUsage> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: params.messages as any,
        tools: params.tools as any,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      });

      const choice = response.choices[0];
      const message = choice.message;
      const usage = this.extractUsage(response);

      if (usage) {
        logger.debug({ usage }, 'OpenAI callWithTools response usage');
      }

      const toolCalls = message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        thought: message.content || '',
        toolCalls,
        finishReason: this.mapFinishReason(choice.finish_reason),
        usage,
      };
    } catch (error) {
      logger.error({ err: error }, 'OpenAI API call failed');
      throw error;
    }
  }

  private mapFinishReason(reason: string | null | undefined): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
