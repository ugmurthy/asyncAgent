import type { LLMProvider, LLMCallParams, LLMResponse, ChatParams, ChatResponse } from '@async-agent/shared';
import { logger } from '../../util/logger.js';

const BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60000;

// Minimal OpenAI-compatible types
type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAIChoice = {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string | null;
};

type OpenAIChatCompletionResponse = {
  id: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

type OpenAIErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
    param?: string;
  };
};

// Helper Functions

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'HTTP-Referer': 'https://github.com/async-agent',
    'X-Title': 'Async Agent',
  };
}

async function handleApiError(res: Response): Promise<never> {
  try {
    const body = await res.json() as OpenAIErrorResponse;
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).code = body?.error?.code;
    (err as any).type = body?.error?.type;
    throw err;
  } catch (parseError) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    (err as any).status = res.status;
    throw err;
  }
}

function mapFinishReason(reason?: string | null): LLMResponse['finishReason'] {
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

function jsonParseSafe(s: string): any {
  try {
    return JSON.parse(s);
  } catch (e) {
    logger.warn({ err: e, args: s }, 'Failed to parse tool call arguments; returning raw string');
    return s;
  }
}

function extractUsage(data: OpenAIChatCompletionResponse): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | undefined {
  if (!data.usage) return undefined;
  
  return {
    promptTokens: data.usage.prompt_tokens,
    completionTokens: data.usage.completion_tokens,
    totalTokens: data.usage.total_tokens,
  };
}



async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function openRouterFetch(
  endpoint: string,
  apiKey: string,
  options?: RequestInit
): Promise<Response> {
  return await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options?.headers,
    }
  });
}

// Main Provider Class

export class OpenRouterFetchProvider implements LLMProvider {
  name = 'openrouter-fetch';
  private apiKey: string;
  private model: string;
  private defaultMaxTokens: number;

  constructor(apiKey: string, model: string, defaultMaxTokens: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.defaultMaxTokens = defaultMaxTokens;
  }

  async extractGenerationId(data: OpenAIChatCompletionResponse, maxAttempts = 5, initialDelayMs = 500): Promise<any> {
    const generationId = data.id;
    logger.info({url:`${BASE_URL}/generation?id=${generationId}`}, 'Generation url')
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const delayMs = initialDelayMs * Math.pow(1.5, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        const res = await fetch(
          `${BASE_URL}/generation?id=${generationId}`,
          { headers: buildHeaders(this.apiKey) }
        );
        
        if (!res.ok) {
          if (attempt === maxAttempts) {
            logger.warn({ status: res.status, generationId, attempts: attempt }, 'Failed to fetch generation details after max attempts');
            return { error: 'Failed to fetch details' };
          }
          logger.debug({ status: res.status, generationId, attempt }, 'Generation not ready, retrying...');
          continue;
        }
        
        const details = await res.json();
        const data = details.data;
        logger.debug({ generationId, attempt }, 'Successfully fetched generation details');
        
        const stats: Record<string, any> = {};
        const allowedKeys = ['latency', 'model', 'generation_time', 'finish_reason', 'native_finish_reason', 'total_cost', 'id'];
        
        for (const key of allowedKeys) {
          if (data[key] !== undefined) {
            stats[key] = data[key];
          }
        }
        
        return {data:stats};
      } catch (error) {
        if (attempt === maxAttempts) {
          logger.warn({ err: error, generationId, attempts: attempt }, 'Error fetching generation details after max attempts');
          return { error: String(error) };
        }
        logger.debug({ err: error, generationId, attempt }, 'Error fetching generation, retrying...');
      }
    }
    
    return { error: 'Max attempts reached' };
  }

  async validateToolCallSupport(model: string): Promise<{ 'tools-supported': boolean; 'supported': boolean }> {
    logger.info({ model }, "Validating model tool support");
    try {
      const res = await openRouterFetch(`/parameters/${model}`, this.apiKey);
      
      if (!res.ok) {
        if (res.status === 404) {
          return { 'tools-supported': false, 'supported': false };
        }
        logger.warn({ status: res.status }, 'Unable to verify model capabilities');
        return { 'tools-supported': true, 'supported': false };
      }
      
      const data = await res.json() as { supported_parameters?: string[] };
      const toolsSupported = data.supported_parameters?.includes('tools') ?? false;
      logger.info({ 'tools-supported': toolsSupported, 'supported': true },'Validation result')
      logger.debug({ ...data},'Validation details')
      return { 'tools-supported': toolsSupported, 'supported': true };
    } catch (error) {
      logger.warn({ err: error }, 'OpenRouter validation check failed, assuming tool support');
      return { 'tools-supported': true, 'supported': false };
    }
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      
      const seed = params?.seed ? params?.seed:null
      const requestBody = {
        model: this.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      };
      if (seed) {
        requestBody.seed = seed;
      }
      
      const res = await fetchWithTimeout(
        `${BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: buildHeaders(this.apiKey),
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        await handleApiError(res);
      }

      const data = await res.json() as OpenAIChatCompletionResponse;
      
      const usage = extractUsage(data);

      const generation_stats = await this.extractGenerationId(data);
      
      if (usage) {
        logger.debug({ usage, generation_stats }, 'OpenRouter chat response metadata');
      }

      const content = data.choices[0]?.message?.content || '';
      return { content, usage, generation_stats };
    } catch (error) {
      logger.error({ err: error }, 'OpenRouter chat call failed');
      throw error;
    }
  }

  async callWithTools(params: LLMCallParams): Promise<LLMResponse> {
    try {
      const requestBody: any = {
        model: this.model,
        messages: params.messages,
        tools: params.tools,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      };

      // Add reasoning_effort if present in params.reasoning
      if (params.reasoning?.reasoning_effort) {
        requestBody.reasoning_effort = params.reasoning.reasoning_effort;
      }

      logger.debug({ requestBody }, 'OpenRouter callWithTools request');

      const res = await fetchWithTimeout(
        `${BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: buildHeaders(this.apiKey),
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        await handleApiError(res);
      }

      const data = await res.json() as OpenAIChatCompletionResponse;
      
      const usage = extractUsage(data);
      const generation_stats = await this.extractGenerationId(data);
      
      if (usage) {
        logger.debug({ usage, generation_stats }, 'OpenRouter callWithTools response metadata');
      }

      const choice = data.choices[0];
      if (!choice) {
        throw new Error('No choices in response');
      }

      const message = choice.message;
      const thought = message.content || '';

      const toolCalls = message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: jsonParseSafe(tc.function.arguments),
      }));

      const result: LLMResponse = {
        thought,
        toolCalls,
        finishReason: mapFinishReason(choice.finish_reason),
      };

      logger.debug({ result }, 'OpenRouter callWithTools response');

      return result;
    } catch (error) {
      logger.error({ err: error }, 'OpenRouter API call failed');
      throw error;
    }
  }
}
