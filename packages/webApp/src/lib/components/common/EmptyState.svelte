<script lang="ts">
	export let title: string;
	export let description: string;
	export let icon: string = '📭';
</script>

<div class="flex flex-col items-center justify-center py-12 px-4 text-center">
	<div class="text-6xl mb-4">{icon}</div>
	<h3 class="text-lg font-semibold mb-2">{title}</h3>
	<p class="text-muted-foreground max-w-md">{description}</p>
	{#if $$slots.default}
		<div class="mt-6">
			<slot />
		</div>
	{/if}
</div>
