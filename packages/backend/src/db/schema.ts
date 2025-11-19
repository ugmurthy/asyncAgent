import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  objective: text('objective').notNull(),
  params: text('params', { mode: 'json' }).notNull().$type<{
    stepBudget?: number;
    allowedTools?: string[];
    constraints?: Record<string, any>;
  }>(),
  webhookUrl: text('webhook_url'),
  agentId: text('agent_id'),
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull().default(sql`'active'`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  cronExpr: text('cron_expr').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default(sql`'pending'`),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  workingMemory: text('working_memory', { mode: 'json' }).notNull().$type<Record<string, any>>().default(sql`'{}'`),
  stepBudget: integer('step_budget').notNull(),
  stepsExecuted: integer('steps_executed').notNull().default(0),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const steps = sqliteTable('steps', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  stepNo: integer('step_no').notNull(),
  thought: text('thought').notNull(),
  toolName: text('tool_name'),
  toolInput: text('tool_input', { mode: 'json' }).$type<Record<string, any>>(),
  observation: text('observation'),
  durationMs: integer('duration_ms').notNull(),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const outputs = sqliteTable('outputs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['summary', 'file', 'webhook', 'email'] }).notNull(),
  pathOrPayload: text('path_or_payload').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['note', 'fact', 'artifact'] }).notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
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
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Step = typeof steps.$inferSelect;
export type NewStep = typeof steps.$inferInsert;
export type Output = typeof outputs.$inferSelect;
export type NewOutput = typeof outputs.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Dag = typeof dags.$inferSelect;
export type NewDag = typeof dags.$inferInsert;
export type DagExecution = typeof dagExecutions.$inferSelect;
export type NewDagExecution = typeof dagExecutions.$inferInsert;
export type SubStep = typeof subSteps.$inferSelect;
export type NewSubStep = typeof subSteps.$inferInsert;

// Relations
export const goalsRelations = relations(goals, ({ one, many }) => ({
  schedules: many(schedules),
  runs: many(runs),
  memories: many(memories),
  agent: one(agents, {
    fields: [goals.agentId],
    references: [agents.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  goal: one(goals, {
    fields: [schedules.goalId],
    references: [goals.id],
  }),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  goal: one(goals, {
    fields: [runs.goalId],
    references: [goals.id],
  }),
  steps: many(steps),
  outputs: many(outputs),
}));

export const stepsRelations = relations(steps, ({ one }) => ({
  run: one(runs, {
    fields: [steps.runId],
    references: [runs.id],
  }),
}));

export const outputsRelations = relations(outputs, ({ one }) => ({
  run: one(runs, {
    fields: [outputs.runId],
    references: [runs.id],
  }),
}));

export const memoriesRelations = relations(memories, ({ one }) => ({
  goal: one(goals, {
    fields: [memories.goalId],
    references: [goals.id],
  }),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  goals: many(goals),
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
