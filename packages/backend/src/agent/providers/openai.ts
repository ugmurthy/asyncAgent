import OpenAI from 'openai';
import type { LLMProvider, LLMCallParams, LLMResponse } from '@async-agent/shared';
import { validateOpenAIModel } from './validator.js';
import { logger } from '../../util/logger.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async validateToolCallSupport(model: string): Promise<{ supported: boolean; message?: string }> {
    return validateOpenAIModel(model);
  }

  async callWithTools(params: LLMCallParams): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: params.messages as any,
        tools: params.tools as any,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2000,
        
      });

      const choice = response.choices[0];
      const message = choice.message;

      const toolCalls = message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        thought: message.content || '',
        toolCalls,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      logger.error('OpenAI API call failed:', error);
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
