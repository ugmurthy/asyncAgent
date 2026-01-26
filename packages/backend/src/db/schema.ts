import { sqliteTable, sqliteView, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  cronExpr: text('cron_expr').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  promptTemplate: text('prompt_template').notNull(),
  provider: text('provider'),
  model: text('model'),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueNameVersion: uniqueIndex('idx_name_version').on(table.name, table.version),
  uniqueActiveNameIdx: uniqueIndex('idx_active_agent').on(table.name).where(sql`${table.active} = 1`),
}));

export const dags = sqliteTable('dags', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  result: text('result', { mode: 'json' }).$type<Record<string, any>>(),
  usage: text('usage', { mode: 'json' }).$type<Record<string, any>>(),
  generationStats: text('generation_stats', { mode: 'json' }).$type<Record<string, any>>(),
  attempts: integer('attempts').notNull().default(0),
  params: text('params', { mode: 'json' }).$type<Record<string, any>>(),
  agentName: text('agent_name'),
  dagTitle: text('dag_title'),
  cronSchedule: text('cron_schedule'),
  scheduleActive: integer('schedule_active', { mode: 'boolean' }).notNull().default(sql`0`),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  
  // Planning cost tracking (aggregate over ALL attempts + TitleMaster)
  planningTotalUsage: text('planning_total_usage', { mode: 'json' }).$type<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>(),
  planningTotalCostUsd: text('planning_total_cost_usd'),
  
  // Per-attempt details for debugging/audit (including failed attempts)
  planningAttempts: text('planning_attempts', { mode: 'json' }).$type<Array<{
    attempt: number;
    reason: 'initial' | 'retry_gaps' | 'retry_parse_error' | 'retry_validation' | 'title_master';
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    costUsd?: number | null;
    errorMessage?: string;
    generationStats?: Record<string, any>;
  }>>(),
});

export const dagExecutions = sqliteTable('dag_executions', {
  id: text('id').primaryKey(),
  dagId: text('dag_id').references(() => dags.id, { onDelete: 'restrict' }),
  
  originalRequest: text('original_request').notNull(),
  primaryIntent: text('primary_intent').notNull(),
  
  status: text('status', { 
    enum: ['pending', 'running', 'waiting', 'completed', 'failed', 'partial', 'suspended'] 
  }).notNull().default('pending'),
  
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  
  totalTasks: integer('total_tasks').notNull(),
  completedTasks: integer('completed_tasks').notNull().default(0),
  failedTasks: integer('failed_tasks').notNull().default(0),
  waitingTasks: integer('waiting_tasks').notNull().default(0),
  
  finalResult: text('final_result'),
  synthesisResult: text('synthesis_result'),
  
  // Suspension and retry tracking
  suspendedReason: text('suspended_reason'),
  suspendedAt: integer('suspended_at', { mode: 'timestamp' }),
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: integer('last_retry_at', { mode: 'timestamp' }),
  
  // Execution cost tracking (aggregate of all sub-steps including synthesis)
  totalUsage: text('total_usage', { mode: 'json' }).$type<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>(),
  totalCostUsd: text('total_cost_usd'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const subSteps = sqliteTable('sub_steps', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull().references(() => dagExecutions.id, { onDelete: 'cascade' }),
  
  taskId: text('task_id').notNull(),
  
  description: text('description').notNull(),
  thought: text('thought').notNull(),
  actionType: text('action_type', { enum: ['tool', 'inference'] }).notNull(),
  
  toolOrPromptName: text('tool_or_prompt_name').notNull(),
  toolOrPromptParams: text('tool_or_prompt_params', { mode: 'json' }).$type<Record<string, any>>(),
  
  dependencies: text('dependencies', { mode: 'json' }).notNull().$type<string[]>(),
  
  status: text('status', { 
    enum: ['pending', 'running', 'waiting', 'completed', 'failed'] 
  }).notNull().default('pending'),
  
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  
  result: text('result', { mode: 'json' }).$type<any>(),
  error: text('error'),
  
  // Sub-step cost tracking
  usage: text('usage', { mode: 'json' }).$type<{
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }>(),
  costUsd: text('cost_usd'),
  generationStats: text('generation_stats', { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const executions = sqliteView('executions', {
  dagTitle: text('dag_title'),
  id: text('id'),
  dagId: text('dag_id'),
  originalRequest: text('original_request'),
  primaryIntent: text('primary_intent'),
  status: text('status'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  totalTasks: integer('total_tasks'),
  completedTasks: integer('completed_tasks'),
  failedTasks: integer('failed_tasks'),
  waitingTasks: integer('waiting_tasks'),
  finalResult: text('final_result'),
  synthesisResult: text('synthesis_result'),
  suspendedReason: text('suspended_reason'),
  suspendedAt: integer('suspended_at', { mode: 'timestamp' }),
  retryCount: integer('retry_count'),
  lastRetryAt: integer('last_retry_at', { mode: 'timestamp' }),
  totalUsage: text('total_usage', { mode: 'json' }).$type<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>(),
  totalCostUsd: text('total_cost_usd'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
}).existing();

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Dag = typeof dags.$inferSelect;
export type NewDag = typeof dags.$inferInsert;
export type DagExecution = typeof dagExecutions.$inferSelect;
export type NewDagExecution = typeof dagExecutions.$inferInsert;
export type SubStep = typeof subSteps.$inferSelect;
export type NewSubStep = typeof subSteps.$inferInsert;
export type Execution = typeof executions.$inferSelect;

// Relations

export const agentsRelations = relations(agents, ({ }) => ({
}));

export const dagExecutionsRelations = relations(dagExecutions, ({ one, many }) => ({
  dag: one(dags, {
    fields: [dagExecutions.dagId],
    references: [dags.id],
  }),
  subSteps: many(subSteps),
}));

export const subStepsRelations = relations(subSteps, ({ one }) => ({
  execution: one(dagExecutions, {
    fields: [subSteps.executionId],
    references: [dagExecutions.id],
  }),
}));
