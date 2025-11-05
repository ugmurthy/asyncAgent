import { agents as agentsApi } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		const agent = await agentsApi.getAgent({ id: params.id });
		
		if (!agent) {
			throw error(404, 'Agent not found');
		}
		
		return {
			agent
		};
	} catch (err: any) {
		if (err.status === 404) {
			throw error(404, 'Agent not found');
		}
		throw error(500, 'Failed to load agent');
	}
};
