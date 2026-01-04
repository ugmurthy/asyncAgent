<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/ui/card';
	import { Badge } from '$lib/ui/badge';
	import * as Tabs from '$lib/ui/tabs';
	import { formatRelativeTime } from '$lib/utils/formatters';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	function formatCurrency(value: number): string {
		if (value === 0) return '$0.00';
		if (value < 0.01) return `$${value.toFixed(6)}`;
		return `$${value.toFixed(4)}`;
	}

	function formatNumber(value: number): string {
		if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
		if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
		return value.toString();
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'completed':
			case 'ready':
				return 'bg-emerald-500';
			case 'running':
				return 'bg-blue-500';
			case 'pending':
				return 'bg-amber-500';
			case 'failed':
				return 'bg-red-500';
			case 'suspended':
				return 'bg-purple-500';
			default:
				return 'bg-gray-500';
		}
	}

	function getSuccessRate(): number {
		if (!data.stats || data.stats.execution.totalExecutions === 0) return 0;
		return (data.stats.execution.completedExecutions / data.stats.execution.totalExecutions) * 100;
	}

	function getTaskCompletionRate(): number {
		if (!data.stats || data.stats.execution.totalTasks === 0) return 0;
		return (data.stats.execution.completedTasks / data.stats.execution.totalTasks) * 100;
	}
</script>

<svelte:head>
	<title>AgentBoard - AsyncAgent</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex justify-between items-center">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">AgentBoard</h1>
			<p class="text-gray-500 mt-1">DAG Planning & Execution Statistics</p>
		</div>
		{#if data.error}
			<Badge variant="destructive">Connection Error</Badge>
		{:else}
			<Badge variant="default">Live</Badge>
		{/if}
	</div>

	{#if data.error}
		<div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
			<p class="font-semibold">Failed to load AgentBoard data</p>
			<p class="text-sm mt-1">{data.error}</p>
		</div>
	{/if}

	{#if data.stats}
		<!-- Key Metrics Row -->
		<section>
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<!-- Total Cost Card -->
				<Card class="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
					<CardContent class="pt-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-violet-100 text-sm font-medium">Total Cost</p>
								<p class="text-3xl font-bold mt-1">
									{formatCurrency(data.stats.planning.totalPlanningCostUsd + data.stats.execution.totalExecutionCostUsd)}
								</p>
							</div>
							<div class="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
								<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
						</div>
						<div class="mt-3 flex gap-4 text-sm text-violet-100">
							<span>Planning: {formatCurrency(data.stats.planning.totalPlanningCostUsd)}</span>
							<span>Execution: {formatCurrency(data.stats.execution.totalExecutionCostUsd)}</span>
						</div>
					</CardContent>
				</Card>

				<!-- Success Rate Card -->
				<Card class="bg-gradient-to-br from-emerald-500 to-green-600 text-white">
					<CardContent class="pt-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-emerald-100 text-sm font-medium">Success Rate</p>
								<p class="text-3xl font-bold mt-1">{getSuccessRate().toFixed(1)}%</p>
							</div>
							<div class="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
								<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
						</div>
						<div class="mt-3">
							<div class="w-full bg-white/30 rounded-full h-2">
								<div class="bg-white rounded-full h-2" style="width: {getSuccessRate()}%"></div>
							</div>
						</div>
					</CardContent>
				</Card>

				<!-- Active Schedules Card -->
				<Card class="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
					<CardContent class="pt-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-blue-100 text-sm font-medium">Active Schedules</p>
								<p class="text-3xl font-bold mt-1">{data.stats.schedules.activeDagSchedules}</p>
							</div>
							<div class="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
								<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
						</div>
						<p class="mt-3 text-sm text-blue-100">
							{data.stats.schedules.totalScheduledDags} total scheduled DAGs
						</p>
					</CardContent>
				</Card>

				<!-- Tokens Used Card -->
				<Card class="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
					<CardContent class="pt-6">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-amber-100 text-sm font-medium">Planning Tokens</p>
								<p class="text-3xl font-bold mt-1">{formatNumber(data.stats.planning.totalPlanningTokens)}</p>
							</div>
							<div class="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
								<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
							</div>
						</div>
						<p class="mt-3 text-sm text-amber-100">
							Used for DAG decomposition
						</p>
					</CardContent>
				</Card>
			</div>
		</section>

		<!-- Detailed Stats Tabs -->
		<Tabs.Root value="planning" class="w-full">
			<Tabs.List class="grid w-full grid-cols-3">
				<Tabs.Trigger value="planning">Planning</Tabs.Trigger>
				<Tabs.Trigger value="execution">Execution</Tabs.Trigger>
				<Tabs.Trigger value="health">System Health</Tabs.Trigger>
			</Tabs.List>

			<!-- Planning Tab -->
			<Tabs.Content value="planning" class="mt-4">
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium text-gray-500">Total DAGs</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-3xl font-bold">{data.stats.planning.totalDags}</div>
							<div class="flex gap-2 mt-3 flex-wrap">
								<Badge variant="secondary" class="bg-emerald-100 text-emerald-700">
									{data.stats.planning.readyDags} Ready
								</Badge>
								<Badge variant="secondary" class="bg-amber-100 text-amber-700">
									{data.stats.planning.pendingDags} Pending
								</Badge>
								<Badge variant="secondary" class="bg-red-100 text-red-700">
									{data.stats.planning.failedDags} Failed
								</Badge>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium text-gray-500">Planning Cost</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-3xl font-bold text-violet-600">
								{formatCurrency(data.stats.planning.totalPlanningCostUsd)}
							</div>
							<p class="text-sm text-gray-500 mt-2">
								Avg: {formatCurrency(data.stats.planning.totalDags > 0 ? data.stats.planning.totalPlanningCostUsd / data.stats.planning.totalDags : 0)} per DAG
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium text-gray-500">Token Usage</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-3xl font-bold text-amber-600">
								{formatNumber(data.stats.planning.totalPlanningTokens)}
							</div>
							<p class="text-sm text-gray-500 mt-2">
								Avg: {formatNumber(data.stats.planning.totalDags > 0 ? Math.round(data.stats.planning.totalPlanningTokens / data.stats.planning.totalDags) : 0)} tokens per DAG
							</p>
						</CardContent>
					</Card>
				</div>

				<!-- DAG Status Distribution -->
				<Card class="mt-4">
					<CardHeader>
						<CardTitle>DAG Status Distribution</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="flex gap-2 h-4 rounded-full overflow-hidden bg-gray-100">
							{#if data.stats.planning.totalDags > 0}
								<div 
									class="bg-emerald-500 transition-all" 
									style="width: {(data.stats.planning.readyDags / data.stats.planning.totalDags) * 100}%"
								></div>
								<div 
									class="bg-amber-500 transition-all" 
									style="width: {(data.stats.planning.pendingDags / data.stats.planning.totalDags) * 100}%"
								></div>
								<div 
									class="bg-red-500 transition-all" 
									style="width: {(data.stats.planning.failedDags / data.stats.planning.totalDags) * 100}%"
								></div>
							{/if}
						</div>
						<div class="flex justify-between mt-3 text-sm text-gray-600">
							<span class="flex items-center gap-2">
								<span class="w-3 h-3 rounded-full bg-emerald-500"></span>
								Ready ({data.stats.planning.readyDags})
							</span>
							<span class="flex items-center gap-2">
								<span class="w-3 h-3 rounded-full bg-amber-500"></span>
								Pending ({data.stats.planning.pendingDags})
							</span>
							<span class="flex items-center gap-2">
								<span class="w-3 h-3 rounded-full bg-red-500"></span>
								Failed ({data.stats.planning.failedDags})
							</span>
						</div>
					</CardContent>
				</Card>
			</Tabs.Content>

			<!-- Execution Tab -->
			<Tabs.Content value="execution" class="mt-4">
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium text-gray-500">Total Executions</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-3xl font-bold">{data.stats.execution.totalExecutions}</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium text-gray-500">Running</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-3xl font-bold text-blue-600">{data.stats.execution.runningExecutions}</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium text-gray-500">Completed</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-3xl font-bold text-emerald-600">{data.stats.execution.completedExecutions}</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="pb-2">
							<CardTitle class="text-sm font-medium text-gray-500">Failed</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-3xl font-bold text-red-600">{data.stats.execution.failedExecutions}</div>
						</CardContent>
					</Card>
				</div>

				<div class="grid gap-4 md:grid-cols-2 mt-4">
					<!-- Execution Cost -->
					<Card>
						<CardHeader>
							<CardTitle>Execution Cost</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="text-4xl font-bold text-violet-600">
								{formatCurrency(data.stats.execution.totalExecutionCostUsd)}
							</div>
							<p class="text-sm text-gray-500 mt-2">
								Avg: {formatCurrency(data.stats.execution.totalExecutions > 0 ? data.stats.execution.totalExecutionCostUsd / data.stats.execution.totalExecutions : 0)} per execution
							</p>
						</CardContent>
					</Card>

					<!-- Task Completion -->
					<Card>
						<CardHeader>
							<CardTitle>Task Completion</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="flex items-baseline gap-2">
								<span class="text-4xl font-bold text-emerald-600">{data.stats.execution.completedTasks}</span>
								<span class="text-xl text-gray-400">/ {data.stats.execution.totalTasks}</span>
							</div>
							<div class="mt-3">
								<div class="w-full bg-gray-200 rounded-full h-3">
									<div 
										class="bg-emerald-500 rounded-full h-3 transition-all" 
										style="width: {getTaskCompletionRate()}%"
									></div>
								</div>
								<p class="text-sm text-gray-500 mt-2">
									{getTaskCompletionRate().toFixed(1)}% completion rate • {data.stats.execution.failedTasks} failed tasks
								</p>
							</div>
						</CardContent>
					</Card>
				</div>

				<!-- Execution Status Distribution -->
				<Card class="mt-4">
					<CardHeader>
						<CardTitle>Execution Status Distribution</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-5 gap-4">
							<div class="text-center">
								<div class="h-24 flex items-end justify-center">
									<div 
										class="w-12 bg-emerald-500 rounded-t"
										style="height: {data.stats.execution.totalExecutions > 0 ? (data.stats.execution.completedExecutions / data.stats.execution.totalExecutions) * 100 : 0}%"
									></div>
								</div>
								<p class="text-sm font-medium mt-2">Completed</p>
								<p class="text-lg font-bold">{data.stats.execution.completedExecutions}</p>
							</div>
							<div class="text-center">
								<div class="h-24 flex items-end justify-center">
									<div 
										class="w-12 bg-blue-500 rounded-t"
										style="height: {data.stats.execution.totalExecutions > 0 ? (data.stats.execution.runningExecutions / data.stats.execution.totalExecutions) * 100 : 0}%"
									></div>
								</div>
								<p class="text-sm font-medium mt-2">Running</p>
								<p class="text-lg font-bold">{data.stats.execution.runningExecutions}</p>
							</div>
							<div class="text-center">
								<div class="h-24 flex items-end justify-center">
									<div 
										class="w-12 bg-red-500 rounded-t"
										style="height: {data.stats.execution.totalExecutions > 0 ? (data.stats.execution.failedExecutions / data.stats.execution.totalExecutions) * 100 : 0}%"
									></div>
								</div>
								<p class="text-sm font-medium mt-2">Failed</p>
								<p class="text-lg font-bold">{data.stats.execution.failedExecutions}</p>
							</div>
							<div class="text-center">
								<div class="h-24 flex items-end justify-center">
									<div 
										class="w-12 bg-purple-500 rounded-t"
										style="height: {data.stats.execution.totalExecutions > 0 ? (data.stats.execution.suspendedExecutions / data.stats.execution.totalExecutions) * 100 : 0}%"
									></div>
								</div>
								<p class="text-sm font-medium mt-2">Suspended</p>
								<p class="text-lg font-bold">{data.stats.execution.suspendedExecutions}</p>
							</div>
							<div class="text-center">
								<div class="h-24 flex items-end justify-center">
									<div 
										class="w-12 bg-gray-400 rounded-t"
										style="height: {data.stats.execution.totalExecutions > 0 ? ((data.stats.execution.totalExecutions - data.stats.execution.completedExecutions - data.stats.execution.runningExecutions - data.stats.execution.failedExecutions - data.stats.execution.suspendedExecutions) / data.stats.execution.totalExecutions) * 100 : 0}%"
									></div>
								</div>
								<p class="text-sm font-medium mt-2">Other</p>
								<p class="text-lg font-bold">{data.stats.execution.totalExecutions - data.stats.execution.completedExecutions - data.stats.execution.runningExecutions - data.stats.execution.failedExecutions - data.stats.execution.suspendedExecutions}</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</Tabs.Content>

			<!-- Health Tab -->
			<Tabs.Content value="health" class="mt-4">
				{#if data.health}
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						<Card class="border-l-4 border-l-emerald-500">
							<CardHeader class="pb-2">
								<CardTitle class="text-sm font-medium text-gray-500">System Status</CardTitle>
							</CardHeader>
							<CardContent>
								<Badge variant="default" class="text-lg bg-emerald-500">{data.health.status}</Badge>
								<p class="text-sm text-gray-500 mt-3">
									Last checked: {formatRelativeTime(data.health.timestamp)}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader class="pb-2">
								<CardTitle class="text-sm font-medium text-gray-500">LLM Provider</CardTitle>
							</CardHeader>
							<CardContent>
								<div class="text-2xl font-bold text-gray-900 capitalize">{data.health.provider}</div>
								<p class="text-sm text-gray-500 mt-2">Active provider</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader class="pb-2">
								<CardTitle class="text-sm font-medium text-gray-500">Model</CardTitle>
							</CardHeader>
							<CardContent>
								<div class="text-2xl font-bold text-gray-900">{data.health.model}</div>
								<p class="text-sm text-gray-500 mt-2">Current model</p>
							</CardContent>
						</Card>
					</div>

					<Card class="mt-4">
						<CardHeader>
							<CardTitle>Scheduler Status</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="flex items-center gap-6">
								<div class="flex-1">
									<p class="text-sm text-gray-500">Active Schedules</p>
									<p class="text-4xl font-bold text-blue-600">{data.health.scheduler.activeSchedules}</p>
								</div>
								<div class="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
									<svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
							</div>
						</CardContent>
					</Card>
				{:else}
					<Card>
						<CardContent class="py-12 text-center">
							<p class="text-gray-500">Health information unavailable</p>
						</CardContent>
					</Card>
				{/if}
			</Tabs.Content>
		</Tabs.Root>

		<!-- Recent Activity Quick View -->
		<section>
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Recent DAGs</h2>
			<Card>
				<CardContent class="p-0">
					{#if data.dags && data.dags.length > 0}
						<div class="divide-y">
							{#each data.dags.slice(0, 5) as dag}
								<div class="flex items-center justify-between p-4 hover:bg-gray-50">
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 truncate">
											{dag.dagTitle || 'Untitled DAG'}
										</p>
										<p class="text-xs text-gray-500">
											{formatRelativeTime(dag.createdAt)} • {dag.agentName || 'No agent'}
										</p>
									</div>
									<div class="flex items-center gap-3">
										{#if dag.planningTotalCostUsd}
											<span class="text-sm text-violet-600 font-medium">
												{formatCurrency(parseFloat(dag.planningTotalCostUsd))}
											</span>
										{/if}
										<Badge variant={dag.status === 'ready' || dag.status === 'completed' ? 'default' : dag.status === 'failed' ? 'destructive' : 'secondary'}>
											{dag.status}
										</Badge>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="p-8 text-center text-gray-500">
							No DAGs created yet
						</div>
					{/if}
				</CardContent>
			</Card>
		</section>
	{/if}
</div>
