import { apiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		const execution = await apiClient.dag.getDagExecution({ id: params.id });
		
		return { 
			execution
		};
	} catch (err) {
		console.error('Failed to load DAG execution:', err);
		throw error(404, 'DAG execution not found');
	}
};
