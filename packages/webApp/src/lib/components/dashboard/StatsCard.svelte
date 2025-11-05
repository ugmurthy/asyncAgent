<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/ui/card';

	export let title: string;
	export let value: string | number;
	export let description: string = '';
</script>

<Card>
	<CardHeader>
		<CardTitle>{title}</CardTitle>
	</CardHeader>
	<CardContent>
		<div class="text-3xl font-bold text-gray-900">{value}</div>
		{#if description}
			<p class="text-sm text-gray-600 mt-2">{description}</p>
		{/if}
	</CardContent>
</Card>
