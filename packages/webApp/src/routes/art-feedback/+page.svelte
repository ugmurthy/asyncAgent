<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/ui/card';
	import { Button } from '$lib/ui/button';
	import { Textarea } from '$lib/ui/textarea';
	import { Badge } from '$lib/ui/badge';
	import MarkdownRenderer from '$lib/components/common/MarkdownRenderer.svelte';
	import { getApiBaseUrl, agents as agentsApi } from '$lib/api/client';
	import { onMount } from 'svelte';
	import type { Agent } from '@async-agent/api-js-client';

	interface Message {
		role: 'user' | 'assistant';
		content: string;
		image?: string;
	}

	let imageFile: File | null = $state(null);
	let imagePreview: string | null = $state(null);
	let taskName = $state('');
	let prompt = $state('');
	let loading = $state(false);
	let error: string | null = $state(null);
	let conversation: Message[] = $state([]);
	let fileInput: HTMLInputElement | null = $state(null);
	let agents: Agent[] = $state([]);
	let loadingAgents = $state(true);

	onMount(async () => {
		try {
			agents = await agentsApi.listAgents({});
			if (agents.length > 0) {
				taskName = agents[0].name;
			}
		} catch (err) {
			console.error('Failed to load agents:', err);
			error = 'Failed to load feedback agents';
		} finally {
			loadingAgents = false;
		}
	});

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && file.type.startsWith('image/')) {
			imageFile = file;
			const reader = new FileReader();
			reader.onload = (e) => {
				imagePreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);
			error = null;
		} else {
			error = 'Please select a valid image file';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files[0];
		if (file && file.type.startsWith('image/')) {
			imageFile = file;
			const reader = new FileReader();
			reader.onload = (e) => {
				imagePreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);
			error = null;
		} else {
			error = 'Please drop a valid image file';
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function clearImage() {
		imageFile = null;
		imagePreview = null;
		if (fileInput) fileInput.value = '';
	}

	function buildConversationPrompt(): string {
		if (conversation.length === 0) {
			return prompt;
		}
		let context = 'Previous conversation:\n';
		for (const msg of conversation) {
			if (msg.role === 'user') {
				context += `User: ${msg.content}\n`;
			} else {
				context += `Assistant: ${msg.content}\n`;
			}
		}
		context += `\nUser's follow-up question: ${prompt}`;
		return context;
	}

	async function submitFeedback() {
		if (!prompt.trim()) {
			error = 'Please enter a question or request for feedback';
			return;
		}

		if (!taskName) {
			error = 'Please select a feedback agent';
			return;
		}

		if (conversation.length === 0 && !imageFile) {
			error = 'Please upload an image for the initial feedback request';
			return;
		}

		loading = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('taskName', taskName);
			formData.append('prompt', buildConversationPrompt());

			if (imageFile && conversation.length === 0) {
				formData.append('file', imageFile);
			}

			const response = await fetch(`${getApiBaseUrl()}/task`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to get feedback');
			}

			const result = await response.json();

			conversation = [
				...conversation,
				{
					role: 'user',
					content: prompt,
					image: conversation.length === 0 ? imagePreview ?? undefined : undefined,
				},
				{
					role: 'assistant',
					content: result.response,
				},
			];

			prompt = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to get feedback';
		} finally {
			loading = false;
		}
	}

	function startNewConversation() {
		conversation = [];
		clearImage();
		prompt = '';
		error = null;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submitFeedback();
		}
	}

	function downloadAsMarkdown() {
		let markdown = '# Art Feedback Conversation\n\n';
		
		for (const msg of conversation) {
			if (msg.role === 'user') {
				markdown += `## User\n\n`;
				if (msg.image) {
					markdown += `![Artwork](${msg.image})\n\n`;
				}
				markdown += `${msg.content}\n\n`;
			} else {
				markdown += `## Assistant\n\n`;
				markdown += `${msg.content}\n\n`;
			}
		}

		const blob = new Blob([markdown], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `art-feedback-${new Date().toISOString().split('T')[0]}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function downloadAsPDF() {
		try {
			const { jsPDF } = await import('jspdf');
			const pdf = new jsPDF();
			const pageWidth = pdf.internal.pageSize.getWidth();
			const pageHeight = pdf.internal.pageSize.getHeight();
			const margin = 20;
			const maxWidth = pageWidth - 2 * margin;
			let yPosition = margin;

			pdf.setFontSize(18);
			pdf.text('Art Feedback Conversation', margin, yPosition);
			yPosition += 15;

			for (const msg of conversation) {
				if (yPosition > pageHeight - margin) {
					pdf.addPage();
					yPosition = margin;
				}

				pdf.setFontSize(14);
				pdf.setFont('helvetica', 'bold');
				pdf.text(msg.role === 'user' ? 'User:' : 'Assistant:', margin, yPosition);
				yPosition += 8;

				if (msg.image && msg.role === 'user') {
					try {
						const imgData = msg.image;
						const imgWidth = 80;
						const imgHeight = 60;
						
						if (yPosition + imgHeight > pageHeight - margin) {
							pdf.addPage();
							yPosition = margin;
						}
						
						pdf.addImage(imgData, 'JPEG', margin, yPosition, imgWidth, imgHeight);
						yPosition += imgHeight + 8;
					} catch (err) {
						console.error('Failed to add image to PDF:', err);
					}
				}

				pdf.setFont('helvetica', 'normal');
				pdf.setFontSize(10);
				const lines = pdf.splitTextToSize(msg.content, maxWidth);
				
				for (const line of lines) {
					if (yPosition > pageHeight - margin) {
						pdf.addPage();
						yPosition = margin;
					}
					pdf.text(line, margin, yPosition);
					yPosition += 6;
				}
				
				yPosition += 10;
			}

			pdf.save(`art-feedback-${new Date().toISOString().split('T')[0]}.pdf`);
		} catch (err) {
			console.error('Failed to generate PDF:', err);
			error = 'Failed to generate PDF. Please try markdown export instead.';
		}
	}
</script>

<svelte:head>
	<title>Art Feedback - AsyncAgent</title>
</svelte:head>

<div class="max-w-2xl mx-auto pb-24">
	<div class="flex justify-between items-center mb-4">
		<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Art Feedback</h1>
		{#if conversation.length > 0}
			<div class="flex gap-2">
				<div class="relative group">
					<Button variant="outline" size="sm">
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
					</Button>
					<div class="hidden group-hover:block absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
						<button
							type="button"
							class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
							onclick={downloadAsMarkdown}
						>
							Download Markdown
						</button>
						<button
							type="button"
							class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
							onclick={downloadAsPDF}
						>
							Download PDF
						</button>
					</div>
				</div>
				<Button variant="outline" size="sm" onclick={startNewConversation}>
					New Artwork
				</Button>
			</div>
		{/if}
	</div>

	<p class="text-gray-600 mb-6 text-sm sm:text-base">
		Upload your artwork and receive constructive feedback from an AI art critic.
	</p>

	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
			{error}
		</div>
	{/if}

	{#if conversation.length === 0}
		<!-- Initial Upload State -->
		<Card class="mb-4">
			<CardHeader class="pb-2">
				<CardTitle class="text-lg">Upload Your Artwork</CardTitle>
			</CardHeader>
			<CardContent>
				<input
					type="file"
					accept="image/*"
					class="hidden"
					bind:this={fileInput}
					onchange={handleFileSelect}
				/>

				{#if !imagePreview}
					<!-- Drop Zone -->
					<button
						type="button"
						class="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
						ondrop={handleDrop}
						ondragover={handleDragOver}
						onclick={() => fileInput?.click()}
					>
						<svg
							class="mx-auto h-12 w-12 text-gray-400"
							stroke="currentColor"
							fill="none"
							viewBox="0 0 48 48"
						>
							<path
								d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<p class="mt-2 text-sm text-gray-600">
							<span class="font-medium text-primary">Tap to upload</span> or drag and drop
						</p>
						<p class="mt-1 text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
					</button>
				{:else}
					<!-- Image Preview -->
					<div class="relative">
						<img
							src={imagePreview}
							alt="Artwork preview"
							class="w-full rounded-lg object-contain max-h-64"
						/>
						<button
							type="button"
							class="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
							onclick={clearImage}
							aria-label="Remove image"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Task Name Selection -->
		<div class="mb-4">
			<label for="taskName" class="block text-sm font-medium text-gray-700 mb-1">
				Feedback Agent
			</label>
			<select
				id="taskName"
				bind:value={taskName}
				disabled={loadingAgents || agents.length === 0}
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if loadingAgents}
					<option value="">Loading agents...</option>
				{:else if agents.length === 0}
					<option value="">No agents available</option>
				{:else}
					{#each agents as agent}
						<option value={agent.name}>{agent.name}</option>
					{/each}
				{/if}
			</select>
		</div>
	{:else}
		<!-- Conversation View -->
		<div class="space-y-4 mb-4">
			{#each conversation as message, i}
				<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div
						class="max-w-[85%] rounded-lg p-3 {message.role === 'user'
							? 'bg-primary text-white'
							: 'bg-gray-100 text-gray-900'}"
					>
						{#if message.image}
							<img
								src={message.image}
								alt="Submitted artwork"
								class="rounded-lg mb-2 max-h-48 object-contain"
							/>
						{/if}
						{#if message.role === 'assistant'}
							<div class="prose prose-sm max-w-none">
								<MarkdownRenderer source={message.content} />
							</div>
						{:else}
							<p class="text-sm whitespace-pre-wrap">{message.content}</p>
						{/if}
					</div>
				</div>
			{/each}

			{#if loading}
				<div class="flex justify-start">
					<div class="bg-gray-100 rounded-lg p-3">
						<div class="flex items-center gap-2">
							<div class="animate-pulse flex gap-1">
								<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
								<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
								<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
							</div>
							<span class="text-sm text-gray-500">Analyzing...</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Input Section - Fixed at Bottom on Mobile -->
	<div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:relative sm:border-0 sm:p-0 sm:bg-transparent">
		<div class="max-w-2xl mx-auto">
			<div class="flex gap-2">
				<Textarea
					bind:value={prompt}
					placeholder={conversation.length === 0
						? 'What would you like feedback on? (e.g., "Please critique my color choices and composition")'
						: 'Ask a follow-up question...'}
					class="min-h-[44px] max-h-32 resize-none"
					rows={1}
					onkeydown={handleKeyDown}
					disabled={loading}
				/>
				<Button
					onclick={submitFeedback}
					disabled={loading || !prompt.trim() || (conversation.length === 0 && !imageFile)}
					class="shrink-0"
				>
					{#if loading}
						<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
						</svg>
					{/if}
				</Button>
			</div>
			{#if conversation.length === 0 && !imageFile}
				<p class="text-xs text-gray-500 mt-1 text-center sm:text-left">
					Upload an image first to get started
				</p>
			{/if}
		</div>
	</div>
</div>
