import type { LLMProvider } from '@async-agent/shared';

export interface ValidationResult {
  supported: boolean;
  message?: string;
}

export const OPENAI_TOOL_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-1106',
];

export const OLLAMA_TOOL_MODELS = [
  'mistral',
  'mixtral',
  'llama2',
  'llama3',
  'qwen',
];

export function validateOpenAIModel(model: string): ValidationResult {
  const isSupported = OPENAI_TOOL_MODELS.some(m => model.startsWith(m));
  
  if (!isSupported) {
    return {
      supported: false,
      message: `Model "${model}" may not support function calling. Supported models: ${OPENAI_TOOL_MODELS.join(', ')}`,
    };
  }

  return { supported: true };
}

export function validateOllamaModel(model: string): ValidationResult {
  const isKnownModel = OLLAMA_TOOL_MODELS.some(m => model.includes(m));
  
  if (!isKnownModel) {
    return {
      supported: false,
      message: `Model "${model}" is not in the known tool-calling model list. It may still work if it supports function calling.`,
    };
  }

  return { supported: true };
}

export async function testProviderConnection(
  provider: LLMProvider,
  model: string
): Promise<ValidationResult> {
  try {
    const result = await provider.validateToolCallSupport(model);
    return result;
  } catch (error) {
    return {
      supported: false,
      message: `Provider connection test failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
