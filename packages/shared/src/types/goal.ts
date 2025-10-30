export type GoalStatus = 'active' | 'paused' | 'archived';

export interface Goal {
  id: string;
  objective: string;
  params: GoalParams;
  webhookUrl?: string;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalParams {
  stepBudget?: number;
  allowedTools?: string[];
  constraints?: Record<string, any>;
}
