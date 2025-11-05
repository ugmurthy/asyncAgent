import { goals, runs } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		const [goal, goalRuns] = await Promise.all([
			goals.getGoal({ id: params.id }),
			runs.listRuns({}).then(allRuns => allRuns.filter(run => run.goalId === params.id))
		]);
		
		return { 
			goal,
			runs: goalRuns
		};
	} catch (err) {
		console.error('Failed to load goal:', err);
		throw error(404, 'Goal not found');
	}
};
