<script lang="ts">
	import * as Card from '$lib/ui/card';
	import { Badge } from '$lib/ui/badge';
	import { Button } from '$lib/ui/button';
	import { formatDate } from '$lib/utils/formatters';
	import type { PageData } from './$types';
	import { Server, Database, Cpu, Activity, AlertCircle, CheckCircle2 } from '@lucide/svelte';
	import { invalidate } from '$app/navigation';
	
	export let data: PageData;
	
	$: systemHealth = data.health;
	$: isHealthy = systemHealth?.status === 'ready';
	
	async function refreshHealth() {
		await invalidate('health:ready');
	}
</script>

<div class="space-y-6">
	<!-- System Status Overview -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title class="flex items-center gap-2">
					<Activity class="h-5 w-5" />
					System Status
				</Card.Title>
				<Button variant="outline" size="sm" onclick={refreshHealth}>
					Refresh
				</Button>
			</div>
			<Card.Description>
				Overall health and status of the AsyncAgent system
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if systemHealth}
				<div class="flex items-center gap-3 mb-4">
					{#if isHealthy}
						<CheckCircle2 class="h-8 w-8 text-green-600" />
						<div>
							<p class="text-2xl font-bold text-green-600">System Operational</p>
							<p class="text-sm text-gray-600">All services are running normally</p>
						</div>
					{:else}
						<AlertCircle class="h-8 w-8 text-red-600" />
						<div>
							<p class="text-2xl font-bold text-red-600">System Issues</p>
							<p class="text-sm text-gray-600">Some services may not be functioning correctly</p>
						</div>
					{/if}
				</div>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
					<div class="bg-gray-50 p-4 rounded-lg">
						<p class="text-sm font-medium text-gray-600 mb-1">Status</p>
						<Badge variant={isHealthy ? 'default' : 'destructive'}>
							{systemHealth.status}
						</Badge>
					</div>
					
					<div class="bg-gray-50 p-4 rounded-lg">
						<p class="text-sm font-medium text-gray-600 mb-1">Timestamp</p>
						<p class="text-sm font-mono">{formatDate(systemHealth.timestamp)}</p>
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-3 text-red-600">
					<AlertCircle class="h-6 w-6" />
					<p>Unable to retrieve system health information</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
	
	<!-- LLM Configuration -->
	{#if systemHealth}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Cpu class="h-5 w-5" />
					LLM Configuration
				</Card.Title>
				<Card.Description>
					Current language model provider and settings
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label class="text-sm font-medium text-gray-600">Provider</label>
							<p class="text-lg font-semibold mt-1">{systemHealth.provider}</p>
						</div>
						
						<div>
							<label class="text-sm font-medium text-gray-600">Model</label>
							<p class="text-lg font-mono mt-1">{systemHealth.model}</p>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
	
	<!-- Database Information -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Database class="h-5 w-5" />
				Database Information
			</Card.Title>
			<Card.Description>
				Database connection and storage details
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-3">
				<div class="bg-gray-50 p-4 rounded-lg">
					<label class="text-sm font-medium text-gray-600">Type</label>
					<p class="text-lg font-semibold mt-1">SQLite</p>
				</div>
				
				<div class="bg-gray-50 p-4 rounded-lg">
					<label class="text-sm font-medium text-gray-600">Location</label>
					<p class="text-sm font-mono mt-1">./data/asyncagent.db</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
	
	<!-- Scheduler Status -->
	{#if systemHealth}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Server class="h-5 w-5" />
					Scheduler Status
				</Card.Title>
				<Card.Description>
					Background job scheduler information
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-3">
					<div class="bg-gray-50 p-4 rounded-lg">
						<label class="text-sm font-medium text-gray-600">Active Schedules</label>
						<p class="text-2xl font-bold mt-1">{systemHealth.scheduler.activeSchedules || 0}</p>
					</div>
					
					<div class="bg-gray-50 p-4 rounded-lg">
						<label class="text-sm font-medium text-gray-600">Status</label>
						<Badge variant={systemHealth.scheduler.activeSchedules > 0 ? 'default' : 'outline'} class="mt-1">
							{systemHealth.scheduler.activeSchedules > 0 ? 'Running' : 'Idle'}
						</Badge>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
	
	<!-- Environment Information -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Environment</Card.Title>
			<Card.Description>
				Runtime environment and configuration
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-3">
				<div class="bg-gray-50 p-4 rounded-lg">
					<label class="text-sm font-medium text-gray-600">Node Version</label>
					<p class="text-sm font-mono mt-1">{typeof process !== 'undefined' ? process.version : 'N/A'}</p>
				</div>
				
				<div class="bg-gray-50 p-4 rounded-lg">
					<label class="text-sm font-medium text-gray-600">Platform</label>
					<p class="text-sm font-mono mt-1">{typeof process !== 'undefined' ? process.platform : 'N/A'}</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
