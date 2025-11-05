<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/ui/card';
	import { Badge } from '$lib/ui/badge';
	import StatsCard from '$lib/components/dashboard/StatsCard.svelte';
	import { formatRelativeTime } from '$lib/utils/formatters';
	
	export let data: PageData;
</script>

<svelte:head>
	<title>Dashboard - AsyncAgent</title>
</svelte:head>

<div>
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
		{#if data.error}
			<Badge variant="destructive">Connection Error</Badge>
		{:else}
			<Badge variant="default">Live</Badge>
		{/if}
	</div>

	{#if data.error}
		<div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
			<p class="font-semibold">Failed to load dashboard data</p>
			<p class="text-sm mt-1">{data.error}</p>
		</div>
	{/if}

	{#if data.stats}
		<div class="space-y-6">
			<section>
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
				<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
					<StatsCard 
						title="Total Goals" 
						value={data.stats.totalGoals}
						description="{data.stats.activeGoals} active, {data.stats.pausedGoals} paused, {data.stats.completedGoals} completed"
					/>
					<StatsCard 
						title="Total Runs" 
						value={data.stats.totalRuns}
						description="{data.stats.runningRuns} running, {data.stats.completedRuns} completed, {data.stats.failedRuns} failed"
					/>
					<StatsCard 
						title="Active Schedules" 
						value={data.stats.activeSchedules}
						description="Automated goal executions"
					/>
					<StatsCard 
						title="Pending Runs" 
						value={data.stats.pendingRuns}
						description="Waiting to execute"
					/>
				</div>
			</section>

			<section>
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
				<Card>
					<CardHeader>
						<CardTitle>Latest Runs</CardTitle>
					</CardHeader>
					<CardContent>
						{#if data.runs && data.runs.length > 0}
							<div class="space-y-3">
								{#each data.runs.slice(0, 5) as run}
									<div class="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
										<div class="flex-1">
											<p class="text-sm font-medium text-gray-900">Run {run.id.slice(0, 8)}</p>
											<p class="text-xs text-gray-500">{formatRelativeTime(run.createdAt)}</p>
										</div>
										<Badge variant={
											run.status === 'completed' ? 'default' : 
											run.status === 'failed' ? 'destructive' : 
											run.status === 'running' ? 'default' : 
											'secondary'
										}>
											{run.status}
										</Badge>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-500">No runs yet</p>
						{/if}
					</CardContent>
				</Card>
			</section>

			{#if data.health}
				<section>
					<h2 class="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
					<div class="grid gap-6 md:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>LLM Provider</CardTitle>
							</CardHeader>
							<CardContent>
								<div class="space-y-2">
									<div>
										<p class="text-sm text-gray-600">Provider</p>
										<p class="text-lg font-semibold text-gray-900">{data.health.provider}</p>
									</div>
									<div>
										<p class="text-sm text-gray-600">Model</p>
										<p class="text-lg font-semibold text-gray-900">{data.health.model}</p>
									</div>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Status</CardTitle>
							</CardHeader>
							<CardContent>
								<div class="space-y-2">
									<Badge variant="default" class="text-lg">{data.health.status}</Badge>
									<p class="text-sm text-gray-600 mt-2">
										Last checked: {formatRelativeTime(data.health.timestamp)}
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</section>
			{/if}
		</div>
	{/if}
</div>
