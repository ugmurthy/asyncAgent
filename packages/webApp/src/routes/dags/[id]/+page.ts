import { apiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		console.log('Loading DAG with ID:', params.id);
		const dag = await apiClient.dag.getDag({ id: params.id });
		console.log('DAG loaded successfully:', dag);
		const executionsList = await apiClient.dag.getDagExecutions({ id: params.id });
		
		return { 
			dag,
			executions: executionsList.executions || []
		};
	} catch (err: any) {
		console.error('Failed to load DAG:', err);
		console.error('Error details:', {
			message: err.message,
			status: err.status,
			body: err.body,
			url: err.url
		});
		throw error(404, `DAG not found: ${err.message || 'Unknown error'}`);
	}
};
