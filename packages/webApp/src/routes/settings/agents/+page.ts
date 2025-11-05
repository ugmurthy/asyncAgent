import { agents as agentsApi } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const agents = await agentsApi.listAgents({});
		return {
			agents: agents || []
		};
	} catch (error) {
		console.error('Failed to load agents:', error);
		return {
			agents: [],
			error: 'Failed to load agents'
		};
	}
};
