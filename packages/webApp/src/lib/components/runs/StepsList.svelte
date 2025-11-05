<script lang="ts">
	import StepCard from './StepCard.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Badge } from '$lib/ui/badge';
	import type { Step } from '@async-agent/api-js-client';
	
	export let steps: Step[] = [];
	export let compact: boolean = false;
	
	$: sortedSteps = [...steps].sort((a, b) => a.stepNo - b.stepNo);
	$: stepStats = {
		total: steps.length,
		tool_use: steps.filter(s => !!s.toolName && !s.error).length,
		thinking: steps.filter(s => !s.toolName && !s.error).length,
		error: steps.filter(s => !!s.error).length
	};
</script>

<div class="space-y-4">
	{#if !compact && steps.length > 0}
		<div class="flex gap-2 flex-wrap">
			<Badge variant="outline">
				Total: {stepStats.total}
			</Badge>
			{#if stepStats.tool_use > 0}
				<Badge variant="default">
					🔧 Tools: {stepStats.tool_use}
				</Badge>
			{/if}
			{#if stepStats.thinking > 0}
				<Badge variant="secondary">
					💭 Thinking: {stepStats.thinking}
				</Badge>
			{/if}
			{#if stepStats.error > 0}
				<Badge variant="destructive">
					❌ Errors: {stepStats.error}
				</Badge>
			{/if}
		</div>
	{/if}
	
	{#if steps.length === 0}
		<EmptyState
			title="No steps yet"
			description="This run hasn't executed any steps yet."
			icon="⏳"
		/>
	{:else}
		<div class="space-y-3">
			{#each sortedSteps as step (step.id)}
				<StepCard {step} />
			{/each}
		</div>
	{/if}
</div>
