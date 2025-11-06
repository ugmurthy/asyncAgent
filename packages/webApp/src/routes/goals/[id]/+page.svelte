<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/ui/button';
	import { Badge } from '$lib/ui/badge';
	import * as Card from '$lib/ui/card';
	import * as Table from '$lib/ui/table';
	import * as Tabs from '$lib/ui/tabs';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { formatDate, formatRelativeTime, formatCronExpression } from '$lib/utils/formatters';
	import { goals as goalsApi } from '$lib/api/client';
	import { addNotification } from '$lib/stores/notifications';
	import type { PageData } from './$types';
	
	export let data: PageData;
	
	$: goal = data.goal;
	$: goalRuns = data.runs;
	$: agent = data.agent;
	$: activeSchedule = goal.schedules?.find(s => s.active);
	
	async function triggerRun() {
		try {
			await goalsApi.triggerGoalRun({ id: goal.id, requestBody: {} });
			addNotification('Run triggered successfully', 'success');
			setTimeout(() => location.reload(), 500);
		} catch (error) {
			addNotification('Failed to trigger run', 'error');
		}
	}
	
	async function pauseGoal() {
		try {
			await goalsApi.pauseGoal({ id: goal.id, requestBody: {} });
			addNotification('Goal paused', 'success');
			location.reload();
		} catch (error) {
			addNotification('Failed to pause goal', 'error');
		}
	}
	
	async function resumeGoal() {
		try {
			await goalsApi.resumeGoal({ id: goal.id, requestBody: {} });
			addNotification('Goal resumed', 'success');
			location.reload();
		} catch (error) {
			addNotification('Failed to resume goal', 'error');
		}
	}
	
	async function deleteGoal() {
		if (!confirm('Are you sure you want to delete this goal? This action cannot be undone.')) return;
		
		try {
			await goalsApi.deleteGoal({ id: goal.id });
			addNotification('Goal deleted', 'success');
			goto('/goals');
		} catch (error) {
			addNotification('Failed to delete goal', 'error');
		}
	}
</script>

<svelte:head>
	<title>Goal: {goal.objective.substring(0, 50)} - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 space-y-6">
	<div class="flex items-start justify-between">
		<div class="space-y-2 flex-1">
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={() => goto('/goals')}>
					← Back to Goals
				</Button>
			</div>
			<div class="flex items-center gap-3">
				<h1 class="text-3xl font-bold">Goal Details</h1>
				<StatusBadge status={goal.status} type="goal" />
			</div>
		</div>
		
		<div class="flex gap-2">
			<Button variant="default" onclick={triggerRun}>
				Trigger Run
			</Button>
			{#if goal.status === 'active'}
				<Button variant="outline" onclick={pauseGoal}>
					Pause
				</Button>
			{:else if goal.status === 'paused'}
				<Button variant="outline" onclick={resumeGoal}>
					Resume
				</Button>
			{/if}
			<Button variant="destructive" onclick={deleteGoal}>
				Delete
			</Button>
		</div>
	</div>
	
	<Tabs.Root value="overview">
		<Tabs.List>
			<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
			<Tabs.Trigger value="runs">Runs History ({goalRuns.length})</Tabs.Trigger>
			<Tabs.Trigger value="configuration">Configuration</Tabs.Trigger>
		</Tabs.List>
		
		<Tabs.Content value="overview" class="space-y-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Objective</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="whitespace-pre-wrap">{goal.objective}</p>
				</Card.Content>
			</Card.Root>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Card.Root>
					<Card.Header>
						<Card.Title>Details</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2">
						<div class="flex justify-between">
							<span class="text-muted-foreground">Goal ID:</span>
							<span class="font-mono text-sm">{goal.id}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Status:</span>
							<StatusBadge status={goal.status} type="goal" />
						</div>
						{#if agent}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Agent:</span>
							<Button 
								variant="link" 
								class="h-auto p-0 font-mono text-sm" 
								onclick={() => goto(`/settings/agents/${agent.id}`)}
							>
								{agent.name}
							</Button>
						</div>
						{:else if goal.agentId}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Agent ID:</span>
							<span class="font-mono text-sm">{goal.agentId}</span>
						</div>
						{/if}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Created:</span>
							<span class="text-sm">{formatDate(goal.createdAt)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Updated:</span>
							<span class="text-sm">{formatDate(goal.updatedAt)}</span>
						</div>
					</Card.Content>
				</Card.Root>
				
				<Card.Root>
					<Card.Header>
						<Card.Title>Schedule</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2">
						{#if activeSchedule}
						<div class="flex justify-between">
						<span class="text-muted-foreground">Cron Expression:</span>
						<span class="font-mono text-sm">{activeSchedule.cronExpr}</span>
						</div>
						<div class="flex justify-between">
						<span class="text-muted-foreground">Description:</span>
						<span class="text-sm">{formatCronExpression(activeSchedule.cronExpr)}</span>
						</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Timezone:</span>
								<span class="text-sm">{activeSchedule.timezone || 'UTC'}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Active:</span>
								<Badge variant={activeSchedule.active ? 'default' : 'secondary'}>
									{activeSchedule.active ? 'Yes' : 'No'}
								</Badge>
							</div>
						{:else}
							<p class="text-muted-foreground">No active schedule</p>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		</Tabs.Content>
		
		<Tabs.Content value="runs" class="space-y-4">
			{#if goalRuns.length === 0}
				<EmptyState
					title="No runs yet"
					description="This goal hasn't been executed yet. Trigger a run to get started."
					icon="🏃"
				>
					<Button onclick={triggerRun}>Trigger First Run</Button>
				</EmptyState>
			{:else}
				<div class="border rounded-lg">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Status</Table.Head>
								<Table.Head>Run ID</Table.Head>
								<Table.Head>Started</Table.Head>
								<Table.Head>Ended</Table.Head>
								<Table.Head>Steps</Table.Head>
								<Table.Head class="text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each goalRuns as run (run.id)}
							<Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => goto(`/runs/${run.id}`)}>
							<Table.Cell>
							<StatusBadge status={run.status} type="run" />
							</Table.Cell>
									<Table.Cell class="font-mono text-sm">{run.id}</Table.Cell>
									<Table.Cell>
										<span class="text-sm text-muted-foreground" title={run.startedAt ? formatDate(run.startedAt) : ''}>
											{run.startedAt ? formatRelativeTime(run.startedAt) : 'Not started'}
										</span>
									</Table.Cell>
									<Table.Cell>
										<span class="text-sm text-muted-foreground" title={run.endedAt ? formatDate(run.endedAt) : ''}>
											{run.endedAt ? formatRelativeTime(run.endedAt) : '-'}
										</span>
									</Table.Cell>
									<Table.Cell>
									<span class="text-sm">{run.stepsExecuted || 0} / {run.stepBudget || 20}</span>
									</Table.Cell>
									<Table.Cell class="text-right">
										<Button variant="ghost" size="sm" onclick={(e) => { e.stopPropagation(); goto(`/runs/${run.id}`); }}>
											View
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{/if}
		</Tabs.Content>
		
		<Tabs.Content value="configuration" class="space-y-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Goal Configuration</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div>
					<h4 class="font-semibold mb-2">Parameters</h4>
					{#if goal.params && Object.keys(goal.params).length > 0}
					<div class="space-y-2">
					{#each Object.entries(goal.params) as [key, value]}
					<div class="flex justify-between p-2 bg-muted rounded">
					<span class="font-mono text-sm">{key}:</span>
					<span class="font-mono text-sm">{JSON.stringify(value)}</span>
					</div>
					{/each}
					</div>
					{:else}
					<p class="text-muted-foreground">No parameters configured</p>
					{/if}
					</div>
					
					<div>
						<h4 class="font-semibold mb-2">Webhook URL</h4>
						{#if goal.webhookUrl}
							<code class="block p-2 bg-muted rounded text-sm break-all">{goal.webhookUrl}</code>
						{:else}
							<p class="text-muted-foreground">No webhook configured</p>
						{/if}
					</div>
					
					{#if goal.schedules && goal.schedules.length > 0}
						<div>
							<h4 class="font-semibold mb-2">All Schedules</h4>
							<div class="space-y-2">
								{#each goal.schedules as schedule}
								<div class="flex items-center justify-between p-3 border rounded">
								<div class="space-y-1">
								<div class="font-mono text-sm">{schedule.cronExpr}</div>
								<div class="text-xs text-muted-foreground">
								{formatCronExpression(schedule.cronExpr)}
								</div>
								</div>
								<Badge variant={schedule.active ? 'default' : 'secondary'}>
								{schedule.active ? 'Active' : 'Inactive'}
								</Badge>
								</div>
								{/each}
							</div>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
