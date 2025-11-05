import { z } from 'zod';

export const goalParamsSchema = z.object({
  stepBudget: z.number().int().positive().optional(),
  allowedTools: z.array(z.string()).optional(),
  constraints: z.record(z.any()).optional(),
});

export const createGoalSchema = z.object({
  objective: z.string().min(10).max(1000),
  params: goalParamsSchema.optional(),
  webhookUrl: z.string().url().optional(),
  agentName: z.string().optional(),
  agentId: z.string().optional(),
  schedule: z.object({
    cronExpr: z.string(),
    timezone: z.string().default('UTC'),
  }).optional(),
});

export const updateGoalSchema = z.object({
  objective: z.string().min(10).max(1000).optional(),
  params: goalParamsSchema.optional(),
  webhookUrl: z.string().url().optional().nullable(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
});
