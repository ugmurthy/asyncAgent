/**
 * Type definitions for DAG routes
 */
import type { FastifyInstance } from 'fastify';
import type { LLMProvider } from '@async-agent/shared';
import type { ToolRegistry } from '../../../agent/tools/index.js';

export interface DAGRoutesOptions {
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
  dagScheduler?: any;
}

export interface RouteContext {
  fastify: FastifyInstance;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
  dagScheduler?: any;
}

export interface PlanningAttempt {
  attempt: number;
  reason: 'initial' | 'retry_gaps' | 'retry_parse_error' | 'retry_validation' | 'title_master';
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  costUsd?: number | null;
  errorMessage?: string;
  generationStats?: Record<string, any>;
}

export interface PlanningUsageTotal {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
