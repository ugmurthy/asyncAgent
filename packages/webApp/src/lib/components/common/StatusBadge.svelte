<script lang="ts">
	import { Badge } from '$lib/ui/badge';
	
	type Status = 'active' | 'paused' | 'completed' | 'pending' | 'running' | 'failed' | 'archived';
	
	export let status: Status;
	export const type: 'goal' | 'run' = 'goal';
	
	const getVariant = (status: Status) => {
		switch (status) {
			case 'active':
			case 'completed':
				return 'default';
			case 'paused':
			case 'pending':
			case 'archived':
				return 'secondary';
			case 'running':
				return 'default';
			case 'failed':
				return 'destructive';
			default:
				return 'outline';
		}
	};
	
	const getColorClasses = (status: Status) => {
		switch (status) {
			case 'active':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'paused':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'completed':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'pending':
				return 'bg-gray-100 text-gray-800 border-gray-200';
			case 'running':
				return 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse';
			case 'failed':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'archived':
				return 'bg-gray-100 text-gray-600 border-gray-300';
			default:
				return '';
		}
	};
</script>

<Badge variant={getVariant(status)} class={getColorClasses(status)}>
	{status}
</Badge>
