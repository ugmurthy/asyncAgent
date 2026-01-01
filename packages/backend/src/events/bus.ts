import { EventEmitter } from 'node:events';

export type DAGEventType =
  | 'execution.created'
  | 'execution.updated'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.suspended'
  | 'substep.started'
  | 'substep.completed'
  | 'substep.failed'
  | 'heartbeat'
  | 'tool.progress'
  | 'tool.completed';

export interface BaseDAGEvent {
  type: DAGEventType;
  executionId: string;
  timestamp: number;
}

export interface ExecutionCreatedEvent extends BaseDAGEvent {
  type: 'execution.created';
  totalTasks: number;
  originalRequest: string;
}

export interface ExecutionUpdatedEvent extends BaseDAGEvent {
  type: 'execution.updated';
  status: string;
  completedTasks: number;
  failedTasks: number;
  waitingTasks: number;
}

export interface ExecutionCompletedEvent extends BaseDAGEvent {
  type: 'execution.completed';
  status: 'completed' | 'partial';
  completedTasks: number;
  failedTasks: number;
  durationMs: number;
  finalResult?: string;
}

export interface ExecutionFailedEvent extends BaseDAGEvent {
  type: 'execution.failed';
  error: string;
  completedTasks: number;
  failedTasks: number;
}

export interface ExecutionSuspendedEvent extends BaseDAGEvent {
  type: 'execution.suspended';
  reason: string;
}

export interface SubStepStartedEvent extends BaseDAGEvent {
  type: 'substep.started';
  subStepId: string;
  taskId: number;
  description: string;
}

export interface SubStepCompletedEvent extends BaseDAGEvent {
  type: 'substep.completed';
  subStepId: string;
  taskId: number;
  durationMs: number;
  result?: string;
}

export interface SubStepFailedEvent extends BaseDAGEvent {
  type: 'substep.failed';
  subStepId: string;
  taskId: number;
  error: string;
}

export interface HeartbeatEvent extends BaseDAGEvent {
  type: 'heartbeat';
}

export interface ToolProgressEvent extends BaseDAGEvent {
  type: 'tool.progress';
  toolName: string;
  message: string;
  subStepId?: string;
}

export interface ToolCompletedEvent extends BaseDAGEvent {
  type: 'tool.completed';
  toolName: string;
  message: string;
  subStepId?: string;
}

export type DAGEvent =
  | ExecutionCreatedEvent
  | ExecutionUpdatedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | ExecutionSuspendedEvent
  | SubStepStartedEvent
  | SubStepCompletedEvent
  | SubStepFailedEvent
  | HeartbeatEvent
  | ToolProgressEvent
  | ToolCompletedEvent;

class DAGEventBus extends EventEmitter {
  emit(event: 'dag:event', data: DAGEvent): boolean {
    return super.emit(event, data);
  }

  on(event: 'dag:event', listener: (data: DAGEvent) => void): this {
    return super.on(event, listener);
  }

  off(event: 'dag:event', listener: (data: DAGEvent) => void): this {
    return super.off(event, listener);
  }
}

export const dagEventBus = new DAGEventBus();
