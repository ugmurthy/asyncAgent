# Async Agent API Documentation

**Version:** 0.1.0  
**Base URL:** `http://localhost:3000/api/v1`

This document provides comprehensive API documentation for building a React-based frontend application for the Async Agent system.

---

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Goals](#goals)
  - [Runs](#runs)
- [Frontend Integration Guide](#frontend-integration-guide)

---

## Overview

The Async Agent API is a RESTful API built with Fastify that manages autonomous agent goals, scheduled tasks, and run executions. It uses SQLite for data persistence and supports multiple LLM providers (OpenAI, OpenRouter, Ollama).

---

## Base URL

```
http://localhost:3000/api/v1
```

For health checks:
```
http://localhost:3000/health
```

---

## Authentication

**Current Version:** No authentication required.

Future versions may include API key authentication. The API currently supports CORS and rate limiting (100 requests per minute per IP).

---

## Error Handling

### Error Response Format

```typescript
{
  "error": string  // Human-readable error message
}
```

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful deletion) |
| `400` | Bad Request (validation error) |
| `404` | Resource Not Found |
| `429` | Too Many Requests (rate limit exceeded) |
| `500` | Internal Server Error |

### Validation Errors

The API uses Zod for validation. Invalid requests will return a 400 status with detailed error information.

---

## TypeScript Types

### Core Types

```typescript
// Goal Status
type GoalStatus = 'active' | 'paused' | 'archived';

// Run Status
type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

// Output Kind
type OutputKind = 'summary' | 'file' | 'webhook' | 'email';

// Memory Type
type MemoryType = 'note' | 'fact' | 'artifact';

// Goal
interface Goal {
  id: string;                    // Format: goal_xxxxx
  objective: string;             // 10-1000 characters
  params: GoalParams;
  webhookUrl?: string | null;
  status: GoalStatus;
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}

// Goal Parameters
interface GoalParams {
  stepBudget?: number;           // Positive integer
  allowedTools?: string[];       // Array of tool names
  constraints?: Record<string, any>;
}

// Schedule
interface Schedule {
  id: string;                    // Format: sched_xxxxx
  goalId: string;
  cronExpr: string;              // Cron expression
  timezone: string;              // Default: 'UTC'
  active: boolean;
  createdAt: string;             // ISO 8601 timestamp
}

// Run
interface Run {
  id: string;                    // Format: run_xxxxx
  goalId: string;
  status: RunStatus;
  startedAt?: string | null;     // ISO 8601 timestamp
  endedAt?: string | null;       // ISO 8601 timestamp
  workingMemory: Record<string, any>;
  stepBudget: number;
  stepsExecuted: number;
  error?: string | null;
  createdAt: string;             // ISO 8601 timestamp
}

// Step
interface Step {
  id: string;                    // Format: step_xxxxx
  runId: string;
  stepNo: number;
  thought: string;               // Agent's reasoning
  toolName?: string | null;      // Tool used in this step
  toolInput?: Record<string, any> | null;
  observation?: string | null;   // Result of tool execution
  durationMs: number;            // Step execution time
  error?: string | null;
  createdAt: string;             // ISO 8601 timestamp
}

// Extended Goal (with relations)
interface GoalWithSchedules extends Goal {
  schedules: Schedule[];
}

// Extended Run (with relations)
interface RunWithGoal extends Run {
  goal: Goal;
}
```

### Request Schemas

```typescript
// Create Goal Request
interface CreateGoalRequest {
  objective: string;             // 10-1000 characters, required
  params?: GoalParams;           // Optional
  webhookUrl?: string;           // Valid URL, optional
  schedule?: {                   // Optional
    cronExpr: string;            // Cron expression (e.g., '0 0 * * *')
    timezone?: string;           // Default: 'UTC'
  };
}

// Update Goal Request
interface UpdateGoalRequest {
  objective?: string;            // 10-1000 characters
  params?: GoalParams;
  webhookUrl?: string | null;
  status?: GoalStatus;
}
```

---

## Endpoints

### Health Check

#### Get Health Status

```http
GET /health
```

**Response:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2025-10-30T10:30:00.000Z"
}
```

#### Get Readiness Status

```http
GET /health/ready
```

**Response:** `200 OK`

```json
{
  "status": "ready",
  "provider": "openai",
  "model": "gpt-4o",
  "scheduler": {
    "activeSchedules": 3
  },
  "timestamp": "2025-10-30T10:30:00.000Z"
}
```

---

### Goals

Goals represent the objectives that agents will work towards autonomously.

#### Create Goal

```http
POST /api/v1/goals
```

**Request Body:**

```json
{
  "objective": "Monitor GitHub repository for new issues and summarize them daily",
  "params": {
    "stepBudget": 20,
    "allowedTools": ["web_search", "web_scrape"],
    "constraints": {
      "maxRetries": 3
    }
  },
  "webhookUrl": "https://example.com/webhook",
  "schedule": {
    "cronExpr": "0 9 * * *",
    "timezone": "America/New_York"
  }
}
```

**Response:** `201 Created`

```json
{
  "id": "goal_abc123xyz",
  "objective": "Monitor GitHub repository for new issues and summarize them daily",
  "params": {
    "stepBudget": 20,
    "allowedTools": ["web_search", "web_scrape"],
    "constraints": {
      "maxRetries": 3
    }
  },
  "webhookUrl": "https://example.com/webhook",
  "status": "active",
  "createdAt": "2025-10-30T10:30:00.000Z",
  "updatedAt": "2025-10-30T10:30:00.000Z"
}
```

**Validation Rules:**
- `objective`: 10-1000 characters (required)
- `webhookUrl`: Must be a valid URL (optional)
- `params.stepBudget`: Positive integer (optional)
- `schedule.cronExpr`: Valid cron expression (optional)

---

#### List Goals

```http
GET /api/v1/goals?status=active
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | `GoalStatus` | Filter by status: `active`, `paused`, or `archived` |

**Response:** `200 OK`

```json
[
  {
    "id": "goal_abc123xyz",
    "objective": "Monitor GitHub repository for new issues and summarize them daily",
    "params": {
      "stepBudget": 20
    },
    "webhookUrl": "https://example.com/webhook",
    "status": "active",
    "createdAt": "2025-10-30T10:30:00.000Z",
    "updatedAt": "2025-10-30T10:30:00.000Z"
  }
]
```

---

#### Get Goal by ID

```http
GET /api/v1/goals/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Goal ID |

**Response:** `200 OK`

```json
{
  "id": "goal_abc123xyz",
  "objective": "Monitor GitHub repository for new issues and summarize them daily",
  "params": {
    "stepBudget": 20,
    "allowedTools": ["web_search", "web_scrape"]
  },
  "webhookUrl": "https://example.com/webhook",
  "status": "active",
  "createdAt": "2025-10-30T10:30:00.000Z",
  "updatedAt": "2025-10-30T10:30:00.000Z",
  "schedules": [
    {
      "id": "sched_xyz789",
      "goalId": "goal_abc123xyz",
      "cronExpr": "0 9 * * *",
      "timezone": "America/New_York",
      "active": true,
      "createdAt": "2025-10-30T10:30:00.000Z"
    }
  ]
}
```

**Error Response:** `404 Not Found`

```json
{
  "error": "Goal not found"
}
```

---

#### Update Goal

```http
PATCH /api/v1/goals/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Goal ID |

**Request Body:** (all fields optional)

```json
{
  "objective": "Updated objective text",
  "params": {
    "stepBudget": 30
  },
  "status": "paused"
}
```

**Response:** `200 OK`

```json
{
  "id": "goal_abc123xyz",
  "objective": "Updated objective text",
  "params": {
    "stepBudget": 30
  },
  "webhookUrl": "https://example.com/webhook",
  "status": "paused",
  "createdAt": "2025-10-30T10:30:00.000Z",
  "updatedAt": "2025-10-30T11:00:00.000Z"
}
```

---

#### Delete Goal

```http
DELETE /api/v1/goals/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Goal ID |

**Response:** `204 No Content`

**Note:** Deleting a goal cascades to all associated schedules and runs.

---

#### Trigger Goal Run

Manually trigger a goal execution (independent of schedules).

```http
POST /api/v1/goals/:id/run
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Goal ID |

**Request Body:** None required (empty POST)

**Response:** `200 OK`

```json
{
  "runId": "run_def456abc",
  "message": "Run triggered"
}
```

**Error Response:** `400 Bad Request`

```json
{
  "error": "Goal is paused"
}
```

**Note:** Do not send `Content-Type: application/json` header if you're not sending a body, or send an empty JSON object `{}`.

---

#### Pause Goal

Pause a goal and its scheduled runs.

```http
POST /api/v1/goals/:id/pause
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Goal ID |

**Response:** `200 OK`

```json
{
  "message": "Goal paused"
}
```

---

#### Resume Goal

Resume a paused goal.

```http
POST /api/v1/goals/:id/resume
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Goal ID |

**Response:** `200 OK`

```json
{
  "message": "Goal resumed"
}
```

---

### Runs

Runs represent individual executions of goals.

#### List Runs

```http
GET /api/v1/runs?goalId=goal_abc123&status=completed
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `goalId` | `string` | Filter by goal ID (optional) |
| `status` | `RunStatus` | Filter by status: `pending`, `running`, `completed`, or `failed` (optional) |

**Response:** `200 OK` (max 50 most recent runs)

```json
[
  {
    "id": "run_def456abc",
    "goalId": "goal_abc123xyz",
    "status": "completed",
    "startedAt": "2025-10-30T10:30:00.000Z",
    "endedAt": "2025-10-30T10:35:00.000Z",
    "workingMemory": {
      "lastProcessedIssue": 42
    },
    "stepBudget": 20,
    "stepsExecuted": 15,
    "error": null,
    "createdAt": "2025-10-30T10:30:00.000Z",
    "goal": {
      "id": "goal_abc123xyz",
      "objective": "Monitor GitHub repository for new issues",
      "params": {},
      "status": "active",
      "createdAt": "2025-10-30T10:00:00.000Z",
      "updatedAt": "2025-10-30T10:00:00.000Z"
    }
  }
]
```

---

#### Get Run by ID

```http
GET /api/v1/runs/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Run ID |

**Response:** `200 OK`

```json
{
  "id": "run_def456abc",
  "goalId": "goal_abc123xyz",
  "status": "completed",
  "startedAt": "2025-10-30T10:30:00.000Z",
  "endedAt": "2025-10-30T10:35:00.000Z",
  "workingMemory": {
    "lastProcessedIssue": 42,
    "summary": "Processed 5 new issues"
  },
  "stepBudget": 20,
  "stepsExecuted": 15,
  "error": null,
  "createdAt": "2025-10-30T10:30:00.000Z",
  "goal": {
    "id": "goal_abc123xyz",
    "objective": "Monitor GitHub repository for new issues",
    "params": {
      "stepBudget": 20
    },
    "webhookUrl": null,
    "status": "active",
    "createdAt": "2025-10-30T10:00:00.000Z",
    "updatedAt": "2025-10-30T10:00:00.000Z"
  }
}
```

**Error Response:** `404 Not Found`

```json
{
  "error": "Run not found"
}
```

---

#### Get Run Steps

Get detailed steps of a run execution.

```http
GET /api/v1/runs/:id/steps
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Run ID |

**Response:** `200 OK`

```json
[
  {
    "id": "step_ghi789def",
    "runId": "run_def456abc",
    "stepNo": 1,
    "thought": "I need to search for new GitHub issues",
    "toolName": "web_search",
    "toolInput": {
      "query": "site:github.com/user/repo new issues"
    },
    "observation": "Found 5 new issues",
    "durationMs": 1250,
    "error": null,
    "createdAt": "2025-10-30T10:30:05.000Z"
  },
  {
    "id": "step_jkl012ghi",
    "runId": "run_def456abc",
    "stepNo": 2,
    "thought": "Now I'll scrape the issue details",
    "toolName": "web_scrape",
    "toolInput": {
      "url": "https://github.com/user/repo/issues/42"
    },
    "observation": "Issue #42: Bug in authentication",
    "durationMs": 2100,
    "error": null,
    "createdAt": "2025-10-30T10:30:07.000Z"
  }
]
```

**Error Response:** `404 Not Found`

```json
{
  "error": "Run not found"
}
```

---

#### Delete Run

```http
DELETE /api/v1/runs/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Run ID |

**Response:** `204 No Content`

**Note:** Deleting a run cascades to all associated steps and outputs.

---

## Frontend Integration Guide

### Installing the Shared Package

First, install the shared types package in your frontend:

```bash
npm install @async-agent/shared
# or
pnpm add @async-agent/shared
# or
yarn add @async-agent/shared
```

Then import types:

```typescript
import type { 
  Goal, 
  Run, 
  Step,
  CreateGoalRequest,
  UpdateGoalRequest 
} from '@async-agent/shared';
```

### Setting Up the API Client

#### Using Fetch

```typescript
const API_BASE_URL = 'http://localhost:3000/api/v1';

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
```

#### Using Axios

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message;
    return Promise.reject(new Error(message));
  }
);
```

### React Hooks Examples

#### useGoals Hook

```typescript
import { useState, useEffect } from 'react';

interface UseGoalsResult {
  goals: Goal[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGoals(status?: GoalStatus): UseGoalsResult {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const query = status ? `?status=${status}` : '';
      const data = await apiCall<Goal[]>(`/goals${query}`);
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [status]);

  return { goals, loading, error, refetch: fetchGoals };
}
```

#### useGoal Hook

```typescript
export function useGoal(goalId: string) {
  const [goal, setGoal] = useState<GoalWithSchedules | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoal = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<GoalWithSchedules>(`/goals/${goalId}`);
      setGoal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch goal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoal();
  }, [goalId]);

  return { goal, loading, error, refetch: fetchGoal };
}
```

#### useRuns Hook

```typescript
interface UseRunsOptions {
  goalId?: string;
  status?: RunStatus;
}

export function useRuns(options: UseRunsOptions = {}) {
  const [runs, setRuns] = useState<RunWithGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (options.goalId) params.append('goalId', options.goalId);
      if (options.status) params.append('status', options.status);
      
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiCall<RunWithGoal[]>(`/runs${query}`);
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [options.goalId, options.status]);

  return { runs, loading, error, refetch: fetchRuns };
}
```

#### useRunSteps Hook

```typescript
export function useRunSteps(runId: string) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSteps = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<Step[]>(`/runs/${runId}/steps`);
      setSteps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch steps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSteps();
  }, [runId]);

  return { steps, loading, error, refetch: fetchSteps };
}
```

### API Service Examples

```typescript
// services/goals.service.ts
export const goalsService = {
  async create(data: CreateGoalRequest): Promise<Goal> {
    return apiCall('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateGoalRequest): Promise<Goal> {
    return apiCall(`/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiCall(`/goals/${id}`, {
      method: 'DELETE',
    });
  },

  async triggerRun(id: string): Promise<{ runId: string; message: string }> {
    return apiCall(`/goals/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({}), // Send empty object to satisfy Fastify
    });
  },

  async pause(id: string): Promise<{ message: string }> {
    return apiCall(`/goals/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async resume(id: string): Promise<{ message: string }> {
    return apiCall(`/goals/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};

// services/runs.service.ts
export const runsService = {
  async delete(id: string): Promise<void> {
    return apiCall(`/runs/${id}`, {
      method: 'DELETE',
    });
  },
};
```

### React Query Integration

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch goals
export function useGoalsQuery(status?: GoalStatus) {
  return useQuery({
    queryKey: ['goals', status],
    queryFn: async () => {
      const query = status ? `?status=${status}` : '';
      return apiCall<Goal[]>(`/goals${query}`);
    },
  });
}

// Create goal mutation
export function useCreateGoalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGoalRequest) =>
      apiCall<Goal>('/goals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

// Trigger run mutation
export function useTriggerRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) =>
      apiCall<{ runId: string; message: string }>(`/goals/${goalId}/run`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}
```

### Component Examples

#### GoalForm Component

```typescript
import { useState } from 'react';
import { goalsService } from './services/goals.service';

export function GoalForm({ onSuccess }: { onSuccess: () => void }) {
  const [objective, setObjective] = useState('');
  const [stepBudget, setStepBudget] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      await goalsService.create({
        objective,
        params: { stepBudget },
      });
      
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        placeholder="Goal objective (10-1000 characters)"
        minLength={10}
        maxLength={1000}
        required
      />
      
      <input
        type="number"
        value={stepBudget}
        onChange={(e) => setStepBudget(Number(e.target.value))}
        min={1}
      />
      
      {error && <div className="error">{error}</div>}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Goal'}
      </button>
    </form>
  );
}
```

---

## Rate Limiting

The API enforces rate limiting:
- **Limit:** 100 requests per minute per IP address
- **Response when exceeded:** `429 Too Many Requests`

---

## CORS

CORS is enabled for all origins in development. Configure appropriately for production.

---

## WebSocket Support

**Status:** Not yet implemented.

Future versions may include WebSocket support for real-time run status updates and step streaming.

---

## Additional Notes

### Date Handling

All timestamps are returned as ISO 8601 strings. Convert them to Date objects in your frontend:

```typescript
const goal: Goal = await apiCall('/goals/123');
const createdDate = new Date(goal.createdAt);
```

### Pagination

Currently, runs are limited to 50 most recent results. Pagination will be added in future versions.

### Cron Expression Examples

When creating scheduled goals:

- `0 9 * * *` - Every day at 9:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Every Sunday at midnight
- `*/15 * * * *` - Every 15 minutes

Use [crontab.guru](https://crontab.guru) for help with cron expressions.

---

## Support

For issues or questions, please refer to the main project README or open an issue on GitHub.
