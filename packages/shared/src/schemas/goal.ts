import { z } from 'zod';

export const goalParamsSchema = z.object({
  stepBudget: z.number().int().positive().optional(),
  allowedTools: z.array(z.string()).optional(),
  constraints: z.record(z.any()).optional(),
});

export function createGoalSchemaFactory(maxMessageLength: number = 10000) {
  return z.object({
    objective: z.string().min(10).max(maxMessageLength),
    params: goalParamsSchema.optional(),
    webhookUrl: z.string().url().optional(),
    agentName: z.string().optional(),
    agentId: z.string().optional(),
    schedule: z.object({
      cronExpr: z.string(),
      timezone: z.string().default('UTC'),
    }).optional(),
  });
}

export function updateGoalSchemaFactory(maxMessageLength: number = 10000) {
  return z.object({
    objective: z.string().min(10).max(maxMessageLength).optional(),
    params: goalParamsSchema.optional(),
    webhookUrl: z.string().url().optional().nullable(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
  });
}

export const createGoalSchema = createGoalSchemaFactory();
export const updateGoalSchema = updateGoalSchemaFactory();
