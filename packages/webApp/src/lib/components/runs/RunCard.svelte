<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/ui/card';
	import { Button } from '$lib/ui/button';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { formatDate, formatRelativeTime, truncate } from '$lib/utils/formatters';
	import type { RunWithGoal } from '@async-agent/api-js-client';
	
	export let run: RunWithGoal;
	export let showGoal: boolean = true;
	
	function getDuration(run: RunWithGoal): string {
		if (!run.startedAt || !run.endedAt) return '-';
		const ms = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
	}
	
	function handleClick() {
		goto(`/runs/${run.id}`);
	}
	
	function handleViewDetails(e: MouseEvent) {
		e.stopPropagation();
		goto(`/runs/${run.id}`);
	}
</script>

<button 
	class="w-full text-left"
	on:click={handleClick}
>
	<Card.Root class="hover:shadow-md transition-shadow">
		<Card.Header>
			<div class="flex items-start justify-between">
				<div class="flex-1 space-y-1">
					{#if showGoal && run.goal}
						<Card.Title class="text-lg">
							{truncate(run.goal.objective, 80)}
						</Card.Title>
					{:else}
						<Card.Title class="text-lg font-mono text-muted-foreground">
							Run {run.id.slice(0, 8)}
						</Card.Title>
					{/if}
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<span title={formatDate(run.createdAt)}>
							{formatRelativeTime(run.createdAt)}
						</span>
					</div>
				</div>
				<StatusBadge status={run.status} type="run" />
			</div>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-3 gap-4 text-sm">
				<div>
					<div class="text-muted-foreground mb-1">Steps</div>
					<div class="font-medium">
						{run.stepsExecuted || 0} / {run.stepBudget || 20}
					</div>
				</div>
				<div>
					<div class="text-muted-foreground mb-1">Duration</div>
					<div class="font-medium">{getDuration(run)}</div>
				</div>
				<div>
					<div class="text-muted-foreground mb-1">Status</div>
					<div class="font-medium capitalize">{run.status}</div>
				</div>
			</div>
			
			{#if run.error}
				<div class="mt-3 pt-3 border-t">
					<div class="text-xs text-destructive font-medium mb-1">Error:</div>
					<pre class="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-x-auto">{truncate(run.error, 150)}</pre>
				</div>
			{/if}
			
			<div class="mt-4">
				<Button 
					variant="ghost" 
					size="sm" 
					class="w-full"
					onclick={handleViewDetails}
				>
					View Details →
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</button>
