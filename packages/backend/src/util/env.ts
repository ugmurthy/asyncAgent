import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // LLM Provider
  LLM_PROVIDER: z.enum(['openai', 'openrouter', 'ollama']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4o'),

  // Server
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_PATH: z.string().default('./data/async-agent.db'),

  // Agent
  DEFAULT_STEP_BUDGET: z.string().default('20'),
  DEFAULT_TOOL_TIMEOUT: z.string().default('60000'),
  DEFAULT_TEMPERATURE: z.string().default('0.7'),
  DEFAULT_MAX_TOKENS: z.string().default('2000'),
  DEFAULT_REASONING_EFFORT: z.string().default('medium'),
  MAX_CONCURRENT_RUNS: z.string().default('3'),
  MAX_MESSAGE_LENGTH: z.string().default('10000'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    console.error('Environment validation failed:', parsed.error.format());
    throw new Error('Invalid environment configuration');
  }

  return parsed.data;
}

export const env = validateEnv();
