import { writable } from 'svelte/store';
import type { GoalWithSchedules } from '@async-agent/api-js-client';

export const goalsStore = writable<GoalWithSchedules[]>([]);
export const selectedGoal = writable<GoalWithSchedules | null>(null);

export type GoalStatus = 'active' | 'paused' | 'completed';
export type GoalSortField = 'createdAt' | 'updatedAt' | 'status' | 'objective';
export type SortDirection = 'asc' | 'desc';

export interface GoalFilters {
	status: GoalStatus | 'all';
	search: string;
	sortField: GoalSortField;
	sortDirection: SortDirection;
}

export const goalFilters = writable<GoalFilters>({
	status: 'all',
	search: '',
	sortField: 'createdAt',
	sortDirection: 'desc'
});
