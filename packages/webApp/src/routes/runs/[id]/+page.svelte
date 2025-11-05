<script lang="ts">
	import RunDetail from '$lib/components/runs/RunDetail.svelte';
	import type { PageData } from './$types';
	
	export let data: PageData;
</script>

<svelte:head>
	<title>Run {data.run.id.slice(0, 8)} - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6">
	<RunDetail run={data.run} steps={data.steps} />
</div>
