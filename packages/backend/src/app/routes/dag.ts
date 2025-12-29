/**
 * DAG Routes
 * 
 * This file re-exports from the modular dag/ directory for backward compatibility.
 * All route implementations have been moved to:
 * - dag/handlers/create-dag.ts
 * - dag/handlers/execute-dag.ts
 * - dag/handlers/dag-crud.ts
 * - dag/handlers/dag-executions.ts
 * - dag/handlers/costs.ts
 * - dag/handlers/events.ts
 * 
 * Schemas are in dag/schemas.ts
 * Types are in dag/types.ts
 * Utility functions are in dag/utils.ts
 */
export { dagRoutes, DecomposerJobSchema, SubTaskSchema } from './dag/index.js';
export type { DAGRoutesOptions } from './dag/index.js';
