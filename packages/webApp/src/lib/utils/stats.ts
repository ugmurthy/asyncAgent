import type { Goal, Run, ReadinessResponse } from '@async-agent/api-js-client';

export interface DashboardStats {
	totalGoals: number;
	activeGoals: number;
	pausedGoals: number;
	completedGoals: number;
	totalRuns: number;
	runningRuns: number;
	completedRuns: number;
	failedRuns: number;
	pendingRuns: number;
	activeSchedules: number;
}

export function computeDashboardStats(
	goals: Goal[],
	runs: Run[],
	health: ReadinessResponse
): DashboardStats {
	const goalStats = goals.reduce(
		(acc, goal) => {
			acc.total++;
			if (goal.status === 'active') acc.active++;
			else if (goal.status === 'paused') acc.paused++;
			else if (goal.status === 'archived') acc.completed++;
			return acc;
		},
		{ total: 0, active: 0, paused: 0, completed: 0 }
	);

	const runStats = runs.reduce(
		(acc, run) => {
			acc.total++;
			if (run.status === 'running') acc.running++;
			else if (run.status === 'completed') acc.completed++;
			else if (run.status === 'failed') acc.failed++;
			else if (run.status === 'pending') acc.pending++;
			return acc;
		},
		{ total: 0, running: 0, completed: 0, failed: 0, pending: 0 }
	);

	return {
		totalGoals: goalStats.total,
		activeGoals: goalStats.active,
		pausedGoals: goalStats.paused,
		completedGoals: goalStats.completed,
		totalRuns: runStats.total,
		runningRuns: runStats.running,
		completedRuns: runStats.completed,
		failedRuns: runStats.failed,
		pendingRuns: runStats.pending,
		activeSchedules: health.scheduler.activeSchedules
	};
}
