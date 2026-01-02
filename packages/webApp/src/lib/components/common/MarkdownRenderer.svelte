<script lang="ts">
  import SvelteMarkdown from "svelte-markdown";
  import mermaid from "mermaid";
  import "katex/dist/katex.min.css";
  import CodeRenderer from "./CodeRenderer.svelte";

  interface Props {
    source: string;
  }

  let { source }: Props = $props();
  let container: HTMLDivElement | null = null;

  const markdownOptions = {
    gfm: true,
    mangle: false,
  };

  const renderers = {
    code: CodeRenderer,
  };

  async function enhanceRenderedMarkdown() {
    if (typeof window === 'undefined' || !container) return;

    const mermaidCodeBlocks = container.querySelectorAll('pre > code.language-mermaid');
    mermaidCodeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre) return;

      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = codeEl.textContent ?? '';
      pre.replaceWith(div);
    });

    mermaid.initialize({ startOnLoad: false });
    await mermaid.run({ querySelector: '.mermaid' });

    const { default: renderMathInElement } = await import('katex/dist/contrib/auto-render.mjs');
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  $effect(() => {
    if (!container) return;
    enhanceRenderedMarkdown();
  });
</script>

<div class="prose dark:prose-invert max-w-none" bind:this={container}>
  <SvelteMarkdown {source} {renderers} options={markdownOptions} />
</div>
