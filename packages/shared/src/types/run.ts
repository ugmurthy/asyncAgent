export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  goalId: string;
  status: RunStatus;
  startedAt?: Date;
  endedAt?: Date;
  workingMemory: Record<string, any>;
  stepBudget: number;
  stepsExecuted: number;
  error?: string;
  createdAt: Date;
}
