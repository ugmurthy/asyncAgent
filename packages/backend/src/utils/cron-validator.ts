import { CronExpressionParser } from 'cron-parser';

export interface CronValidationResult {
  valid: boolean;
  error?: string;
  nextRuns?: Date[];
}

/**
 * Validates a cron expression
 * @param cronExpression - The cron expression to validate
 * @param previewCount - Number of next scheduled runs to return (default: 3)
 * @returns Validation result with optional next scheduled times
 */
export function validateCronExpression(
  cronExpression: string,
  previewCount: number = 3
): CronValidationResult {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    const nextRuns: Date[] = [];

    for (let i = 0; i < previewCount; i++) {
      nextRuns.push(interval.next().toDate());
    }

    return {
      valid: true,
      nextRuns,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid cron expression',
    };
  }
}
