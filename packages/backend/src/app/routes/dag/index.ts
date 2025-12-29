/**
 * DAG Routes - Main entry point
 * 
 * This module composes all DAG-related route handlers into a single Fastify plugin.
 */
import type { FastifyInstance } from 'fastify';
import type { DAGRoutesOptions, RouteContext } from './types.js';
import { registerCreateDagRoute } from './handlers/create-dag.js';
import { registerExecuteDagRoutes } from './handlers/execute-dag.js';
import { registerDagCrudRoutes } from './handlers/dag-crud.js';
import { registerDagExecutionRoutes } from './handlers/dag-executions.js';
import { registerCostRoutes } from './handlers/costs.js';
import { registerEventRoutes } from './handlers/events.js';

export async function dagRoutes(fastify: FastifyInstance, options: DAGRoutesOptions) {
  const context: RouteContext = {
    fastify,
    llmProvider: options.llmProvider,
    toolRegistry: options.toolRegistry,
    dagScheduler: options.dagScheduler,
  };

  // Register all route handlers
  registerCreateDagRoute(fastify, context);
  registerExecuteDagRoutes(fastify, context);
  registerDagCrudRoutes(fastify, context);
  registerDagExecutionRoutes(fastify, context);
  registerCostRoutes(fastify, context);
  registerEventRoutes(fastify, context);
}

// Re-export types for external use
export type { DAGRoutesOptions } from './types.js';
export { DecomposerJobSchema, SubTaskSchema } from './schemas.js';
