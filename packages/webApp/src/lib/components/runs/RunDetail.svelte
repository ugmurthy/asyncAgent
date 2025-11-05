<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/ui/button';
	import { Badge } from '$lib/ui/badge';
	import * as Card from '$lib/ui/card';
	import * as Tabs from '$lib/ui/tabs';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import StepsList from './StepsList.svelte';
	import { formatDate, formatRelativeTime } from '$lib/utils/formatters';
	import { runs as runsApi } from '$lib/api/client';
	import { addNotification } from '$lib/stores/notifications';
	import type { Run, Step } from '@async-agent/api-js-client';
	
	export let run: Run;
	export let steps: Step[] = [];
	
	async function deleteRun() {
		if (!confirm('Are you sure you want to delete this run? This action cannot be undone.')) return;
		
		try {
			await runsApi.deleteRun({ id: run.id });
			addNotification('Run deleted successfully', 'success');
			goto(`/goals/${run.goalId}`);
		} catch (error) {
			console.error('Failed to delete run:', error);
			addNotification('Failed to delete run', 'error');
		}
	}
	
	function getDuration(): string {
		if (!run.startedAt || !run.endedAt) return '-';
		const ms = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
	}
	
	$: progress = run.stepBudget ? ((run.stepsExecuted || 0) / run.stepBudget) * 100 : 0;
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div class="space-y-2 flex-1">
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={() => goto(`/goals/${run.goalId}`)}>
					← Back to Goal
				</Button>
			</div>
			<div class="flex items-center gap-3">
				<h1 class="text-3xl font-bold">Run Details</h1>
				<StatusBadge status={run.status} type="run" />
			</div>
		</div>
		
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => goto('/runs')}>
				All Runs
			</Button>
			<Button variant="destructive" onclick={deleteRun}>
				Delete
			</Button>
		</div>
	</div>
	
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm text-muted-foreground">Run ID</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="font-mono text-xs break-all">{run.id}</p>
			</Card.Content>
		</Card.Root>
		
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm text-muted-foreground">Steps Progress</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="space-y-2">
					<p class="text-lg font-bold">{run.stepsExecuted || 0} / {run.stepBudget || 20}</p>
					<div class="w-full bg-muted rounded-full h-2">
						<div 
							class="h-2 rounded-full transition-all"
							class:bg-blue-500={run.status === 'running'}
							class:bg-green-500={run.status === 'completed'}
							class:bg-red-500={run.status === 'failed'}
							class:bg-yellow-500={run.status === 'pending'}
							style="width: {progress}%"
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
		
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm text-muted-foreground">Duration</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="text-lg font-bold">{getDuration()}</p>
			</Card.Content>
		</Card.Root>
		
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Title class="text-sm text-muted-foreground">Created</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="text-sm">{formatRelativeTime(run.createdAt)}</p>
			</Card.Content>
		</Card.Root>
	</div>
	
	<Tabs.Root value="steps" class="w-full">
		<Tabs.List class="grid w-full grid-cols-3">
			<Tabs.Trigger value="steps">Steps ({steps.length})</Tabs.Trigger>
			<Tabs.Trigger value="details">Details</Tabs.Trigger>
			<Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
		</Tabs.List>
		
		<Tabs.Content value="steps" class="mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Execution Steps</Card.Title>
				</Card.Header>
				<Card.Content>
					<StepsList {steps} />
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
		
		<Tabs.Content value="details" class="mt-4">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Card.Root>
					<Card.Header>
						<Card.Title>Timing</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-3">
						<div class="flex justify-between">
							<span class="text-muted-foreground">Created:</span>
							<span class="text-sm" title={formatDate(run.createdAt)}>
								{formatRelativeTime(run.createdAt)}
							</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Started:</span>
							<span class="text-sm" title={run.startedAt ? formatDate(run.startedAt) : ''}>
								{run.startedAt ? formatRelativeTime(run.startedAt) : 'Not started'}
							</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Ended:</span>
							<span class="text-sm" title={run.endedAt ? formatDate(run.endedAt) : ''}>
								{run.endedAt ? formatRelativeTime(run.endedAt) : 'In progress'}
							</span>
						</div>
					</Card.Content>
				</Card.Root>
				
				<Card.Root>
					<Card.Header>
						<Card.Title>Goal Information</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-3">
						<div>
						<span class="text-muted-foreground block mb-1">Goal ID:</span>
						<button 
						class="font-mono text-xs text-blue-600 hover:underline break-all" 
						onclick={() => goto(`/goals/${run.goalId}`)}
						>
						{run.goalId}
						</button>
						</div>
						<div>
							<span class="text-muted-foreground block mb-1">Step Budget:</span>
							<span class="font-medium">{run.stepBudget || 20}</span>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
			
			{#if run.error}
				<Card.Root class="mt-4">
					<Card.Header>
						<Card.Title class="text-destructive">Error</Card.Title>
					</Card.Header>
					<Card.Content>
						<pre class="text-sm bg-destructive/10 text-destructive p-4 rounded overflow-x-auto border border-destructive/20">{run.error}</pre>
					</Card.Content>
				</Card.Root>
			{/if}
		</Tabs.Content>
		
		<Tabs.Content value="timeline" class="mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Run Timeline</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<div class="flex gap-4">
							<div class="flex flex-col items-center">
								<div class="w-3 h-3 rounded-full bg-blue-500" />
								<div class="w-0.5 flex-1 bg-border min-h-8" />
							</div>
							<div class="flex-1 pb-8">
								<div class="font-medium">Run Created</div>
								<div class="text-sm text-muted-foreground">{formatDate(run.createdAt)}</div>
							</div>
						</div>
						
						{#if run.startedAt}
							<div class="flex gap-4">
								<div class="flex flex-col items-center">
									<div class="w-3 h-3 rounded-full bg-green-500" />
									<div class="w-0.5 flex-1 bg-border min-h-8" />
								</div>
								<div class="flex-1 pb-8">
									<div class="font-medium">Execution Started</div>
									<div class="text-sm text-muted-foreground">{formatDate(run.startedAt)}</div>
								</div>
							</div>
						{/if}
						
						{#if run.endedAt}
							<div class="flex gap-4">
								<div class="flex flex-col items-center">
									<div class="w-3 h-3 rounded-full {run.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}" />
								</div>
								<div class="flex-1">
									<div class="font-medium">
										{run.status === 'completed' ? 'Completed Successfully' : 'Execution Failed'}
									</div>
									<div class="text-sm text-muted-foreground">{formatDate(run.endedAt)}</div>
								</div>
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
