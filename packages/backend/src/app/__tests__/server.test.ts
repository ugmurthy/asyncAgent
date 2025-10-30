import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

describe('Server Health Checks', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    
    app.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    })
    
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should respond to health check', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const json = response.json()
    expect(json.status).toBe('ok')
    expect(json.timestamp).toBeDefined()
  })
})
