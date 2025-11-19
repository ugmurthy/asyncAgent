import { apiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const dagsList = await apiClient.dag.listDags({});
		return { 
			dags: dagsList.dags || []
		};
	} catch (err) {
		console.error('Failed to load DAGs:', err);
		throw error(500, 'Failed to load DAGs');
	}
};
