<script lang="ts">
  import {
    Check,
    Loader2,
    AlertCircle,
    Clock,
    Pause,
    Ban,
  } from "@lucide/svelte";

  export interface ToolProgress {
    toolName: string;
    message: string;
    timestamp?: string;
  }

  export interface ProgressStep {
    id: string;
    taskId: string;
    label: string;
    description?: string;
    status:
      | "pending"
      | "running"
      | "waiting"
      | "completed"
      | "failed"
      | "blocked";
    timestamp?: string;
    durationMs?: number;
    toolProgress?: ToolProgress[];
  }

  interface Props {
    steps: ProgressStep[];
    title?: string;
    showTimestamps?: boolean;
    compact?: boolean;
    onStepClick?: (step: ProgressStep) => void;
  }

  let {
    steps,
    title,
    showTimestamps = true,
    compact = true,
    onStepClick,
  }: Props = $props();

  const statusConfig: Record<
    ProgressStep["status"],
    {
      icon: typeof Check;
      bgColor: string;
      borderColor: string;
      iconColor: string;
      lineColor: string;
      labelColor: string;
      animate?: boolean;
    }
  > = {
    pending: {
      icon: Clock,
      bgColor: "bg-gray-100",
      borderColor: "border-gray-300",
      iconColor: "text-gray-400",
      lineColor: "bg-gray-200",
      labelColor: "text-gray-500",
    },
    running: {
      icon: Loader2,
      bgColor: "bg-blue-100",
      borderColor: "border-blue-500",
      iconColor: "text-blue-600",
      lineColor: "bg-blue-300",
      labelColor: "text-blue-700",
      animate: true,
    },
    waiting: {
      icon: Pause,
      bgColor: "bg-yellow-100",
      borderColor: "border-yellow-500",
      iconColor: "text-yellow-600",
      lineColor: "bg-yellow-300",
      labelColor: "text-yellow-700",
    },
    completed: {
      icon: Check,
      bgColor: "bg-green-100",
      borderColor: "border-green-500",
      iconColor: "text-green-600",
      lineColor: "bg-green-400",
      labelColor: "text-green-700",
    },
    failed: {
      icon: AlertCircle,
      bgColor: "bg-red-100",
      borderColor: "border-red-500",
      iconColor: "text-red-600",
      lineColor: "bg-red-300",
      labelColor: "text-red-700",
    },
    blocked: {
      icon: Ban,
      bgColor: "bg-orange-100",
      borderColor: "border-orange-500",
      iconColor: "text-orange-600",
      lineColor: "bg-orange-300",
      labelColor: "text-orange-700",
    },
  };

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function formatTimestamp(ts: string): string {
    const date = new Date(ts);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  let completedCount = $derived(
    steps.filter((s) => s.status === "completed").length
  );
  let totalCount = $derived(steps.length);
  let progressPercent = $derived(
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  );
</script>

<div class="w-full">
  {#if title}
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-700">{title}</h3>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500">{completedCount}/{totalCount}</span>
        <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-green-500 transition-all duration-300 ease-out"
            style="width: {progressPercent}%"
          ></div>
        </div>
        <span class="text-xs font-medium text-gray-600">{progressPercent}%</span
        >
      </div>
    </div>
  {/if}

  <div class="relative">
    {#each steps as step, index (step.id)}
      {@const config = statusConfig[step.status]}
      {@const isLast = index === steps.length - 1}
      {@const IconComponent = config.icon}

      {@const StepContent = () => {}}
      {#snippet stepContent()}
        <!-- Node icon with vertical line connector -->
        <div class="relative flex-shrink-0 w-8">
          {#if !isLast}
            <div
              class="absolute left-1/2 -translate-x-1/2 top-8 w-0.5 {compact
                ? 'h-[calc(100%-10px)]'
                : 'h-[calc(100%-8px)]'} {config.lineColor}"
            ></div>
          {/if}
          <div
            class="relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center {config.bgColor} {config.borderColor} transition-all duration-200"
          >
            <IconComponent
              size={16}
              class="{config.iconColor} {config.animate ? 'animate-spin' : ''}"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0 pt-0.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-sm {config.labelColor} text-black"
              >{step.description?.slice(0, 120) + "..."}</span
            >
            <span class="text-xs font-mono text-gray-400">{step.taskId}</span>
            {#if step.durationMs !== undefined && step.status === "completed"}
              <span class="text-xs text-gray-400">
                ({formatDuration(step.durationMs)})
              </span>
            {/if}
          </div>

          {#if step.description && !compact}
            <p class="text-xs text-gray-500 mt-1 line-clamp-2">{step.label}</p>
          {/if}

          {#if showTimestamps && step.timestamp && !compact}
            <p class="text-xs text-gray-400 mt-1">
              {formatTimestamp(step.timestamp)}
            </p>
          {/if}

          {#if step.toolProgress && step.toolProgress.length > 0}
            <div class="mt-2 space-y-1 border-l-2 border-gray-200 pl-3">
              {#each step.toolProgress.slice(-2) as progress}
                <div class="text-xs">
                  <span class="font-medium text-gray-600"
                    >{progress.toolName}:</span
                  >
                  <span class="text-gray-500 ml-1"
                    >{progress.message.length > 90
                      ? progress.message.slice(0, 90) + "..."
                      : progress.message}</span
                  >
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Status badge for running items -->
        {#if step.status === "running"}
          <div class="flex-shrink-0 self-center">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse"
            >
              In Progress
            </span>
          </div>
        {/if}
      {/snippet}

      {#if onStepClick}
        <button
          type="button"
          class="relative flex gap-4 w-full text-left {compact
            ? 'pb-4'
            : 'pb-6'} cursor-pointer hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors"
          onclick={() => onStepClick(step)}
        >
          {@render stepContent()}
        </button>
      {:else}
        <div class="relative flex gap-4 {compact ? 'pb-4' : 'pb-6'}">
          {@render stepContent()}
        </div>
      {/if}
    {/each}

    {#if steps.length === 0}
      <div class="text-center py-8 text-gray-500">
        <Clock size={32} class="mx-auto mb-2 text-gray-300" />
        <p class="text-sm">No steps yet</p>
      </div>
    {/if}
  </div>
</div>
