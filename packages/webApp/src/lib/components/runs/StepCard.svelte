<script lang="ts">
  import { Badge } from "$lib/ui/badge";
  import { formatDate, formatRelativeTime } from "$lib/utils/formatters";
  import type { Step } from "@async-agent/api-js-client";
  import SvelteMarkdown from "svelte-markdown";

  export let step: Step;

  $: hasToolUse = !!step.toolName;
  $: stepType = step.error ? "error" : hasToolUse ? "tool_use" : "thinking";

  function getStepIcon(type: string) {
    switch (type) {
      case "tool_use":
        return "🔧";
      case "thinking":
        return "💭";
      case "error":
        return "❌";
      default:
        return "•";
    }
  }

  function getStepVariant(
    type: string
  ): "default" | "secondary" | "destructive" | "outline" {
    switch (type) {
      case "tool_use":
        return "default";
      case "thinking":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  }

  function formatInput(input: Record<string, any> | null | undefined): string {
    if (!input) return "";
    return JSON.stringify(input, null, 2);
  }
</script>

<div
  class="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-lg">{getStepIcon(stepType)}</span>
      <span class="font-semibold">Step {step.stepNo}</span>
      <Badge variant={getStepVariant(stepType)}>{stepType}</Badge>
    </div>
    <span
      class="text-xs text-muted-foreground"
      title={formatDate(step.createdAt)}
    >
      {formatRelativeTime(step.createdAt)}
    </span>
  </div>

  {#if step.thought}
    <div class="text-sm">
      <span class="text-muted-foreground font-medium block mb-1">Thought:</span>
      <div
        class="text-sm bg-muted/50 p-2 rounded prose prose-sm max-w-none dark:prose-invert"
      >
        <SvelteMarkdown source={step.thought} />
      </div>
    </div>
  {/if}

  {#if step.toolName}
    <div class="text-sm">
      <span class="text-muted-foreground">Tool:</span>
      <span class="font-mono ml-2 text-blue-600">{step.toolName}</span>
    </div>
  {/if}

  {#if step.toolInput}
    <div class="text-sm">
      <div class="flex items-center justify-between mb-1">
        <span class="text-muted-foreground font-medium">Input:</span>
        <span class="text-xs text-muted-foreground">
          {formatInput(step.toolInput).length} chars
        </span>
      </div>
      <pre
        class="text-xs bg-muted p-3 rounded overflow-x-auto max-h-60 overflow-y-auto border">{formatInput(
          step.toolInput
        )}</pre>
    </div>
  {/if}

  {#if step.observation}
    <div class="text-sm">
      <div class="flex items-center justify-between mb-1">
        <span class="text-muted-foreground font-medium">Observation:</span>
        <span class="text-xs text-muted-foreground">
          {step.observation.length} chars
        </span>
      </div>
      <pre
        class="text-xs bg-muted p-3 rounded overflow-x-auto max-h-60 overflow-y-auto border">{step.observation}</pre>
    </div>
  {/if}

  {#if step.error}
    <div class="text-sm">
      <span class="text-destructive font-medium block mb-1">Error:</span>
      <pre
        class="text-xs bg-destructive/10 text-destructive p-3 rounded overflow-x-auto border border-destructive/20">{step.error}</pre>
    </div>
  {/if}

  {#if step.durationMs}
    <div class="text-xs text-muted-foreground">
      Duration: {step.durationMs}ms
    </div>
  {/if}
</div>
