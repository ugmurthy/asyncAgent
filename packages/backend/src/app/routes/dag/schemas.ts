/**
 * Zod schemas for DAG route validation
 */
import { z } from 'zod';

export const SubTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  thought: z.string(),
  action_type: z.enum(['tool', 'inference']),
  tool_or_prompt: z.object({
    name: z.string(),
    params: z.record(z.any()).optional(),
  }),
  expected_output: z.string(),
  dependencies: z.array(z.string()),
});

export const DecomposerJobSchema = z.object({
  original_request: z.string(),
  intent: z.object({
    primary: z.string(),
    sub_intents: z.array(z.string()),
  }),
  entities: z.array(z.object({
    entity: z.string(),
    type: z.string(),
    grounded_value: z.string(),
  })),
  sub_tasks: z.array(SubTaskSchema),
  synthesis_plan: z.string(),
  validation: z.object({
    coverage: z.string(),
    gaps: z.array(z.string()),
    iteration_triggers: z.array(z.string()),
  }),
  clarification_needed: z.boolean(),
  clarification_query: z.string().optional(),
}).refine(
  (data) => {
    if (data.clarification_needed) {
      return typeof data.clarification_query === 'string' && data.clarification_query.length > 0;
    }
    return true;
  },
  {
    message: 'clarification_query is required when clarification_needed is true',
    path: ['clarification_query'],
  }
);

// Input schemas for various routes
export const CreateDagInputSchema = z.object({
  'goal-text': z.string().min(1),
  agentName: z.string().min(1),
  provider: z.string().optional(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  seed: z.number().optional(),
  cronSchedule: z.string().optional(),
  scheduleActive: z.boolean().optional(),
  timezone: z.string().optional().default('UTC'),
});

export const DagIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const ExecutionIdParamsSchema = z.object({
  executionId: z.string().min(1),
});

export const ExecuteDagInputSchema = z.object({
  dagId: z.string().min(1),
});

export const DagExperimentsInputSchema = z.object({
  'goal-text': z.string().min(1),
  models: z.array(z.string()).min(1),
  agentName: z.string().min(1),
  provider: z.string(),
  temperatures: z.array(z.number().min(0).max(2)).min(1),
  seed: z.number().int().optional().nullable(),
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const DagListQuerySchema = PaginationQuerySchema.extend({
  status: z.string().optional(),
});

export const ExecutionListQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['pending', 'running', 'waiting', 'completed', 'failed', 'partial']).optional(),
});

export const DagExecutionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(['pending', 'running', 'waiting', 'completed', 'failed', 'partial', 'suspended']).optional(),
});

export const DagUpdateBodySchema = z.object({
  status: z.string().optional(),
  result: z.record(z.any()).optional(),
  params: z.record(z.any()).optional(),
  cronSchedule: z.string().optional(),
  scheduleActive: z.boolean().optional(),
  timezone: z.string().optional(),
});

export const CostSummaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// Type exports
export type CreateDagInput = z.infer<typeof CreateDagInputSchema>;
export type DagIdParams = z.infer<typeof DagIdParamsSchema>;
export type ExecutionIdParams = z.infer<typeof ExecutionIdParamsSchema>;
export type ExecuteDagInput = z.infer<typeof ExecuteDagInputSchema>;
export type DagExperimentsInput = z.infer<typeof DagExperimentsInputSchema>;
export type DagUpdateBody = z.infer<typeof DagUpdateBodySchema>;
