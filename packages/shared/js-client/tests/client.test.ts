import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncAgentClient } from '../src';
import type { Goal, Run, GoalWithSchedules, RunWithGoal } from '../src';

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

  describe('Goals API', () => {
    it('should list all goals', async () => {
      // Mock the HTTP request
      const mockGoals: GoalWithSchedules[] = [
        {
          id: 'goal_abc123',
          objective: 'Monitor GitHub repository for new issues',
          params: {
            stepBudget: 20
          },
          status: 'active',
          createdAt: '2025-10-30T10:30:00.000Z',
          updatedAt: '2025-10-30T10:30:00.000Z',
          schedules: []
        },
        {
          id: 'goal_def456',
          objective: 'Daily market analysis',
          params: {
            stepBudget: 30,
            allowedTools: ['web_search', 'web_scrape']
          },
          status: 'active',
          createdAt: '2025-10-30T11:00:00.000Z',
          updatedAt: '2025-10-30T11:00:00.000Z',
          schedules: [
            {
              id: 'sched_xyz789',
              goalId: 'goal_def456',
              cronExpr: '0 9 * * *',
              timezone: 'UTC',
              active: true,
              createdAt: '2025-10-30T11:00:00.000Z'
            }
          ]
        }
      ];

      // Mock the request method
      vi.spyOn(client.goals, 'listGoals').mockResolvedValue(mockGoals);

      // Call the method
      const goals = await client.goals.listGoals();

      // Assertions
      expect(goals).toBeDefined();
      expect(Array.isArray(goals)).toBe(true);
      expect(goals).toHaveLength(2);
      expect(goals[0].id).toBe('goal_abc123');
      expect(goals[0].objective).toBe('Monitor GitHub repository for new issues');
      expect(goals[0].params.stepBudget).toBe(20);
      expect(goals[0].status).toBe('active');
      expect(goals[1].schedules).toHaveLength(1);
    });

    it('should filter goals by status', async () => {
      const mockActiveGoals: GoalWithSchedules[] = [
        {
          id: 'goal_active1',
          objective: 'Active goal 1',
          params: { stepBudget: 10 },
          status: 'active',
          createdAt: '2025-10-30T10:30:00.000Z',
          updatedAt: '2025-10-30T10:30:00.000Z',
          schedules: []
        }
      ];

      vi.spyOn(client.goals, 'listGoals').mockResolvedValue(mockActiveGoals);

      const goals = await client.goals.listGoals({ status: 'active' });

      expect(goals).toHaveLength(1);
      expect(goals[0].status).toBe('active');
    });

    it('should create a new goal', async () => {
      const mockGoal: Goal = {
        id: 'goal_new123',
        objective: 'Test goal',
        params: { stepBudget: 15 },
        status: 'active',
        createdAt: '2025-10-30T12:00:00.000Z',
        updatedAt: '2025-10-30T12:00:00.000Z'
      };

      vi.spyOn(client.goals, 'createGoal').mockResolvedValue(mockGoal);

      const goal = await client.goals.createGoal({
        requestBody: {
          objective: 'Test goal',
          params: { stepBudget: 15 }
        }
      });

      expect(goal).toBeDefined();
      expect(goal.id).toBe('goal_new123');
      expect(goal.objective).toBe('Test goal');
    });

    it('should get a specific goal by id', async () => {
      const mockGoal: GoalWithSchedules = {
        id: 'goal_abc123',
        objective: 'Monitor GitHub repository for new issues',
        params: { stepBudget: 20 },
        status: 'active',
        createdAt: '2025-10-30T10:30:00.000Z',
        updatedAt: '2025-10-30T10:30:00.000Z',
        schedules: []
      };

      vi.spyOn(client.goals, 'getGoal').mockResolvedValue(mockGoal);

      const goal = await client.goals.getGoal({ id: 'goal_abc123' });

      expect(goal).toBeDefined();
      expect(goal.id).toBe('goal_abc123');
      expect(goal.schedules).toBeDefined();
    });

    it('should trigger a goal run', async () => {
      const mockResponse = {
        runId: 'run_new123',
        message: 'Run triggered successfully'
      };

      vi.spyOn(client.goals, 'triggerGoalRun').mockResolvedValue(mockResponse);

      const result = await client.goals.triggerGoalRun({
        id: 'goal_abc123',
        requestBody: {}
      });

      expect(result).toBeDefined();
      expect(result.runId).toBe('run_new123');
      expect(result.message).toBe('Run triggered successfully');
    });
  });

  describe('Runs API', () => {
    it('should list all runs', async () => {
      const mockRuns: RunWithGoal[] = [
        {
          id: 'run_xyz789',
          goalId: 'goal_abc123',
          status: 'completed',
          startedAt: '2025-10-30T10:30:00.000Z',
          endedAt: '2025-10-30T10:35:00.000Z',
          workingMemory: {
            lastChecked: '2025-10-30T10:30:00.000Z'
          },
          stepBudget: 20,
          stepsExecuted: 15,
          error: null,
          createdAt: '2025-10-30T10:30:00.000Z',
          goal: {
            id: 'goal_abc123',
            objective: 'Monitor GitHub repository for new issues',
            params: { stepBudget: 20 },
            status: 'active',
            createdAt: '2025-10-30T10:30:00.000Z',
            updatedAt: '2025-10-30T10:30:00.000Z'
          }
        },
        {
          id: 'run_abc456',
          goalId: 'goal_def456',
          status: 'running',
          startedAt: '2025-10-30T11:00:00.000Z',
          endedAt: null,
          workingMemory: {},
          stepBudget: 30,
          stepsExecuted: 5,
          error: null,
          createdAt: '2025-10-30T11:00:00.000Z',
          goal: {
            id: 'goal_def456',
            objective: 'Daily market analysis',
            params: { stepBudget: 30 },
            status: 'active',
            createdAt: '2025-10-30T11:00:00.000Z',
            updatedAt: '2025-10-30T11:00:00.000Z'
          }
        }
      ];

      vi.spyOn(client.runs, 'listRuns').mockResolvedValue(mockRuns);

      const runs = await client.runs.listRuns();

      expect(runs).toBeDefined();
      expect(Array.isArray(runs)).toBe(true);
      expect(runs).toHaveLength(2);
      expect(runs[0].id).toBe('run_xyz789');
      expect(runs[0].status).toBe('completed');
      expect(runs[0].stepsExecuted).toBe(15);
      expect(runs[0].goal).toBeDefined();
      expect(runs[0].goal.id).toBe('goal_abc123');
    });

    it('should filter runs by status', async () => {
      const mockCompletedRuns: RunWithGoal[] = [
        {
          id: 'run_completed1',
          goalId: 'goal_abc123',
          status: 'completed',
          startedAt: '2025-10-30T10:00:00.000Z',
          endedAt: '2025-10-30T10:05:00.000Z',
          workingMemory: {},
          stepBudget: 20,
          stepsExecuted: 10,
          error: null,
          createdAt: '2025-10-30T10:00:00.000Z',
          goal: {
            id: 'goal_abc123',
            objective: 'Test goal',
            params: { stepBudget: 20 },
            status: 'active',
            createdAt: '2025-10-30T10:00:00.000Z',
            updatedAt: '2025-10-30T10:00:00.000Z'
          }
        }
      ];

      vi.spyOn(client.runs, 'listRuns').mockResolvedValue(mockCompletedRuns);

      const runs = await client.runs.listRuns({ status: 'completed' });

      expect(runs).toHaveLength(1);
      expect(runs[0].status).toBe('completed');
      expect(runs[0].endedAt).not.toBeNull();
    });

    it('should get a specific run by id', async () => {
      const mockRun: RunWithGoal = {
        id: 'run_xyz789',
        goalId: 'goal_abc123',
        status: 'completed',
        startedAt: '2025-10-30T10:30:00.000Z',
        endedAt: '2025-10-30T10:35:00.000Z',
        workingMemory: { lastChecked: '2025-10-30T10:30:00.000Z' },
        stepBudget: 20,
        stepsExecuted: 15,
        error: null,
        createdAt: '2025-10-30T10:30:00.000Z',
        goal: {
          id: 'goal_abc123',
          objective: 'Monitor GitHub repository for new issues',
          params: { stepBudget: 20 },
          status: 'active',
          createdAt: '2025-10-30T10:30:00.000Z',
          updatedAt: '2025-10-30T10:30:00.000Z'
        }
      };

      vi.spyOn(client.runs, 'getRun').mockResolvedValue(mockRun);

      const run = await client.runs.getRun({ id: 'run_xyz789' });

      expect(run).toBeDefined();
      expect(run.id).toBe('run_xyz789');
      expect(run.goal).toBeDefined();
    });

    it('should get run steps', async () => {
      const mockSteps = [
        {
          id: 'step_1',
          runId: 'run_xyz789',
          stepNo: 1,
          thought: 'I need to search for recent GitHub issues',
          toolName: 'web_search',
          toolInput: { query: 'github issues' },
          observation: 'Found 5 new issues',
          durationMs: 1500,
          error: null,
          createdAt: '2025-10-30T10:30:00.000Z'
        },
        {
          id: 'step_2',
          runId: 'run_xyz789',
          stepNo: 2,
          thought: 'Now I need to analyze the issues',
          toolName: null,
          toolInput: null,
          observation: 'Analysis complete',
          durationMs: 800,
          error: null,
          createdAt: '2025-10-30T10:30:05.000Z'
        }
      ];

      vi.spyOn(client.runs, 'getRunSteps').mockResolvedValue(mockSteps);

      const steps = await client.runs.getRunSteps({ id: 'run_xyz789' });

      expect(steps).toBeDefined();
      expect(Array.isArray(steps)).toBe(true);
      expect(steps).toHaveLength(2);
      expect(steps[0].stepNo).toBe(1);
      expect(steps[0].thought).toBe('I need to search for recent GitHub issues');
      expect(steps[0].toolName).toBe('web_search');
      expect(steps[1].stepNo).toBe(2);
    });
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
