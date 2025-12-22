import type { PageLoad } from './$types';
import { goals, runs, health, dag } from '$lib/api/client';
import { computeDashboardStats } from '$lib/utils/stats';
import type { Goal, Run, ReadinessResponse } from '@async-agent/api-js-client';

export const load: PageLoad = async () => {
	try {
		const [goalsData, runsData, healthData, executionsData] = await Promise.all([
			goals.listGoals({}),
			runs.listRuns({}),
			health.getHealthReady(),
			dag.listDagExecutions({limit:100})
		]);

		const stats = computeDashboardStats(goalsData, runsData, healthData);

		return {
			title: 'Dashboard',
			goals: goalsData,
			runs: runsData,
			health: healthData,
			executions: executionsData,
			stats,
			error: null
		};
	} catch (err) {
		console.error('Failed to load dashboard data:', err);
		return {
			title: 'Dashboard',
			goals: [] as Goal[],
			runs: [] as Run[],
			health: null as ReadinessResponse | null,
			executions: [] as any[],
			stats: null,
			error: err instanceof Error ? err.message : 'Failed to load dashboard data'
		};
	}
};
