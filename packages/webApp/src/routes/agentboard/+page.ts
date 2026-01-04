import type { PageLoad } from './$types';
import { dag, health } from '$lib/api/client';
import type { DAG, DAGExecution, ReadinessResponse } from '@async-agent/api-js-client';

export interface AgentBoardStats {
	planning: {
		totalDags: number;
		pendingDags: number;
		readyDags: number;
		failedDags: number;
		totalPlanningCostUsd: number;
		totalPlanningTokens: number;
	};
	execution: {
		totalExecutions: number;
		runningExecutions: number;
		completedExecutions: number;
		failedExecutions: number;
		suspendedExecutions: number;
		totalExecutionCostUsd: number;
		totalTasks: number;
		completedTasks: number;
		failedTasks: number;
	};
	schedules: {
		activeDagSchedules: number;
		totalScheduledDags: number;
	};
}

function computeAgentBoardStats(
	dags: DAG[],
	executions: DAGExecution[],
	scheduledDags: any[]
): AgentBoardStats {
	const planningStats = dags.reduce(
		(acc, dag) => {
			acc.total++;
			if (dag.status === 'pending') acc.pending++;
			else if (dag.status === 'ready' || dag.status === 'completed') acc.ready++;
			else if (dag.status === 'failed') acc.failed++;
			
			if (dag.planningTotalCostUsd) {
				acc.cost += parseFloat(dag.planningTotalCostUsd);
			}
			
			if (dag.usage) {
				const usage = dag.usage as any;
				acc.tokens += (usage.total_tokens || usage.totalTokens || 0);
			}
			
			return acc;
		},
		{ total: 0, pending: 0, ready: 0, failed: 0, cost: 0, tokens: 0 }
	);

	const executionStats = executions.reduce(
		(acc, exec) => {
			acc.total++;
			if (exec.status === 'running') acc.running++;
			else if (exec.status === 'completed') acc.completed++;
			else if (exec.status === 'failed') acc.failed++;
			else if (exec.status === 'suspended') acc.suspended++;
			
			if (exec.totalCostUsd) {
				acc.cost += parseFloat(exec.totalCostUsd);
			}
			
			acc.totalTasks += exec.totalTasks || 0;
			acc.completedTasks += exec.completedTasks || 0;
			acc.failedTasks += exec.failedTasks || 0;
			
			return acc;
		},
		{ total: 0, running: 0, completed: 0, failed: 0, suspended: 0, cost: 0, totalTasks: 0, completedTasks: 0, failedTasks: 0 }
	);

	const activeDagSchedules = scheduledDags.filter(d => d.scheduleActive).length;

	return {
		planning: {
			totalDags: planningStats.total,
			pendingDags: planningStats.pending,
			readyDags: planningStats.ready,
			failedDags: planningStats.failed,
			totalPlanningCostUsd: planningStats.cost,
			totalPlanningTokens: planningStats.tokens
		},
		execution: {
			totalExecutions: executionStats.total,
			runningExecutions: executionStats.running,
			completedExecutions: executionStats.completed,
			failedExecutions: executionStats.failed,
			suspendedExecutions: executionStats.suspended,
			totalExecutionCostUsd: executionStats.cost,
			totalTasks: executionStats.totalTasks,
			completedTasks: executionStats.completedTasks,
			failedTasks: executionStats.failedTasks
		},
		schedules: {
			activeDagSchedules,
			totalScheduledDags: scheduledDags.length
		}
	};
}

export const load: PageLoad = async () => {
	try {
		const [dagsData, executionsData, scheduledDagsData, healthData] = await Promise.all([
			dag.listDags({ limit: 100 }),
			dag.listDagExecutions({ limit: 100 }),
			dag.listScheduledDags(),
			health.getHealthReady()
		]);

		const stats = computeAgentBoardStats(
			dagsData.dags || [],
			executionsData.executions || [],
			scheduledDagsData || []
		);

		return {
			title: 'AgentBoard',
			dags: dagsData.dags || [],
			executions: executionsData.executions || [],
			scheduledDags: scheduledDagsData || [],
			health: healthData,
			stats,
			error: null
		};
	} catch (err) {
		console.error('Failed to load AgentBoard data:', err);
		return {
			title: 'AgentBoard',
			dags: [] as DAG[],
			executions: [] as DAGExecution[],
			scheduledDags: [],
			health: null as ReadinessResponse | null,
			stats: null,
			error: err instanceof Error ? err.message : 'Failed to load AgentBoard data'
		};
	}
};
