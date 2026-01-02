import type { LLMProvider, ProviderConfig } from '@async-agent/shared';
import { OpenAIProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
import { OpenRouterFetchProvider } from './openrouter-fetch.js';
import { OllamaProvider } from './ollama.js';
import { env } from '../../util/env.js';
import { logger } from '../../util/logger.js';

export function createLLMProvider(config?: ProviderConfig): LLMProvider {
  const provider = config?.provider || env.LLM_PROVIDER;
  
  switch (provider) {
    case 'openai': {
      const apiKey = config?.apiKey || env.OPENAI_API_KEY;
      const model = config?.model || env.OPENAI_MODEL || env.LLM_MODEL;
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for OpenAI provider');
      }
      
      return new OpenAIProvider(apiKey, model, parseInt(env.DEFAULT_MAX_TOKENS));
    }

    case 'openrouter': {
      const apiKey = config?.apiKey || env.OPENROUTER_API_KEY;
      const model = config?.model || env.OPENROUTER_MODEL || env.LLM_MODEL;
      
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is required for OpenRouter provider');
      }
      
      return new OpenRouterProvider(apiKey, model, parseInt(env.DEFAULT_MAX_TOKENS));
    }

    case 'openrouter-fetch': {
      const apiKey = config?.apiKey || env.OPENROUTER_API_KEY;
      const model = config?.model || env.OPENROUTER_MODEL || env.LLM_MODEL;
      
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is required for OpenRouter Fetch provider');
      }
      
      return new OpenRouterFetchProvider(apiKey, model, parseInt(env.DEFAULT_MAX_TOKENS));
    }

    case 'ollama': {
      const baseUrl = config?.baseUrl || env.OLLAMA_BASE_URL;
      const model = config?.model || env.OLLAMA_MODEL || env.LLM_MODEL;
      
      return new OllamaProvider(baseUrl, model, parseInt(env.DEFAULT_MAX_TOKENS));
    }

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export async function validateLLMSetup(provider?: LLMProvider, model?: string): Promise<void> {
  const llmProvider = provider || createLLMProvider();
  const llmModel = model || env.LLM_MODEL;

  logger.debug(`Validating LLM provider: ${llmProvider.name} with model: ${llmModel}`);

  const result = await llmProvider.validateToolCallSupport(llmModel);

  if (!result.supported) {
    throw new Error(
      `Model ${llmModel} does not support tool calling.\n${result.message || ''}\n` +
      `Please use a compatible model or switch providers.`
    );
  }

  if (result.message) {
    logger.warn(result.message);
  }

  logger.info(`LLM provider validated successfully: ${llmProvider.name}`);
}

export * from './openai.js';
export * from './openrouter.js';
export * from './openrouter-fetch.js';
export * from './ollama.js';
export * from './validator.js';
