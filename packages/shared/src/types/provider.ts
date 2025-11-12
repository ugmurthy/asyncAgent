import type { ToolDefinition } from './tool.js';

export type LLMProviderType = 'openai' | 'openrouter' | 'ollama';

export interface LLMCallParams {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
  }>;
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  reasoning?: Record<string, any>;
}

export interface LLMResponse {
  thought: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  reasoning?: string;
}

export interface ChatParams {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
}

export interface LLMProvider {
  name: string;
  callWithTools(params: LLMCallParams): Promise<LLMResponse>;
  chat(params: ChatParams): Promise<ChatResponse>;
  validateToolCallSupport(model: string): Promise<{ 
    supported: boolean; 
    message?: string 
  }>;
}

export interface ProviderConfig {
  provider: LLMProviderType;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}
