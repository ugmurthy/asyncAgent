import { goals, runs, agents } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		const [goal, goalRuns] = await Promise.all([
			goals.getGoal({ id: params.id }),
			runs.listRuns({}).then(allRuns => allRuns.filter(run => run.goalId === params.id))
		]);
		
		// Fetch agent if agentId is present
		let agent = null;
		if (goal.agentId) {
			try {
				agent = await agents.getAgent({ id: goal.agentId });
			} catch (err) {
				console.warn('Failed to load agent:', err);
			}
		}
		
		return { 
			goal,
			runs: goalRuns,
			agent
		};
	} catch (err) {
		console.error('Failed to load goal:', err);
		throw error(404, 'Goal not found');
	}
};
