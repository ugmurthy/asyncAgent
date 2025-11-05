<script lang="ts">
	import { page } from '$app/stores';
	import * as Tabs from '$lib/ui/tabs';
	import { goto } from '$app/navigation';
	
	$: currentPath = $page.url.pathname;
	$: currentTab = currentPath.includes('/agents') ? 'agents' : 'system';
	
	function handleTabChange(value: string) {
		if (value === 'agents') {
			goto('/settings/agents');
		} else {
			goto('/settings/system');
		}
	}
</script>

<svelte:head>
	<title>Settings - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-8 px-4 max-w-7xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
		<p class="text-gray-600">Manage agents, prompts, and system configuration</p>
	</div>
	
	<Tabs.Root value={currentTab} onValueChange={handleTabChange}>
		<Tabs.List class="mb-6">
			<Tabs.Trigger value="agents">Agents & Prompts</Tabs.Trigger>
			<Tabs.Trigger value="system">System Settings</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>
	
	<slot />
</div>
