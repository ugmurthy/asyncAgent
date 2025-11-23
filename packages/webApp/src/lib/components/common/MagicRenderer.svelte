<script lang="ts">
  import Marked from 'svelte-marked';

  interface Props {
    source: string;
  }

  let { source }: Props = $props();
</script>

<div class="prose prose-sm max-w-none dark:prose-invert">
  <Marked markdown={source} />
</div>
