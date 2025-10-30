import { nanoid } from 'nanoid';

export function generateId(prefix?: string): string {
  const id = nanoid(16);
  return prefix ? `${prefix}_${id}` : id;
}

export function generateGoalId(): string {
  return generateId('goal');
}

export function generateRunId(): string {
  return generateId('run');
}

export function generateStepId(): string {
  return generateId('step');
}
