<script lang="ts">
  import { onMount } from "svelte";
  import mermaid from "mermaid";

  interface Props {
    chart: string;
    id?: string;
  }

  let { chart, id = "mermaid-chart" }: Props = $props();
  let container: HTMLElement;
  let renderId = 0;

  onMount(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });
    renderChart();
  });

  // Re-render when chart content changes
  $effect(() => {
    if (chart && container) {
      renderChart();
    }
  });

  async function renderChart() {
    if (!container) return;

    // Unique ID for this render to avoid conflicts
    const uniqueId = `mermaid-${id}-${renderId++}`;

    try {
      // Clear previous content safely
      container.innerHTML = "";

      // Check if chart is valid
      if (!chart || chart.trim() === "") {
        container.innerHTML =
          '<div class="text-gray-400 text-xs p-4">No graph data available</div>';
        return;
      }

      const { svg } = await mermaid.render(uniqueId, chart);
      container.innerHTML = svg;
    } catch (error) {
      console.error("Mermaid render failed:", error);
      container.innerHTML = `<div class="text-red-500 text-sm p-4">Failed to render graph</div>`;
    }
  }
</script>

<div
  class="mermaid-wrapper w-full overflow-x-auto flex justify-center p-4 bg-white rounded-lg border border-gray-200"
  bind:this={container}
>
  <!-- SVG will be injected here -->
  Loading diagram...
</div>

<style>
  :global(.mermaid-wrapper svg) {
    max-width: 100%;
    height: auto;
  }
</style>
