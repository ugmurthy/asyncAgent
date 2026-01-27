import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncAgentClient } from '../src';

// Mock axios to avoid real HTTP requests
vi.mock('axios');

describe('AsyncAgentClient', () => {
  let client: AsyncAgentClient;

  beforeEach(() => {
    // Create a new client instance before each test
    client = new AsyncAgentClient({
      BASE: 'http://localhost:3000/api/v1'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('DAG API', () => {
    it('should list all DAG executions', async () => {
      const mockExecutions = {
        executions: [
          {
            id: 'exec_abc123',
            dagId: 'dag_xyz789',
            status: 'completed',
            startedAt: '2025-12-17T10:00:00.000Z',
            endedAt: '2025-12-17T10:15:00.000Z',
            createdAt: '2025-12-17T10:00:00.000Z'
          },
          {
            id: 'exec_def456',
            dagId: 'dag_uvw012',
            status: 'running',
            startedAt: '2025-12-17T11:00:00.000Z',
            endedAt: null,
            createdAt: '2025-12-17T11:00:00.000Z'
          }
        ],
        total: 2
      };

      vi.spyOn(client.dag, 'listDagExecutions').mockResolvedValue(mockExecutions);

      const result = await client.dag.listDagExecutions({});

      expect(result).toBeDefined();
      expect(result.executions).toBeDefined();
      expect(Array.isArray(result.executions)).toBe(true);
      expect(result.executions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.executions[0].id).toBe('exec_abc123');
      expect(result.executions[0].status).toBe('completed');
      expect(result.executions[1].status).toBe('running');
    });

    it('should filter DAG executions by status', async () => {
      const mockCompletedExecutions = {
        executions: [
          {
            id: 'exec_completed1',
            dagId: 'dag_xyz789',
            status: 'completed',
            startedAt: '2025-12-17T10:00:00.000Z',
            endedAt: '2025-12-17T10:15:00.000Z',
            createdAt: '2025-12-17T10:00:00.000Z'
          }
        ],
        total: 1
      };

      vi.spyOn(client.dag, 'listDagExecutions').mockResolvedValue(mockCompletedExecutions);

      const result = await client.dag.listDagExecutions({ status: 'completed' });

      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].status).toBe('completed');
      expect(result.executions[0].endedAt).not.toBeNull();
    });

    it('should paginate DAG executions', async () => {
      const mockPaginatedExecutions = {
        executions: [
          {
            id: 'exec_page2_1',
            dagId: 'dag_xyz789',
            status: 'completed',
            startedAt: '2025-12-17T09:00:00.000Z',
            endedAt: '2025-12-17T09:15:00.000Z',
            createdAt: '2025-12-17T09:00:00.000Z'
          }
        ],
        total: 25
      };

      vi.spyOn(client.dag, 'listDagExecutions').mockResolvedValue(mockPaginatedExecutions);

      const result = await client.dag.listDagExecutions({ limit: 10, offset: 10 });

      expect(result).toBeDefined();
      expect(result.total).toBe(25);
      expect(result.executions).toHaveLength(1);
    });
  });

  describe('Client Configuration', () => {
    it('should create client with custom base URL', () => {
      const customClient = new AsyncAgentClient({
        BASE: 'https://api.example.com/v1'
      });

      expect(customClient).toBeDefined();
    });

    it('should create client with authentication headers', () => {
      const authClient = new AsyncAgentClient({
        BASE: 'http://localhost:3000/api/v1',
        HEADERS: {
          'Authorization': 'Bearer test-token-123'
        }
      });

      expect(authClient).toBeDefined();
    });
  });
});
