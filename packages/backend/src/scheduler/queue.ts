import PQueue from 'p-queue';
import type { Logger } from '../util/logger.js';

export interface QueueTask<T = any> {
  id: string;
  execute: () => Promise<T>;
  priority?: number;
}

export class TaskQueue {
  private queue: PQueue;

  constructor(
    private logger: Logger,
    options: { concurrency?: number } = {}
  ) {
    this.queue = new PQueue({
      concurrency: options.concurrency || 1,
      autoStart: true,
    });

    this.queue.on('active', () => {
      this.logger.debug(`Queue active. Size: ${this.queue.size}, Pending: ${this.queue.pending}`);
    });

    this.queue.on('idle', () => {
      this.logger.debug('Queue is idle');
    });

    this.queue.on('error', (error) => {
      this.logger.error('Queue error:', error);
    });
  }

  async add<T>(task: QueueTask<T>): Promise<T> {
    this.logger.info(`Adding task to queue: ${task.id}`);
    
    return this.queue.add(
      async () => {
        this.logger.info(`Executing task: ${task.id}`);
        try {
          const result = await task.execute();
          this.logger.info(`Task completed: ${task.id}`);
          return result;
        } catch (error) {
          this.logger.error(`Task failed: ${task.id}`, error);
          throw error;
        }
      },
      { priority: task.priority }
    );
  }

  getStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      concurrency: this.queue.concurrency,
      isPaused: this.queue.isPaused,
    };
  }

  async pause(): Promise<void> {
    this.queue.pause();
    this.logger.info('Queue paused');
  }

  start(): void {
    this.queue.start();
    this.logger.info('Queue started');
  }

  async clear(): Promise<void> {
    this.queue.clear();
    this.logger.info('Queue cleared');
  }

  async onIdle(): Promise<void> {
    return this.queue.onIdle();
  }
}
