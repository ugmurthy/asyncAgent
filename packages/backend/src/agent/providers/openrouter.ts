import OpenAI from 'openai';
import type { LLMProvider, LLMCallParams, LLMResponse } from '@async-agent/shared';
import { logger } from '../../util/logger.js';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/async-agent',
        'X-Title': 'Async Agent',
      },
    });
    this.model = model;
  }

  async validateToolCallSupport(model: string): Promise<{ supported: boolean; message?: string }> {
    try {
      // OpenRouter uses OpenAI-compatible API, most models support tool calling
      // We'll do a simple check by attempting to fetch model info
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.client.apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          supported: false,
          message: 'Unable to verify model capabilities with OpenRouter API',
        };
      }

      const data = await response.json() as { data?: Array<{ id: string }> };
      const modelExists = data.data?.some(m => m.id === model);

      if (!modelExists) {
        return {
          supported: false,
          message: `Model "${model}" not found in OpenRouter. Check available models at https://openrouter.ai/models`,
        };
      }

      // Assume tool calling is supported for most modern models
      return { supported: true };
    } catch (error) {
      logger.warn('OpenRouter validation check failed, proceeding anyway:', error);
      return { 
        supported: true,
        message: 'Could not verify model, proceeding with assumption of tool support',
      };
    }
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
      logger.debug(`call_with_tools : ${JSON.stringify({
        model: this.model,
        messages: params.messages as any,
        tools: params.tools as any,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2000,
      },null,2)}`)

      const choice = response.choices[0];
      const message = choice.message;

      const toolCalls = message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));
      const ret_val = {
        thought: message.content || '',
        toolCalls,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
      logger.debug(`call_with_tools : ${JSON.stringify(ret_val,null,2)}`)

      return {
        thought: message.content || '',
        toolCalls,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      logger.error('OpenRouter API call failed:', error);
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
