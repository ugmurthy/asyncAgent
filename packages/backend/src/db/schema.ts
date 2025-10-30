import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
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
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull().default('active'),
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
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  workingMemory: text('working_memory', { mode: 'json' }).notNull().$type<Record<string, any>>().default({}),
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

// Relations
export const goalsRelations = relations(goals, ({ many }) => ({
  schedules: many(schedules),
  runs: many(runs),
  memories: many(memories),
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
