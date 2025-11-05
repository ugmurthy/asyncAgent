<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
		class?: string;
		children?: Snippet;
	}

	let { class: className, children, ...restProps }: CardContentProps = $props();
</script>

<div class={cn('p-6 pt-0', className)} {...restProps}>
	{@render children?.()}
</div>
