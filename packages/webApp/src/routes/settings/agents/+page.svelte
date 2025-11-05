<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { Button } from '$lib/ui/button';
	import { Input } from '$lib/ui/input';
	import { Badge } from '$lib/ui/badge';
	import * as Table from '$lib/ui/table';
	import * as DropdownMenu from '$lib/ui/dropdown-menu';
	import * as Dialog from '$lib/ui/dialog';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import CreateAgentDialog from '$lib/components/agents/CreateAgentDialog.svelte';
	import { formatDate, formatRelativeTime } from '$lib/utils/formatters';
	import { agents as agentsApi } from '$lib/api/client';
	import { addNotification } from '$lib/stores/notifications';
	import type { PageData } from './$types';
	import { Plus, MoreVertical, Edit, Trash2, CheckCircle2, Circle } from '@lucide/svelte';
	
	export let data: PageData;
	
	let searchQuery = '';
	let showCreateDialog = false;
	let filterActive: 'all' | 'true' | 'false' = 'all';
	
	$: filteredAgents = data.agents
		.filter((agent) => {
			if (searchQuery && !agent.name.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false;
			}
			if (filterActive !== 'all' && agent.active.toString() !== filterActive) {
				return false;
			}
			return true;
		})
		.sort((a, b) => {
			if (a.active && !b.active) return -1;
			if (!a.active && b.active) return 1;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	
	async function activateAgent(agentId: string) {
		try {
			await agentsApi.activateAgent({ id: agentId });
			addNotification('Agent activated successfully', 'success');
			invalidate('agents:list');
		} catch (error) {
			addNotification('Failed to activate agent', 'error');
		}
	}
	
	async function deleteAgent(agentId: string, agentName: string) {
		if (!confirm(`Are you sure you want to delete agent "${agentName}"?`)) {
			return;
		}
		
		try {
			await agentsApi.deleteAgent({ id: agentId });
			addNotification('Agent deleted successfully', 'success');
			invalidate('agents:list');
		} catch (error: any) {
			addNotification(error.message || 'Failed to delete agent', 'error');
		}
	}
	
	function handleCreateSuccess() {
		showCreateDialog = false;
		invalidate('agents:list');
		addNotification('Agent created successfully', 'success');
	}
</script>

<div>
	<!-- Header Actions -->
	<div class="flex flex-col sm:flex-row gap-4 mb-6">
		<div class="flex-1">
			<Input
				type="search"
				placeholder="Search agents by name..."
				bind:value={searchQuery}
				class="max-w-md"
			/>
		</div>
		
		<div class="flex gap-2">
			<Button
				variant={filterActive === 'all' ? 'default' : 'outline'}
				size="sm"
				onclick={() => filterActive = 'all'}
			>
				All
			</Button>
			<Button
				variant={filterActive === 'true' ? 'default' : 'outline'}
				size="sm"
				onclick={() => filterActive = 'true'}
			>
				Active
			</Button>
			<Button
				variant={filterActive === 'false' ? 'default' : 'outline'}
				size="sm"
				onclick={() => filterActive = 'false'}
			>
				Inactive
			</Button>
		</div>
		
		<Button onclick={() => showCreateDialog = true}>
			<Plus class="h-4 w-4 mr-2" />
			Create Agent
		</Button>
	</div>
	
	<!-- Agents Table -->
	{#if filteredAgents.length === 0}
		<EmptyState
			title="No agents found"
			description={searchQuery || filterActive !== 'all' 
				? "Try adjusting your filters" 
				: "Create your first agent to get started"}
		/>
	{:else}
		<div class="bg-white rounded-lg border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[50px]">Status</Table.Head>
						<Table.Head>Name</Table.Head>
						<Table.Head>Version</Table.Head>
						<Table.Head>Created</Table.Head>
						<Table.Head>Updated</Table.Head>
						<Table.Head class="text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredAgents as agent (agent.id)}
						<Table.Row>
							<Table.Cell>
								{#if agent.active}
									<CheckCircle2 class="h-5 w-5 text-green-600" />
								{:else}
									<Circle class="h-5 w-5 text-gray-400" />
								{/if}
							</Table.Cell>
							<Table.Cell class="font-medium">
								<button
									onclick={() => goto(`/settings/agents/${agent.id}`)}
									class="hover:text-blue-600 transition-colors"
								>
									{agent.name}
								</button>
								{#if agent.active}
									<Badge variant="default" class="ml-2">Active</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<code class="text-sm bg-gray-100 px-2 py-1 rounded">{agent.version}</code>
							</Table.Cell>
							<Table.Cell class="text-gray-600">
								<span class="text-sm" title={formatDate(agent.createdAt)}>
									{formatRelativeTime(agent.createdAt)}
								</span>
							</Table.Cell>
							<Table.Cell class="text-gray-600">
								<span class="text-sm" title={formatDate(agent.updatedAt)}>
									{formatRelativeTime(agent.updatedAt)}
								</span>
							</Table.Cell>
							<Table.Cell class="text-right">
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										<Button variant="ghost" size="sm">
											<MoreVertical class="h-4 w-4" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										<DropdownMenu.Item onclick={() => goto(`/settings/agents/${agent.id}`)}>
											<Edit class="h-4 w-4 mr-2" />
											View/Edit
										</DropdownMenu.Item>
										{#if !agent.active}
											<DropdownMenu.Item onclick={() => activateAgent(agent.id)}>
												<CheckCircle2 class="h-4 w-4 mr-2" />
												Activate
											</DropdownMenu.Item>
										{/if}
										<DropdownMenu.Separator />
										<DropdownMenu.Item
											onclick={() => deleteAgent(agent.id, agent.name)}
											class="text-red-600"
											disabled={agent.active}
										>
											<Trash2 class="h-4 w-4 mr-2" />
											Delete
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>

<!-- Create Agent Dialog -->
<CreateAgentDialog
	open={showCreateDialog}
	onClose={() => showCreateDialog = false}
	onSuccess={handleCreateSuccess}
/>
