import type { Run, RunStep } from '@async-agent/shared/types/run.js';

export interface Goal {
  id: string;
  objective: string;
  params?: {
    stepBudget?: number;
    allowedTools?: string[];
    constraints?: Record<string, any>;
  };
  webhookUrl?: string;
  status: 'active' | 'paused' | 'archived';
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateGoalRequest {
  objective: string;
  params?: {
    stepBudget?: number;
    allowedTools?: string[];
    constraints?: Record<string, any>;
  };
  webhookUrl?: string;
  schedule?: {
    cronExpr: string;
    timezone?: string;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface ReadyResponse extends HealthResponse {
  database: string;
  scheduler: string;
  llmProvider: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  details?: any;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private debug: boolean;

  constructor(baseUrl = 'http://localhost:3000', options: { timeout?: number; debug?: boolean } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout || 10000;
    this.debug = options.debug || false;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    if (this.debug) {
      console.error(`[API] ${method} ${url}`, body ? JSON.stringify(body) : '');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error: ApiError = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };

        try {
          const errorData = await response.json();
          error.details = errorData;
          error.message = errorData.error || error.message;
        } catch {
          // Response body is not JSON
        }

        throw error;
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw {
          message: `Request timeout after ${this.timeout}ms`,
          statusCode: 0,
        } as ApiError;
      }

      if (err.cause?.code === 'ECONNREFUSED') {
        throw {
          message: `Cannot connect to server at ${this.baseUrl}`,
          statusCode: 0,
        } as ApiError;
      }

      throw err;
    }
  }

  // Health endpoints
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  async ready(): Promise<ReadyResponse> {
    return this.request<ReadyResponse>('GET', '/health/ready');
  }

  // Goal endpoints
  async createGoal(params: CreateGoalRequest): Promise<Goal> {
    return this.request<Goal>('POST', '/api/v1/goals', params);
  }

  async listGoals(): Promise<Goal[]> {
    return this.request<Goal[]>('GET', '/api/v1/goals');
  }

  async getGoal(id: string): Promise<Goal> {
    return this.request<Goal>('GET', `/api/v1/goals/${id}`);
  }

  async updateGoal(id: string, params: Partial<CreateGoalRequest>): Promise<Goal> {
    return this.request<Goal>('PATCH', `/api/v1/goals/${id}`, params);
  }

  async deleteGoal(id: string): Promise<void> {
    return this.request<void>('DELETE', `/api/v1/goals/${id}`);
  }

  async runGoal(id: string): Promise<{ runId: string }> {
    return this.request<{ runId: string }>('POST', `/api/v1/goals/${id}/run`);
  }

  async pauseGoal(id: string): Promise<Goal> {
    return this.request<Goal>('POST', `/api/v1/goals/${id}/pause`);
  }

  async resumeGoal(id: string): Promise<Goal> {
    return this.request<Goal>('POST', `/api/v1/goals/${id}/resume`);
  }

  // Run endpoints
  async listRuns(goalId?: string): Promise<Run[]> {
    const path = goalId ? `/api/v1/runs?goalId=${goalId}` : '/api/v1/runs';
    return this.request<Run[]>('GET', path);
  }

  async getRun(id: string): Promise<Run> {
    return this.request<Run>('GET', `/api/v1/runs/${id}`);
  }

  async getRunSteps(id: string): Promise<RunStep[]> {
    return this.request<RunStep[]>('GET', `/api/v1/runs/${id}/steps`);
  }

  async deleteRun(id: string): Promise<void> {
    return this.request<void>('DELETE', `/api/v1/runs/${id}`);
  }
}

export function createClient(baseUrl?: string, options?: { timeout?: number; debug?: boolean }): ApiClient {
  return new ApiClient(baseUrl, options);
}
