<script lang="ts">
	import RunsList from '$lib/components/runs/RunsList.svelte';
	import * as Card from '$lib/ui/card';
	import { Badge } from '$lib/ui/badge';
	import type { PageData } from './$types';
	
	export let data: PageData;
	
	$: runs = data.runs || [];
	$: filters = data.filters || { status: null, goalId: null };
	
	$: stats = {
		total: runs.length,
		running: runs.filter(r => r.status === 'running').length,
		completed: runs.filter(r => r.status === 'completed').length,
		failed: runs.filter(r => r.status === 'failed').length,
		pending: runs.filter(r => r.status === 'pending').length
	};
</script>

<svelte:head>
	<title>Runs - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Runs</h1>
	</div>
	
	<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm font-medium text-muted-foreground">Total</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.total}</div>
			</Card.Content>
		</Card.Root>
		
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm font-medium text-muted-foreground">Running</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-blue-600">{stats.running}</div>
			</Card.Content>
		</Card.Root>
		
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm font-medium text-muted-foreground">Completed</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-green-600">{stats.completed}</div>
			</Card.Content>
		</Card.Root>
		
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm font-medium text-muted-foreground">Failed</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-red-600">{stats.failed}</div>
			</Card.Content>
		</Card.Root>
		
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm font-medium text-muted-foreground">Pending</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-yellow-600">{stats.pending}</div>
			</Card.Content>
		</Card.Root>
	</div>
	
	{#if data.error}
		<div class="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
			{data.error}
		</div>
	{/if}
	
	<Card.Root>
		<Card.Header>
			<Card.Title>All Runs</Card.Title>
		</Card.Header>
		<Card.Content>
			<RunsList {runs} currentFilters={filters} />
		</Card.Content>
	</Card.Root>
</div>
