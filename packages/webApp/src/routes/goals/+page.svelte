<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { Button } from '$lib/ui/button';
	import { Input } from '$lib/ui/input';
	import { Badge } from '$lib/ui/badge';
	import * as Table from '$lib/ui/table';
	import * as DropdownMenu from '$lib/ui/dropdown-menu';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { formatDate, formatRelativeTime, truncate, formatCronExpression } from '$lib/utils/formatters';
	import { goals as goalsApi } from '$lib/api/client';
	import { addNotification } from '$lib/stores/notifications';
	import type { PageData } from './$types';
	import type { GoalWithSchedules } from '@async-agent/api-js-client';
	
	export let data: PageData;
	
	let searchQuery = '';
	let statusFilter: 'all' | 'active' | 'paused' = 'all';
	let sortField: 'createdAt' | 'updatedAt' | 'objective' = 'createdAt';
	let sortDirection: 'asc' | 'desc' = 'desc';
	
	$: filteredGoals = data.goals
		.filter((goal) => {
			if (statusFilter !== 'all' && goal.status !== statusFilter) return false;
			if (searchQuery && !goal.objective.toLowerCase().includes(searchQuery.toLowerCase())) return false;
			return true;
		})
		.sort((a, b) => {
			let aVal: any, bVal: any;
			const field = sortField as 'createdAt' | 'updatedAt' | 'objective';
			const direction = sortDirection as 'asc' | 'desc';
			
			if (field === 'objective') {
				aVal = a.objective;
				bVal = b.objective;
			} else {
				aVal = new Date(a[field]);
				bVal = new Date(b[field]);
			}
			
			if (direction === 'asc') {
				return aVal > bVal ? 1 : -1;
			} else {
				return aVal < bVal ? 1 : -1;
			}
		});
	
	async function triggerRun(goalId: string) {
		try {
			await goalsApi.triggerGoalRun({ id: goalId, requestBody: {} });
			addNotification('Run triggered successfully', 'success');
			invalidate('goals:list');
		} catch (error) {
			addNotification('Failed to trigger run', 'error');
		}
	}
	
	async function pauseGoal(goalId: string) {
		try {
			await goalsApi.pauseGoal({ id: goalId, requestBody: {} });
			addNotification('Goal paused', 'success');
			invalidate('goals:list');
			data.goals = await goalsApi.listGoals({});
		} catch (error) {
			addNotification('Failed to pause goal', 'error');
		}
	}
	
	async function resumeGoal(goalId: string) {
		try {
			await goalsApi.resumeGoal({ id: goalId, requestBody: {} });
			addNotification('Goal resumed', 'success');
			invalidate('goals:list');
			data.goals = await goalsApi.listGoals({});
		} catch (error) {
			addNotification('Failed to resume goal', 'error');
		}
	}
	
	async function deleteGoal(goalId: string) {
		if (!confirm('Are you sure you want to delete this goal?')) return;
		
		try {
			await goalsApi.deleteGoal({ id: goalId });
			addNotification('Goal deleted', 'success');
			data.goals = await goalsApi.listGoals({});
		} catch (error) {
			addNotification('Failed to delete goal', 'error');
		}
	}
	
	function getScheduleDisplay(goal: GoalWithSchedules): string {
		const activeSchedule = goal.schedules?.find(s => s.active);
		if (!activeSchedule) return 'No schedule';
		return formatCronExpression(activeSchedule.cronExpr);
	}
</script>

<svelte:head>
	<title>Goals - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Goals</h1>
			<p class="text-muted-foreground">Manage your agent goals and schedules</p>
		</div>
		<Button onclick={() => goto('/goals/new')}>
			Create Goal
		</Button>
	</div>
	
	<div class="flex gap-4 items-center">
		<Input
			type="search"
			placeholder="Search goals..."
			bind:value={searchQuery}
			class="max-w-sm"
		/>
		
		<select
			bind:value={statusFilter}
			class="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<option value="all">All Status</option>
			<option value="active">Active</option>
			<option value="paused">Paused</option>
		</select>
		
		<div class="text-sm text-muted-foreground">
			{filteredGoals.length} goal{filteredGoals.length !== 1 ? 's' : ''}
		</div>
	</div>
	
	{#if filteredGoals.length === 0}
		<EmptyState
			title="No goals found"
			description={searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first goal to get started'}
			icon="🎯"
		>
			{#if !searchQuery && statusFilter === 'all'}
				<Button onclick={() => goto('/goals/new')}>
					Create Your First Goal
				</Button>
			{/if}
		</EmptyState>
	{:else}
		<div class="border rounded-lg">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Status</Table.Head>
						<Table.Head>Objective</Table.Head>
						<Table.Head>Schedule</Table.Head>
						<Table.Head>Created</Table.Head>
						<Table.Head>Updated</Table.Head>
						<Table.Head class="text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredGoals as goal (goal.id)}
					<Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => goto(`/goals/${goal.id}`)}>
					<Table.Cell>
					<StatusBadge status={goal.status} type="goal" />
					</Table.Cell>
							<Table.Cell class="font-medium max-w-md">
								<div class="truncate" title={goal.objective}>
									{truncate(goal.objective, 80)}
								</div>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm text-muted-foreground">
									{getScheduleDisplay(goal)}
								</span>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm text-muted-foreground" title={formatDate(goal.createdAt)}>
									{formatRelativeTime(goal.createdAt)}
								</span>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm text-muted-foreground" title={formatDate(goal.updatedAt)}>
									{formatRelativeTime(goal.updatedAt)}
								</span>
							</Table.Cell>
							<Table.Cell class="text-right">
							<div onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }} role="presentation">
							<DropdownMenu.Root>
							<DropdownMenu.Trigger>
							<Button variant="ghost" size="sm">
							  Actions
							  </Button>
							 </DropdownMenu.Trigger>
							<DropdownMenu.Content>
							<DropdownMenu.Item onclick={() => goto(`/goals/${goal.id}`)}>
							  View Details
							 </DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => triggerRun(goal.id)}>
							  Trigger Run
							 </DropdownMenu.Item>
							 <DropdownMenu.Separator />
							{#if goal.status === 'active'}
							<DropdownMenu.Item onclick={() => pauseGoal(goal.id)}>
							  Pause Goal
							  </DropdownMenu.Item>
							{:else if goal.status === 'paused'}
							<DropdownMenu.Item onclick={() => resumeGoal(goal.id)}>
							  Resume Goal
							  </DropdownMenu.Item>
							 {/if}
							 <DropdownMenu.Separator />
							<DropdownMenu.Item class="text-destructive" onclick={() => deleteGoal(goal.id)}>
							  Delete Goal
							  </DropdownMenu.Item>
							  </DropdownMenu.Content>
							  </DropdownMenu.Root>
							</div>
						</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>
