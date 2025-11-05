import { health as healthApi } from '$lib/api/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const health = await healthApi.getHealthReady();
		return {
			health: health || null
		};
	} catch (error) {
		console.error('Failed to load system health:', error);
		return {
			health: null,
			error: 'Failed to load system information'
		};
	}
};
