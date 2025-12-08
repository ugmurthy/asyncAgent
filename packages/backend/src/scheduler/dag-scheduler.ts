import cron from 'node-cron';
import parser from 'cron-parser';
import type { Database } from '../db/client.js';
import type { Logger } from '../util/logger.js';
import { dags, dagExecutions, subSteps } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateId } from '@async-agent/shared';
import type { LLMProvider } from '@async-agent/shared';
import type { ToolRegistry } from '../agent/tools/index.js';
import { DAGExecutor, type DecomposerJob } from '../agent/dagExecutor.js';
import { dagEventBus } from '../events/bus.js';

export interface DAGSchedulerConfig {
  db: Database;
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
}

interface ScheduledDAG {
  id: string;
  cronSchedule: string;
  scheduleActive: boolean;
  lastRunAt?: Date | null;
  createdAt?: Date;
  timezone?: string;
}

export class DAGScheduler {
  private tasks = new Map<string, cron.ScheduledTask>();
  private dagExecutor: DAGExecutor;

  constructor(private config: DAGSchedulerConfig) {
    this.dagExecutor = new DAGExecutor({
      logger: config.logger,
      llmProvider: config.llmProvider,
      toolRegistry: config.toolRegistry,
      db: config.db,
    });
  }

  async start(): Promise<void> {
    const { db, logger } = this.config;

    logger.info('Starting DAG scheduler...');

    // Load all DAGs with active schedules
    const scheduledDAGs = await db.query.dags.findMany({
      where: eq(dags.scheduleActive, true),
    });

    logger.info(`Found ${scheduledDAGs.length} scheduled DAGs`);

    // Register cron jobs for each scheduled DAG
    for (const dag of scheduledDAGs) {
      if (dag.cronSchedule) {
        const scheduleInfo: ScheduledDAG = {
          id: dag.id,
          cronSchedule: dag.cronSchedule,
          scheduleActive: dag.scheduleActive ?? false,
          lastRunAt: dag.lastRunAt,
          createdAt: dag.createdAt,
          timezone: dag.timezone,
        };
        
        await this.checkMissedSchedule(scheduleInfo);
        this.registerDAGSchedule(scheduleInfo);
      }
    }

    logger.info('DAG scheduler started');
  }

  async stop(): Promise<void> {
    const { logger } = this.config;

    logger.info('Stopping DAG scheduler...');

    // Stop all cron tasks
    for (const [dagId, task] of this.tasks) {
      task.stop();
      logger.debug(`Stopped DAG schedule: ${dagId}`);
    }

    this.tasks.clear();

    logger.info('DAG scheduler stopped');
  }

  registerDAGSchedule(scheduledDAG: ScheduledDAG): void {
    const { logger } = this.config;

    if (!scheduledDAG.scheduleActive) {
      logger.debug(`DAG schedule is not active: ${scheduledDAG.id}`);
      return;
    }

    if (this.tasks.has(scheduledDAG.id)) {
      logger.warn(`DAG schedule already registered: ${scheduledDAG.id}`);
      return;
    }

    if (!cron.validate(scheduledDAG.cronSchedule)) {
      logger.error(`Invalid cron expression for DAG ${scheduledDAG.id}: ${scheduledDAG.cronSchedule}`);
      return;
    }

    const task = cron.schedule(
      scheduledDAG.cronSchedule,
      async () => {
        logger.info(`Cron triggered for DAG: ${scheduledDAG.id}`);
        await this.updateLastRunAt(scheduledDAG.id);
        await this.executeScheduledDAG(scheduledDAG.id);
      },
      {
        scheduled: true,
        timezone: scheduledDAG.timezone || 'UTC',
      }
    );

    this.tasks.set(scheduledDAG.id, task);
    logger.info(`Registered DAG schedule: ${scheduledDAG.id} (${scheduledDAG.cronSchedule})`);
  }

  unregisterDAGSchedule(dagId: string): void {
    const { logger } = this.config;

    const task = this.tasks.get(dagId);
    if (task) {
      task.stop();
      this.tasks.delete(dagId);
      logger.info(`Unregistered DAG schedule: ${dagId}`);
    }
  }

  async updateLastRunAt(dagId: string): Promise<void> {
    const { db, logger } = this.config;
    try {
      await db.update(dags)
        .set({ lastRunAt: new Date() })
        .where(eq(dags.id, dagId));
    } catch (error) {
      logger.error({ err: error, dagId }, 'Failed to update DAG lastRunAt');
    }
  }

  async checkMissedSchedule(dag: ScheduledDAG): Promise<void> {
    const { logger } = this.config;
    try {
      if (!dag.cronSchedule) return;

      const options = {
        currentDate: dag.lastRunAt || dag.createdAt || new Date(),
        tz: dag.timezone || 'UTC',
      };
      
      // Parse the cron expression
      const interval = parser.parseExpression(dag.cronSchedule, options);
      const now = new Date();
      
      // Get the next scheduled run relative to the last run
      const nextRun = interval.next().toDate();
      
      // If the next scheduled run is in the past, we missed it
      if (nextRun < now) {
        logger.info(`Missed schedule for DAG: ${dag.id}. Last run: ${options.currentDate}, Scheduled: ${nextRun}, Now: ${now}`);
        
        // Trigger immediately
        await this.updateLastRunAt(dag.id);
        await this.executeScheduledDAG(dag.id);
      }
    } catch (error) {
      logger.error({ err: error, dagId: dag.id }, 'Failed to check for missed DAG schedules');
    }
  }

  async executeScheduledDAG(dagId: string): Promise<string> {
    const { db, logger } = this.config;

    logger.info(`Executing scheduled DAG: ${dagId}`);

    const dagRecord = await db.query.dags.findFirst({
      where: eq(dags.id, dagId),
    });

    if (!dagRecord) {
      throw new Error(`DAG not found: ${dagId}`);
    }

    if (!dagRecord.scheduleActive) {
      throw new Error(`DAG schedule is not active: ${dagId}`);
    }

    const job = dagRecord.result as DecomposerJob;
    // Use original goalText from DAG params (preserves formatting) instead of LLM's original_request
    const originalGoalText = (dagRecord.params as any)?.goalText || job.original_request;
    
    const executionId = generateId('dag-exec');

    logger.info({
      executionId,
      dagId,
      primaryIntent: job.intent?.primary,
      totalTasks: job.sub_tasks?.length,
      triggeredBy: 'schedule'
    }, 'Starting scheduled DAG execution');

    try {
      await db.insert(dagExecutions).values({
        id: executionId,
        dagId: dagId || null,
        originalRequest: originalGoalText,
        primaryIntent: job.intent.primary,
        status: 'pending',
        totalTasks: job.sub_tasks.length,
      });

      await db.insert(subSteps).values(
        job.sub_tasks.map(task => ({
          id: generateId('sub-step'),
          executionId: executionId,
          taskId: task.id,
          description: task.description,
          thought: task.thought,
          actionType: task.action_type,
          toolOrPromptName: task.tool_or_prompt.name,
          toolOrPromptParams: task.tool_or_prompt.params || {},
          dependencies: task.dependencies,
          status: 'pending' as const,
        }))
      );

      logger.info({ executionId }, 'Initial execution records created for scheduled DAG');
    } catch (dbError) {
      logger.error({ err: dbError, executionId }, 'Failed to create execution records for scheduled DAG');
      throw new Error('Failed to initialize execution records');
    }

    // Execute in background
    this.dagExecutor.execute(job, executionId, dagId, originalGoalText).catch(async (error) => {
      logger.error({ err: error, executionId }, 'Scheduled DAG execution failed');

      try {
        const execution = await db.query.dagExecutions.findFirst({
          where: eq(dagExecutions.id, executionId),
        });

        if (execution && execution.status !== 'suspended' && execution.status !== 'failed') {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await db.update(dagExecutions)
            .set({
              status: 'suspended',
              suspendedReason: errorMessage,
              suspendedAt: new Date(),
            })
            .where(eq(dagExecutions.id, executionId));

          dagEventBus.emit('dag:event', {
            type: 'execution.suspended',
            executionId,
            timestamp: Date.now(),
            reason: errorMessage,
          });
        }
      } catch (updateError) {
        logger.error({ err: updateError, executionId }, 'Failed to update execution status after error');
      }
    });

    return executionId;
  }

  updateDAGSchedule(dagId: string, cronSchedule: string, scheduleActive: boolean): void {
    const { logger } = this.config;

    // Unregister existing schedule if any
    this.unregisterDAGSchedule(dagId);

    // Register new schedule if active
    if (scheduleActive && cronSchedule) {
      this.registerDAGSchedule({
        id: dagId,
        cronSchedule,
        scheduleActive,
      });
      logger.info(`Updated DAG schedule: ${dagId}`);
    }
  }

  getStats() {
    return {
      activeSchedules: this.tasks.size,
      schedules: Array.from(this.tasks.keys()),
    };
  }
}
