import { runs } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	try {
		const status = url.searchParams.get('status');
		const goalId = url.searchParams.get('goalId');
		
		let allRuns = await runs.listRuns({
			status: status as any
		});
		
		if (goalId) {
			allRuns = allRuns.filter(run => run.goalId === goalId);
		}
		
		return {
			title: 'Runs',
			runs: allRuns,
			filters: {
				status,
				goalId
			}
		};
	} catch (error) {
		console.error('Failed to load runs:', error);
		return {
			title: 'Runs',
			runs: [],
			filters: { status: null, goalId: null },
			error: 'Failed to load runs'
		};
	}
};
