<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	
	onMount(() => {
		// Redirect to agents page by default
		goto('/settings/agents', { replaceState: true });
	});
</script>

<svelte:head>
	<title>Settings - AsyncAgent</title>
</svelte:head>

<div class="flex items-center justify-center min-h-[400px]">
	<p class="text-gray-500">Redirecting to settings...</p>
</div>
