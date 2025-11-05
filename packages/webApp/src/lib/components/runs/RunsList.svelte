<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/ui/button';
	import * as Table from '$lib/ui/table';
	import { Input } from '$lib/ui/input';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { formatDate, formatRelativeTime, truncate } from '$lib/utils/formatters';
	import type { RunWithGoal } from '@async-agent/api-js-client';
	
	export let runs: RunWithGoal[] = [];
	export let currentFilters: { status: string | null; goalId: string | null } = { status: null, goalId: null };
	
	let searchTerm = '';
	let statusFilter = currentFilters.status || 'all';
	let sortBy: 'created' | 'updated' | 'status' = 'created';
	let sortOrder: 'asc' | 'desc' = 'desc';
	
	$: filteredRuns = runs
		.filter(run => {
			if (searchTerm && run.goal) {
				return run.goal.objective.toLowerCase().includes(searchTerm.toLowerCase());
			}
			return true;
		})
		.filter(run => {
			if (statusFilter === 'all') return true;
			return run.status === statusFilter;
		})
		.sort((a, b) => {
			let comparison = 0;
			if (sortBy === 'created') {
				comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
			} else if (sortBy === 'updated') {
				comparison = new Date(a.endedAt || a.startedAt || a.createdAt).getTime() - new Date(b.endedAt || b.startedAt || b.createdAt).getTime();
			} else {
				comparison = a.status.localeCompare(b.status);
			}
			return sortOrder === 'asc' ? comparison : -comparison;
		});
	
	function updateFilter(status: string) {
		const url = new URL($page.url);
		if (status === 'all') {
			url.searchParams.delete('status');
		} else {
			url.searchParams.set('status', status);
		}
		goto(url.toString());
	}
	
	function handleSort(field: typeof sortBy) {
		if (sortBy === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			sortOrder = 'desc';
		}
	}
	
	function getDuration(run: RunWithGoal): string {
		if (!run.startedAt || !run.endedAt) return '-';
		const ms = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
	}
</script>

<div class="space-y-4">
	<div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
		<div class="flex-1 w-full sm:w-auto">
			<Input 
				type="text" 
				placeholder="Search by goal objective..." 
				bind:value={searchTerm}
				class="max-w-sm"
			/>
		</div>
		
		<div class="flex gap-2 items-center">
			<select
				bind:value={statusFilter}
				on:change={() => updateFilter(statusFilter)}
				class="flex h-9 w-40 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
			>
				<option value="all">All Statuses</option>
				<option value="pending">Pending</option>
				<option value="running">Running</option>
				<option value="completed">Completed</option>
				<option value="failed">Failed</option>
			</select>
		</div>
	</div>
	
	{#if filteredRuns.length === 0}
		<EmptyState
			title="No runs found"
			description={searchTerm ? "Try adjusting your search or filters" : "No runs have been executed yet"}
			icon="🏃"
		/>
	{:else}
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-32">
							<button 
								class="flex items-center gap-1 hover:text-foreground"
								on:click={() => handleSort('status')}
							>
								Status
								{#if sortBy === 'status'}
									<span class="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</button>
						</Table.Head>
						<Table.Head>Goal</Table.Head>
						<Table.Head class="w-32">Steps</Table.Head>
						<Table.Head class="w-40">
							<button 
								class="flex items-center gap-1 hover:text-foreground"
								on:click={() => handleSort('created')}
							>
								Started
								{#if sortBy === 'created'}
									<span class="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</button>
						</Table.Head>
						<Table.Head class="w-32">Duration</Table.Head>
						<Table.Head class="w-24">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredRuns as run (run.id)}
						<Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => goto(`/runs/${run.id}`)}>
							<Table.Cell>
								<StatusBadge status={run.status} type="run" />
							</Table.Cell>
							<Table.Cell>
								<div class="space-y-1">
									<p class="text-sm font-medium" title={run.goal?.objective || 'No goal'}>
										{truncate(run.goal?.objective || 'Unknown goal', 60)}
									</p>
									<p class="text-xs text-muted-foreground font-mono">{run.goalId}</p>
								</div>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm">
									{run.stepsExecuted || 0} / {run.stepBudget || 20}
								</span>
							</Table.Cell>
							<Table.Cell>
								<div class="text-sm">
									<span class="block" title={run.startedAt ? formatDate(run.startedAt) : 'Not started'}>
										{run.startedAt ? formatRelativeTime(run.startedAt) : '-'}
									</span>
								</div>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm">{getDuration(run)}</span>
							</Table.Cell>
							<Table.Cell>
								<Button 
									variant="ghost" 
									size="sm"
									onclick={(e) => { e.stopPropagation(); goto(`/runs/${run.id}`); }}
								>
									View
								</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
		
		<div class="text-sm text-muted-foreground">
			Showing {filteredRuns.length} of {runs.length} runs
		</div>
	{/if}
</div>
