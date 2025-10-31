/**
 * Frontend API Types
 * 
 * This file contains TypeScript types for the Async Agent API.
 * Import these types in your React application for type-safe API calls.
 * 
 * Usage:
 *   import type { Goal, Run, CreateGoalRequest } from '@async-agent/shared';
 */

// ============================================================================
// Status Enums
// ============================================================================

export type GoalStatus = 'active' | 'paused' | 'archived';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type OutputKind = 'summary' | 'file' | 'webhook' | 'email';
export type MemoryType = 'note' | 'fact' | 'artifact';

// ============================================================================
// Core Entities
// ============================================================================

export interface Goal {
  id: string;
  objective: string;
  params: GoalParams;
  webhookUrl?: string | null;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoalParams {
  stepBudget?: number;
  allowedTools?: string[];
  constraints?: Record<string, any>;
}

export interface Schedule {
  id: string;
  goalId: string;
  cronExpr: string;
  timezone: string;
  active: boolean;
  createdAt: string;
}

export interface Run {
  id: string;
  goalId: string;
  status: RunStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  workingMemory: Record<string, any>;
  stepBudget: number;
  stepsExecuted: number;
  error?: string | null;
  createdAt: string;
}

export interface Step {
  id: string;
  runId: string;
  stepNo: number;
  thought: string;
  toolName?: string | null;
  toolInput?: Record<string, any> | null;
  observation?: string | null;
  durationMs: number;
  error?: string | null;
  createdAt: string;
}

export interface Output {
  id: string;
  runId: string;
  kind: OutputKind;
  pathOrPayload: string;
  createdAt: string;
}

export interface Memory {
  id: string;
  goalId: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

// ============================================================================
// Extended Types (with Relations)
// ============================================================================

export interface GoalWithSchedules extends Goal {
  schedules: Schedule[];
}

export interface RunWithGoal extends Run {
  goal: Goal;
}

export interface RunWithSteps extends Run {
  steps: Step[];
}

export interface RunWithGoalAndSteps extends Run {
  goal: Goal;
  steps: Step[];
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateGoalRequest {
  objective: string;
  params?: GoalParams;
  webhookUrl?: string;
  schedule?: {
    cronExpr: string;
    timezone?: string;
  };
}

export interface UpdateGoalRequest {
  objective?: string;
  params?: GoalParams;
  webhookUrl?: string | null;
  status?: GoalStatus;
}

// ============================================================================
// Response Types
// ============================================================================

export interface TriggerRunResponse {
  runId: string;
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface ErrorResponse {
  error: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface ReadyResponse {
  status: 'ready';
  provider: string;
  model: string;
  scheduler: {
    activeSchedules: number;
  };
  timestamp: string;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface GoalsQueryParams {
  status?: GoalStatus;
}

export interface RunsQueryParams {
  goalId?: string;
  status?: RunStatus;
}

// ============================================================================
// API Client Types
// ============================================================================

export interface ApiCallOptions extends RequestInit {
  params?: Record<string, string>;
}

export interface ApiError extends Error {
  statusCode?: number;
  response?: ErrorResponse;
}
