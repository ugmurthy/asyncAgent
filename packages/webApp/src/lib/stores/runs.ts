import { writable, derived } from 'svelte/store';
import type { RunWithGoal } from '@async-agent/api-js-client';

export interface RunsState {
	runs: RunWithGoal[];
	loading: boolean;
	error: string | null;
	selectedRunId: string | null;
}

const initialState: RunsState = {
	runs: [],
	loading: false,
	error: null,
	selectedRunId: null
};

function createRunsStore() {
	const { subscribe, set, update } = writable<RunsState>(initialState);

	return {
		subscribe,
		setRuns: (runs: RunWithGoal[]) => update(state => ({ ...state, runs, error: null })),
		addRun: (run: RunWithGoal) => update(state => ({ 
			...state, 
			runs: [run, ...state.runs] 
		})),
		updateRun: (runId: string, updates: Partial<RunWithGoal>) => update(state => ({
			...state,
			runs: state.runs.map(run => 
				run.id === runId ? { ...run, ...updates } : run
			)
		})),
		removeRun: (runId: string) => update(state => ({
			...state,
			runs: state.runs.filter(run => run.id !== runId)
		})),
		setLoading: (loading: boolean) => update(state => ({ ...state, loading })),
		setError: (error: string | null) => update(state => ({ ...state, error })),
		selectRun: (runId: string | null) => update(state => ({ ...state, selectedRunId: runId })),
		reset: () => set(initialState)
	};
}

export const runsStore = createRunsStore();

export const runsByStatus = derived(runsStore, $store => ({
	pending: $store.runs.filter(r => r.status === 'pending'),
	running: $store.runs.filter(r => r.status === 'running'),
	completed: $store.runs.filter(r => r.status === 'completed'),
	failed: $store.runs.filter(r => r.status === 'failed')
}));

export const runsStats = derived(runsStore, $store => ({
	total: $store.runs.length,
	pending: $store.runs.filter(r => r.status === 'pending').length,
	running: $store.runs.filter(r => r.status === 'running').length,
	completed: $store.runs.filter(r => r.status === 'completed').length,
	failed: $store.runs.filter(r => r.status === 'failed').length
}));

export const selectedRun = derived(runsStore, $store => 
	$store.selectedRunId 
		? $store.runs.find(r => r.id === $store.selectedRunId) 
		: null
);

export const recentRuns = derived(runsStore, $store =>
	[...$store.runs]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, 10)
);
