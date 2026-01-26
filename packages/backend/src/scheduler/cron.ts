// DEPRECATED: This file will be removed in US-007
// Stubbed out after runs/steps/goals table removal in US-004

import type { Database } from '../db/client.js';
import type { Logger } from '../util/logger.js';
import type { LLMProvider } from '@async-agent/shared';
import { ToolRegistry } from '../agent/tools/index.js';

export interface SchedulerConfig {
  db: Database;
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
}

export class CronScheduler {
  constructor(private config: SchedulerConfig) {}

  async start(): Promise<void> {
    this.config.logger.warn('CronScheduler is deprecated and will be removed. Use DAGScheduler instead.');
  }

  async stop(): Promise<void> {
    // No-op
  }

  registerSchedule(_schedule: any): void {
    // No-op
  }

  unregisterSchedule(_scheduleId: string): void {
    // No-op
  }

  getStats() {
    return {
      activeSchedules: 0,
      maxConcurrency: 0,
      queue: { pending: 0, running: 0 },
    };
  }
}
