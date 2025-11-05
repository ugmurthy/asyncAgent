import { runs } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		const [run, steps] = await Promise.all([
			runs.getRun({ id: params.id }),
			runs.getRunSteps({ id: params.id })
		]);
		
		return { 
			run,
			steps
		};
	} catch (err) {
		console.error('Failed to load run:', err);
		throw error(404, 'Run not found');
	}
};
