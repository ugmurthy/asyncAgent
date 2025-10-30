import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateEnv } from '../env'

describe('validateEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  it('should validate environment with default values', () => {
    const env = validateEnv()
    
    expect(env.LLM_PROVIDER).toBe('openai')
    expect(env.PORT).toBe('3000')
    expect(env.HOST).toBe('0.0.0.0')
    expect(['development', 'test']).toContain(env.NODE_ENV)
    expect(env.DATABASE_PATH).toBe('./data/async-agent.db')
    expect(env.DEFAULT_STEP_BUDGET).toBe('20')
    expect(env.LOG_LEVEL).toBe('info')
  })

  it('should accept valid LLM_PROVIDER values', () => {
    process.env.LLM_PROVIDER = 'openrouter'
    const env = validateEnv()
    expect(env.LLM_PROVIDER).toBe('openrouter')

    process.env.LLM_PROVIDER = 'ollama'
    const env2 = validateEnv()
    expect(env2.LLM_PROVIDER).toBe('ollama')
  })

  it('should accept custom port and host', () => {
    process.env.PORT = '8080'
    process.env.HOST = 'localhost'
    
    const env = validateEnv()
    expect(env.PORT).toBe('8080')
    expect(env.HOST).toBe('localhost')
  })

  it('should accept valid NODE_ENV values', () => {
    process.env.NODE_ENV = 'production'
    const env = validateEnv()
    expect(env.NODE_ENV).toBe('production')

    process.env.NODE_ENV = 'test'
    const env2 = validateEnv()
    expect(env2.NODE_ENV).toBe('test')
  })
})
