import { Ollama } from 'ollama';
import type { LLMProvider, LLMCallParams, LLMResponse, ChatParams, ChatResponse } from '@async-agent/shared';
import { validateOllamaModel } from './validator.js';
import { logger } from '../../util/logger.js';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private client: Ollama;
  private model: string;
  private defaultMaxTokens: number;

  constructor(baseUrl: string, model: string, defaultMaxTokens: number) {
    this.client = new Ollama({ host: baseUrl });
    this.model = model;
    this.defaultMaxTokens = defaultMaxTokens;
  }

  async validateToolCallSupport(model: string): Promise<{ supported: boolean; message?: string }> {
    // First check if model is in known list
    const knownCheck = validateOllamaModel(model);
    
    try {
      // Test if Ollama server is accessible and model exists
      const models = await this.client.list();
      const modelExists = models.models.some(m => m.name.includes(model));

      if (!modelExists) {
        return {
          supported: false,
          message: `Model "${model}" not found in Ollama. Run: ollama pull ${model}`,
        };
      }

      // Attempt a test call with tools
      const testResponse = await this.client.chat({
        model,
        messages: [{ role: 'user', content: 'test' }],
        tools: [{
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
        }],
      });

      return { supported: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('connection') || errorMsg.includes('ECONNREFUSED')) {
        return {
          supported: false,
          message: 'Ollama server is not running. Start it with: ollama serve',
        };
      }

      if (errorMsg.includes('does not support tools')) {
        return {
          supported: false,
          message: `Model "${model}" does not support tool calling. Try: mistral, mixtral, or llama3`,
        };
      }

      logger.warn('Ollama validation warning:', errorMsg);
      return {
        supported: knownCheck.supported,
        message: knownCheck.message || `Validation test failed: ${errorMsg}`,
      };
    }
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      const response = await this.client.chat({
        model: this.model,
        messages: params.messages.map(m => ({
          role: m.role as any,
          content: m.content,
        })),
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens ?? this.defaultMaxTokens,
        },
      });

      return { content: response.message.content || '' };
    } catch (error) {
      logger.error({ err: error }, 'Ollama chat call failed');
      throw error;
    }
  }

  async callWithTools(params: LLMCallParams): Promise<LLMResponse> {
    try {
      const response = await this.client.chat({
        model: this.model,
        messages: params.messages.map(m => ({
          role: m.role as any,
          content: m.content,
        })),
        tools: params.tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        })),
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens ?? this.defaultMaxTokens,
        },
      });

      const toolCalls = response.message.tool_calls?.map(tc => ({
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: tc.function.name,
        arguments: tc.function.arguments as Record<string, any>,
      }));

      return {
        thought: response.message.content || '',
        toolCalls,
        finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      logger.error({ err: error }, 'Ollama API call failed');
      throw error;
    }
  }
}
