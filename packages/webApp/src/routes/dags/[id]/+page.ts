import { apiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		const dag = await apiClient.dag.getDag({ id: params.id });
		const executionsList = await apiClient.dag.listDagExecutions({});
		
		// Filter executions for this DAG
		const dagExecutions = executionsList.executions?.filter(e => e.dagId === params.id) || [];
		
		return { 
			dag,
			executions: dagExecutions
		};
	} catch (err) {
		console.error('Failed to load DAG:', err);
		throw error(404, 'DAG not found');
	}
};
