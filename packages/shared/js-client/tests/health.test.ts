import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsyncAgentClient } from '../src';
import type { HealthResponse, ReadinessResponse } from '../src';

vi.mock('axios');

describe('Health API', () => {
  let client: AsyncAgentClient;

  beforeEach(() => {
    client = new AsyncAgentClient({
      BASE: 'http://localhost:3000'
    });
  });

  it('should get health status', async () => {
    const mockHealthResponse: HealthResponse = {
      status: 'ok',
      timestamp: '2025-10-30T10:30:00.000Z'
    };

    vi.spyOn(client.health, 'getHealth').mockResolvedValue(mockHealthResponse);

    const health = await client.health.getHealth();

    expect(health).toBeDefined();
    expect(health.status).toBe('ok');
    expect(health.timestamp).toBeDefined();
  });

  it('should get readiness status', async () => {
    const mockReadinessResponse: ReadinessResponse = {
      status: 'ready',
      provider: 'openai',
      model: 'gpt-4o',
      scheduler: {
        activeSchedules: 3
      },
      timestamp: '2025-10-30T10:30:00.000Z'
    };

    vi.spyOn(client.health, 'getHealthReady').mockResolvedValue(mockReadinessResponse);

    const readiness = await client.health.getHealthReady();

    expect(readiness).toBeDefined();
    expect(readiness.status).toBe('ready');
    expect(readiness.provider).toBe('openai');
    expect(readiness.model).toBe('gpt-4o');
    expect(readiness.scheduler).toBeDefined();
    expect(readiness.scheduler.activeSchedules).toBe(3);
  });
});
