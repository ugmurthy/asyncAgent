<script lang="ts">
	import { Button } from '$lib/ui/button';
	import { Input } from '$lib/ui/input';
	import { Textarea } from '$lib/ui/textarea';
	import * as Dialog from '$lib/ui/dialog';
	import { agents as agentsApi } from '$lib/api/client';
	import { addNotification } from '$lib/stores/notifications';
	
	export let open = false;
	export let onClose: () => void;
	export let onSuccess: () => void;
	
	let name = '';
	let version = '';
	let promptTemplate = '';
	let isSubmitting = false;
	
	const defaultPrompt = `You are an autonomous AI agent designed to accomplish specific goals through planning and execution.

Your objective: {{objective}}

Available tools:
{{tools}}

Constraints:
- Step budget: {{stepBudget}}
- Working memory: {{workingMemory}}

Instructions:
1. Analyze the objective carefully
2. Break it down into actionable steps
3. Use available tools to accomplish tasks
4. Track your progress in working memory
5. Provide a clear summary when complete

Think step by step and use tools wisely.`;
	
	function resetForm() {
		name = '';
		version = '';
		promptTemplate = defaultPrompt;
		isSubmitting = false;
	}
	
	async function handleSubmit() {
		if (!name || !version || !promptTemplate) {
			addNotification('Please fill in all required fields', 'error');
			return;
		}
		
		isSubmitting = true;
		
		try {
			await agentsApi.createAgent({
				requestBody: {
					name,
					version,
					promptTemplate,
					metadata: {}
				}
			});
			
			resetForm();
			onSuccess();
		} catch (error: any) {
			addNotification(error.message || 'Failed to create agent', 'error');
		} finally {
			isSubmitting = false;
		}
	}
	
	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			resetForm();
			onClose();
		}
	}
	
	// Initialize with default prompt on mount
	$: if (open && !promptTemplate) {
		promptTemplate = defaultPrompt;
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-3xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Create New Agent</Dialog.Title>
			<Dialog.Description>
				Define a new agent version with a custom prompt template.
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<label for="agent-name" class="text-sm font-medium">
					Name <span class="text-red-500">*</span>
				</label>
				<Input
					id="agent-name"
					placeholder="e.g., default, researcher, coder"
					bind:value={name}
					disabled={isSubmitting}
				/>
				<p class="text-xs text-gray-500">
					Identifier for the agent type (can have multiple versions)
				</p>
			</div>
			
			<div class="space-y-2">
				<label for="agent-version" class="text-sm font-medium">
					Version <span class="text-red-500">*</span>
				</label>
				<Input
					id="agent-version"
					placeholder="e.g., v1.0, 2024-01-15"
					bind:value={version}
					disabled={isSubmitting}
				/>
				<p class="text-xs text-gray-500">
					Version identifier (must be unique for this agent name)
				</p>
			</div>
			
			<div class="space-y-2">
				<label for="prompt-template" class="text-sm font-medium">
					Prompt Template <span class="text-red-500">*</span>
				</label>
				<Textarea
					id="prompt-template"
					placeholder="Enter the system prompt template..."
					bind:value={promptTemplate}
					disabled={isSubmitting}
					rows={15}
					class="font-mono text-sm"
				/>
				<p class="text-xs text-gray-500">
					Use placeholders like &#123;&#123;objective&#125;&#125;, &#123;&#123;tools&#125;&#125;, &#123;&#123;stepBudget&#125;&#125;, etc.
				</p>
			</div>
		</div>
		
		<Dialog.Footer>
			<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isSubmitting}>
				Cancel
			</Button>
			<Button onclick={handleSubmit} disabled={isSubmitting}>
				{isSubmitting ? 'Creating...' : 'Create Agent'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
