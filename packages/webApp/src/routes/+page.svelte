<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/ui/card';
	import { Badge } from '$lib/ui/badge';
	import * as Tabs from '$lib/ui/tabs';
	import * as Table from '$lib/ui/table';
	import StatsCard from '$lib/components/dashboard/StatsCard.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { formatRelativeTime } from '$lib/utils/formatters';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	function getExecutionDuration(execution: any): string {
		if (!execution.startedAt) return '-';
		const end = execution.endedAt ? new Date(execution.endedAt) : new Date();
		const start = new Date(execution.startedAt);
		const durationMs = end.getTime() - start.getTime();
		const seconds = Math.floor(durationMs / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ${minutes % 60}m`;
	}
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
				<Tabs.Root value="runs" class="w-full">
					<Tabs.List class="grid w-full grid-cols-2">
						<Tabs.Trigger value="runs">Latest Runs</Tabs.Trigger>
						<Tabs.Trigger value="executions">Executions</Tabs.Trigger>
					</Tabs.List>
					
					<Tabs.Content value="runs">
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
					</Tabs.Content>

					<Tabs.Content value="executions">
						<Card>
							<CardHeader>
								<CardTitle>Executions</CardTitle>
							</CardHeader>
							<CardContent>
								{#if data.executions && data.executions.length > 0}
									<Table.Root>
										<Table.Header>
											<Table.Row>
												<Table.Head>DAG Title</Table.Head>
												<Table.Head>Status</Table.Head>
												<Table.Head>Updated</Table.Head>
												<Table.Head>Duration</Table.Head>
												<Table.Head class="text-right">Steps</Table.Head>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{#each data.executions as execution}
												<Table.Row 
													class="cursor-pointer hover:bg-gray-50 transition-colors"
													onclick={() => goto(`/dag-executions/${execution.id}`)}
												>
													<Table.Cell class="font-medium">
														{execution.dagTitle || 'Untitled'}
													</Table.Cell>
													<Table.Cell>
														<StatusBadge status={execution.status} />
													</Table.Cell>
													<Table.Cell class="text-sm text-gray-600">
														{formatRelativeTime(execution.updatedAt || execution.createdAt)}
													</Table.Cell>
													<Table.Cell class="text-sm text-gray-600">
														{getExecutionDuration(execution)}
													</Table.Cell>
													<Table.Cell class="text-right text-sm text-gray-600">
														{execution.subSteps?.length || 0}
													</Table.Cell>
												</Table.Row>
											{/each}
										</Table.Body>
									</Table.Root>
								{:else}
									<p class="text-sm text-gray-500">No executions yet</p>
								{/if}
							</CardContent>
						</Card>
					</Tabs.Content>
				</Tabs.Root>
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
