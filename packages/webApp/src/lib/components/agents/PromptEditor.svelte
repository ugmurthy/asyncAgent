<script lang="ts">
	import { Textarea } from '$lib/ui/textarea';
	import * as Card from '$lib/ui/card';
	import { Badge } from '$lib/ui/badge';
	import { Code2, Info } from '@lucide/svelte';
	
	export let promptTemplate: string;
	export let readonly = false;
	
	const placeholders = [
		{ name: 'objective', description: 'The goal objective text' },
		{ name: 'tools', description: 'Available tools list' },
		{ name: 'stepBudget', description: 'Maximum steps allowed' },
		{ name: 'workingMemory', description: 'Current working memory state' },
		{ name: 'constraints', description: 'Any additional constraints' },
		{ name: 'CurrentDate', description: 'Current date and time' }
	];
	
	// Detect which placeholders are used in the template
	$: usedPlaceholders = placeholders.filter(p => 
		promptTemplate.includes(`{{${p.name}}}`) || 
		promptTemplate.includes(`{{ ${p.name} }}`)
	);
	
	$: unusedPlaceholders = placeholders.filter(p => 
		!promptTemplate.includes(`{{${p.name}}}`) && 
		!promptTemplate.includes(`{{ ${p.name} }}`)
	);
</script>

<div class="space-y-4">
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title class="flex items-center gap-2">
					<Code2 class="h-5 w-5" />
					Prompt Template
				</Card.Title>
				{#if readonly}
					<Badge variant="outline">Read-only</Badge>
				{/if}
			</div>
			<Card.Description>
				The system prompt template that will be rendered for each run.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Textarea
				bind:value={promptTemplate}
				disabled={readonly}
				rows={20}
				class="font-mono text-sm"
				placeholder="Enter your prompt template here..."
			/>
		</Card.Content>
	</Card.Root>
	
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Info class="h-5 w-5" />
				Available Placeholders
			</Card.Title>
			<Card.Description>
				Use these placeholders in your template. They will be replaced at runtime.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				{#if usedPlaceholders.length > 0}
					<div>
						<h4 class="text-sm font-semibold mb-2 text-green-700">Used in Template</h4>
						<div class="space-y-2">
							{#each usedPlaceholders as placeholder}
								<div class="flex items-start gap-3 p-2 bg-green-50 rounded border border-green-200">
									<code class="text-sm font-mono bg-white px-2 py-1 rounded border border-green-300 text-green-700 shrink-0">
										&#123;&#123;{placeholder.name}&#125;&#125;
									</code>
									<p class="text-sm text-gray-700">{placeholder.description}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				
				{#if unusedPlaceholders.length > 0}
					<div>
						<h4 class="text-sm font-semibold mb-2 text-gray-600">Available (Not Used)</h4>
						<div class="space-y-2">
							{#each unusedPlaceholders as placeholder}
								<div class="flex items-start gap-3 p-2 bg-gray-50 rounded border border-gray-200">
									<code class="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-300 text-gray-600 shrink-0">
										&#123;&#123;{placeholder.name}&#125;&#125;
									</code>
									<p class="text-sm text-gray-600">{placeholder.description}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
	
	<Card.Root>
		<Card.Header>
			<Card.Title>Preview</Card.Title>
			<Card.Description>
				How the prompt will look with sample data
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="bg-gray-50 p-4 rounded-md border border-gray-200">
				<pre class="text-sm whitespace-pre-wrap font-mono text-gray-800">{promptTemplate
					.replace(/\{\{objective\}\}/g, '<objective text>')
					.replace(/\{\{ objective \}\}/g, '<objective text>')
					.replace(/\{\{tools\}\}/g, '<tools list>')
					.replace(/\{\{ tools \}\}/g, '<tools list>')
					.replace(/\{\{stepBudget\}\}/g, '20')
					.replace(/\{\{ stepBudget \}\}/g, '20')
					.replace(/\{\{workingMemory\}\}/g, '<memory state>')
					.replace(/\{\{ workingMemory \}\}/g, '<memory state>')
					.replace(/\{\{constraints\}\}/g, '<constraints>')
					.replace(/\{\{ constraints \}\}/g, '<constraints>')
					.replace(/\{\{CurrentDate\}\}/g, new Date().toLocaleString())
					.replace(/\{\{ CurrentDate \}\}/g, new Date().toLocaleString())
				}</pre>
			</div>
		</Card.Content>
	</Card.Root>
</div>
