import cron from 'node-cron';
import type { Database } from '../db/client.js';
import type { Logger } from '../util/logger.js';
import { schedules, runs, goals } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { generateRunId } from '@async-agent/shared';
import { TaskQueue } from './queue.js';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import type { LLMProvider } from '@async-agent/shared';
import { ToolRegistry } from '../agent/tools/index.js';
import { env } from '../util/env.js';

export interface SchedulerConfig {
  db: Database;
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
}

export class CronScheduler {
  private tasks = new Map<string, cron.ScheduledTask>();
  private queue: TaskQueue;
  private orchestrator: AgentOrchestrator;

  constructor(private config: SchedulerConfig) {
    const maxConcurrency = parseInt(env.MAX_CONCURRENT_RUNS) || 3;
    this.queue = new TaskQueue(config.logger, { concurrency: maxConcurrency });
    this.orchestrator = new AgentOrchestrator({
      db: config.db,
      logger: config.logger,
      llmProvider: config.llmProvider,
      toolRegistry: config.toolRegistry,
    });
  }

  async start(): Promise<void> {
    const { db, logger } = this.config;

    logger.info('Starting cron scheduler...');

    // Load all active schedules from database
    const activeSchedules = await db.query.schedules.findMany({
      where: eq(schedules.active, true),
      with: { goal: true },
    });

    logger.info(`Found ${activeSchedules.length} active schedules`);

    // Register cron jobs for each schedule
    for (const schedule of activeSchedules) {
      this.registerSchedule(schedule);
    }

    logger.info('Cron scheduler started');
  }

  async stop(): Promise<void> {
    const { logger } = this.config;

    logger.info('Stopping cron scheduler...');

    // Stop all cron tasks
    for (const [scheduleId, task] of this.tasks) {
      task.stop();
      logger.debug(`Stopped schedule: ${scheduleId}`);
    }

    this.tasks.clear();

    // Wait for queue to finish
    await this.queue.onIdle();

    logger.info('Cron scheduler stopped');
  }

  registerSchedule(schedule: any): void {
    const { logger } = this.config;

    if (this.tasks.has(schedule.id)) {
      logger.warn(`Schedule already registered: ${schedule.id}`);
      return;
    }

    if (!cron.validate(schedule.cronExpr)) {
      logger.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpr}`);
      return;
    }

    const task = cron.schedule(
      schedule.cronExpr,
      async () => {
        logger.info(`Cron triggered for goal: ${schedule.goal.objective}`);
        await this.triggerGoal(schedule.goalId);
      },
      {
        scheduled: true,
        timezone: schedule.timezone,
      }
    );

    this.tasks.set(schedule.id, task);
    logger.info(`Registered schedule: ${schedule.id} (${schedule.cronExpr})`);
  }

  unregisterSchedule(scheduleId: string): void {
    const { logger } = this.config;

    const task = this.tasks.get(scheduleId);
    if (task) {
      task.stop();
      this.tasks.delete(scheduleId);
      logger.info(`Unregistered schedule: ${scheduleId}`);
    }
  }

  async triggerGoal(goalId: string): Promise<string> {
    const { db, logger } = this.config;

    logger.info(`Triggering goal: ${goalId}`);

    // Check concurrent run limits
    const activeRuns = await this.getActiveRunsCount();
    const maxRuns = parseInt(env.MAX_CONCURRENT_RUNS) || 3;

    if (activeRuns >= maxRuns) {
      throw new Error(`Maximum concurrent runs (${maxRuns}) exceeded. Current active runs: ${activeRuns}`);
    }

    // Get goal details
    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
    });

    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (goal.status !== 'active') {
      throw new Error(`Goal is not active: ${goalId}`);
    }

    // Create a new run
    const runId = generateRunId();
    const stepBudget = goal.params?.stepBudget || parseInt(env.DEFAULT_STEP_BUDGET);

    await db.insert(runs).values({
      id: runId,
      goalId,
      status: 'pending',
      stepBudget,
      stepsExecuted: 0,
      workingMemory: {},
      createdAt: new Date(),
    });

    logger.info(`Created run: ${runId}`);

    // Add to execution queue
    // await this.queue.add({
    // removed await to ensure this is non-blocking 1/Nov/2025
    this.queue.add({
      id: runId,
      execute: async () => {
        await this.orchestrator.executeRun(runId);
      },
    });

    return runId;
  }

  private async getActiveRunsCount(): Promise<number> {
    const { db } = this.config;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(runs)
      .where(eq(runs.status, 'running'));

    return result[0]?.count || 0;
  }

  getStats() {
    const maxConcurrency = parseInt(env.MAX_CONCURRENT_RUNS) || 3;
    return {
      activeSchedules: this.tasks.size,
      maxConcurrency,
      queue: this.queue.getStats(),
    };
  }
}
