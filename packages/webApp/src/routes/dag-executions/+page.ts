import { apiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const executionsList = await apiClient.dag.listDagExecutions({ limit: 100 });
		return { 
			executions: executionsList.executions || []
		};
	} catch (err) {
		console.error('Failed to load DAG executions:', err);
		throw error(500, 'Failed to load DAG executions');
	}
};
