import { goals } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const goalsList = await goals.listGoals({});
		return { 
			goals: goalsList 
		};
	} catch (err) {
		console.error('Failed to load goals:', err);
		throw error(500, 'Failed to load goals');
	}
};
