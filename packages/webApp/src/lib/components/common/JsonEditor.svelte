<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import type { Content, OnChange } from "svelte-jsoneditor";

  // Runtime type for mode; must match what svelte-jsoneditor expects
  type Mode = "tree" | "text" | "table" | "form" | "view";

  interface Props {
    content?: Content;
    mode?: Mode;
    readOnly?: boolean;
    mainMenuBar?: boolean;
    navigationBar?: boolean;
    statusBar?: boolean;
    askToFormat?: boolean;
    indentation?: number | string;
    tabSize?: number;
    height?: string;
    onChange?: OnChange;
    class?: string;
  }

  let {
    content = $bindable<Content>({ json: {} }),
    mode = $bindable<Mode>("tree"),
    readOnly = false,
    mainMenuBar = true,
    navigationBar = true,
    statusBar = true,
    askToFormat = true,
    indentation = 2,
    tabSize = 2,
    height = "400px",
    onChange,
    class: className = "",
  }: Props = $props();

  let JSONEditor: any = $state(null);

  onMount(async () => {
    if (browser) {
      const module = await import("svelte-jsoneditor");
      JSONEditor = module.JSONEditor;
    }
  });

  function handleChange(
    updatedContent: Content,
    previousContent: Content,
    { contentErrors, patchResult }: { contentErrors: any; patchResult: any }
  ) {
    content = updatedContent;
    if (onChange) {
      onChange(updatedContent, previousContent, { contentErrors, patchResult });
    }
  }
</script>

<div class="json-editor-wrapper {className}" style="height: {height};">
  {#if JSONEditor}
    <JSONEditor
      bind:content
      bind:mode
      {readOnly}
      {mainMenuBar}
      {navigationBar}
      {statusBar}
      {askToFormat}
      {indentation}
      {tabSize}
      onChange={handleChange}
    />
  {:else}
    <div class="flex items-center justify-center h-full text-muted-foreground">
      Loading editor...
    </div>
  {/if}
</div>

<style>
  .json-editor-wrapper {
    width: 100%;
    overflow: hidden;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .json-editor-wrapper :global(.jse-main) {
    height: 100%;
  }

  :global(.jse-theme-dark) {
    --jse-background-color: #1f2937;
    --jse-text-color: #f9fafb;
    --jse-panel-background: #111827;
    --jse-panel-border: #374151;
  }
</style>
