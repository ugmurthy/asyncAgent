<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { Button } from '$lib/ui/button';
	import { Input } from '$lib/ui/input';
	import { Textarea } from '$lib/ui/textarea';
	import { Badge } from '$lib/ui/badge';
	import * as Card from '$lib/ui/card';
	import * as Tabs from '$lib/ui/tabs';
	import PromptEditor from '$lib/components/agents/PromptEditor.svelte';
	import { formatDate, formatRelativeTime } from '$lib/utils/formatters';
	import { agents as agentsApi } from '$lib/api/client';
	import { addNotification } from '$lib/stores/notifications';
	import type { PageData } from './$types';
	import { ArrowLeft, CheckCircle2, Circle, Trash2, Edit, Save, X } from '@lucide/svelte';
	
	export let data: PageData;
	
	let isActivating = false;
	let isDeleting = false;
	let isEditing = false;
	let isSaving = false;
	
	let editName = data.agent.name;
	let editVersion = data.agent.version;
	let editProvider = data.agent.provider || '';
	let editModel = data.agent.model || '';
	let editPromptTemplate = data.agent.promptTemplate;
	let editMetadata = JSON.stringify(data.agent.metadata || {}, null, 2);
	
	function startEditing() {
		editName = data.agent.name;
		editVersion = data.agent.version;
		editProvider = data.agent.provider || '';
		editModel = data.agent.model || '';
		editPromptTemplate = data.agent.promptTemplate;
		editMetadata = JSON.stringify(data.agent.metadata || {}, null, 2);
		isEditing = true;
	}
	
	function cancelEditing() {
		isEditing = false;
	}
	
	async function saveChanges() {
		isSaving = true;
		try {
			let metadata = {};
			try {
				metadata = JSON.parse(editMetadata);
			} catch (e) {
				addNotification('Invalid JSON in metadata', 'error');
				isSaving = false;
				return;
			}
			
			await agentsApi.updateAgent({
				id: data.agent.id,
				requestBody: {
					name: editName,
					version: editVersion,
					provider: editProvider || undefined,
					model: editModel || undefined,
					promptTemplate: editPromptTemplate,
					metadata
				}
			});
			
			addNotification('Agent updated successfully', 'success');
			isEditing = false;
			invalidate('agents:list');
			window.location.reload();
		} catch (error: any) {
			addNotification(error.message || 'Failed to update agent', 'error');
		} finally {
			isSaving = false;
		}
	}
	
	async function activateAgent() {
		isActivating = true;
		try {
			await agentsApi.activateAgent({ id: data.agent.id });
			addNotification('Agent activated successfully', 'success');
			invalidate('agents:list');
			// Reload the page data
			window.location.reload();
		} catch (error: any) {
			addNotification(error.message || 'Failed to activate agent', 'error');
		} finally {
			isActivating = false;
		}
	}
	
	async function deleteAgent() {
		if (!confirm(`Are you sure you want to delete agent "${data.agent.name}" (${data.agent.version})?`)) {
			return;
		}
		
		isDeleting = true;
		try {
			await agentsApi.deleteAgent({ id: data.agent.id });
			addNotification('Agent deleted successfully', 'success');
			goto('/settings/agents');
		} catch (error: any) {
			addNotification(error.message || 'Failed to delete agent', 'error');
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>{data.agent.name} ({data.agent.version}) - AsyncAgent</title>
</svelte:head>

<div>
	<!-- Back Button -->
	<Button
		variant="ghost"
		onclick={() => goto('/settings/agents')}
		class="mb-4"
	>
		<ArrowLeft class="h-4 w-4 mr-2" />
		Back to Agents
	</Button>
	
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<div class="flex items-center gap-3 mb-2">
				<h1 class="text-3xl font-bold text-gray-900">{data.agent.name}</h1>
				{#if data.agent.active}
					<Badge variant="default" class="flex items-center gap-1">
						<CheckCircle2 class="h-3 w-3" />
						Active
					</Badge>
				{:else}
					<Badge variant="outline" class="flex items-center gap-1">
						<Circle class="h-3 w-3" />
						Inactive
					</Badge>
				{/if}
			</div>
			<p class="text-gray-600">Version: <code class="bg-gray-100 px-2 py-1 rounded text-sm">{data.agent.version}</code></p>
		</div>
		
		<div class="flex gap-2">
			{#if isEditing}
				<Button onclick={cancelEditing} variant="outline" disabled={isSaving}>
					<X class="h-4 w-4 mr-2" />
					Cancel
				</Button>
				<Button onclick={saveChanges} disabled={isSaving}>
					<Save class="h-4 w-4 mr-2" />
					{isSaving ? 'Saving...' : 'Save Changes'}
				</Button>
			{:else}
				<Button onclick={startEditing} variant="outline">
					<Edit class="h-4 w-4 mr-2" />
					Edit
				</Button>
				{#if !data.agent.active}
					<Button onclick={activateAgent} disabled={isActivating}>
						<CheckCircle2 class="h-4 w-4 mr-2" />
						{isActivating ? 'Activating...' : 'Activate'}
					</Button>
				{/if}
				<Button
					variant="destructive"
					onclick={deleteAgent}
					disabled={isDeleting || data.agent.active}
				>
					<Trash2 class="h-4 w-4 mr-2" />
					{isDeleting ? 'Deleting...' : 'Delete'}
				</Button>
			{/if}
		</div>
	</div>
	
	<!-- Tabs -->
	<Tabs.Root value="details" class="space-y-6">
		<Tabs.List>
			<Tabs.Trigger value="details">Details</Tabs.Trigger>
			<Tabs.Trigger value="prompt">Prompt Template</Tabs.Trigger>
		</Tabs.List>
		
		<Tabs.Content value="details">
			<div class="grid gap-6 md:grid-cols-2">
				<Card.Root>
					<Card.Header>
						<Card.Title>Basic Information</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div>
							<label class="text-sm font-medium text-gray-600">Name</label>
							{#if isEditing}
								<Input bind:value={editName} disabled={isSaving} />
							{:else}
								<p class="text-lg font-semibold">{data.agent.name}</p>
							{/if}
						</div>
						<div>
							<label class="text-sm font-medium text-gray-600">Version</label>
							{#if isEditing}
								<Input bind:value={editVersion} disabled={isSaving} />
							{:else}
								<p class="text-lg font-mono">{data.agent.version}</p>
							{/if}
						</div>
						<div>
							<label class="text-sm font-medium text-gray-600">Provider</label>
							{#if isEditing}
								<Input bind:value={editProvider} disabled={isSaving} placeholder="e.g., openai" />
							{:else}
								<p class="text-lg">{data.agent.provider || 'Not specified'}</p>
							{/if}
						</div>
						<div>
							<label class="text-sm font-medium text-gray-600">Model</label>
							{#if isEditing}
								<Input bind:value={editModel} disabled={isSaving} placeholder="e.g., gpt-4o" />
							{:else}
								<p class="text-lg">{data.agent.model || 'Not specified'}</p>
							{/if}
						</div>
						<div>
							<label class="text-sm font-medium text-gray-600">Status</label>
							<p class="text-lg">
								{#if data.agent.active}
									<span class="text-green-600 font-semibold">Active</span>
								{:else}
									<span class="text-gray-500">Inactive</span>
								{/if}
							</p>
						</div>
					</Card.Content>
				</Card.Root>
				
				<Card.Root>
					<Card.Header>
						<Card.Title>Timestamps</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div>
							<label class="text-sm font-medium text-gray-600">Created</label>
							<p class="text-lg">{formatDate(data.agent.createdAt)}</p>
							<p class="text-sm text-gray-500">{formatRelativeTime(data.agent.createdAt)}</p>
						</div>
						<div>
							<label class="text-sm font-medium text-gray-600">Last Updated</label>
							<p class="text-lg">{formatDate(data.agent.updatedAt)}</p>
							<p class="text-sm text-gray-500">{formatRelativeTime(data.agent.updatedAt)}</p>
						</div>
					</Card.Content>
				</Card.Root>
				
				<Card.Root class="md:col-span-2">
					<Card.Header>
						<Card.Title>Metadata</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if isEditing}
							<Textarea
								bind:value={editMetadata}
								disabled={isSaving}
								rows={10}
								class="font-mono text-sm"
								placeholder="{'{}'}"
							/>
							<p class="text-xs text-gray-500 mt-2">
								Enter valid JSON
							</p>
						{:else}
							{#if data.agent.metadata && Object.keys(data.agent.metadata).length > 0}
								<pre class="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">{JSON.stringify(data.agent.metadata, null, 2)}</pre>
							{:else}
								<p class="text-gray-500">No metadata defined</p>
							{/if}
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		</Tabs.Content>
		
		<Tabs.Content value="prompt">
			{#if isEditing}
				<Card.Root>
					<Card.Header>
						<Card.Title>Prompt Template</Card.Title>
						<Card.Description>
							Use placeholders like &#123;&#123;objective&#125;&#125;, &#123;&#123;tools&#125;&#125;, &#123;&#123;stepBudget&#125;&#125;, &#123;&#123;CurrentDate&#125;&#125;, etc.
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<Textarea
							bind:value={editPromptTemplate}
							disabled={isSaving}
							rows={20}
							class="font-mono text-sm"
						/>
					</Card.Content>
				</Card.Root>
			{:else}
				<PromptEditor
					promptTemplate={data.agent.promptTemplate}
					readonly={true}
				/>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
