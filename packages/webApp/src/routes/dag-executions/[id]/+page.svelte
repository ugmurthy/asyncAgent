<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { Button } from "$lib/ui/button";
  import { Badge } from "$lib/ui/badge";
  import * as Card from "$lib/ui/card";
  import * as Table from "$lib/ui/table";
  import * as Tabs from "$lib/ui/tabs";
  import StatusBadge from "$lib/components/common/StatusBadge.svelte";
  import EmptyState from "$lib/components/common/EmptyState.svelte";
  import MermaidDiagram from "$lib/components/dag/MermaidDiagram.svelte";
  import MarkdownRenderer from "$lib/components/common/MarkdownRenderer.svelte";
  import { generateExecutionMermaid } from "$lib/utils/mermaid";
  import { formatDate, formatRelativeTime } from "$lib/utils/formatters";
  import { apiClient, getApiBaseUrl } from "$lib/api/client";
  import { addNotification } from "$lib/stores/notifications";
  import type { PageData } from "./$types";

  // Define local types to handle missing properties in generated client
  interface LocalSubStep {
    id: string;
    executionId: string;
    taskId: string;
    description: string;
    thought: string;
    actionType: "tool" | "inference";
    toolOrPromptName: string;
    toolOrPromptParams?: Record<string, any>;
    dependencies: string[];
    status:
      | "pending"
      | "running"
      | "waiting"
      | "completed"
      | "failed"
      | "blocked";
    result?: any;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    createdAt: string;
    updatedAt?: string;
  }

  interface LocalExecution {
    dagTitle: string | null;
    id: string;
    dagId: string | null;
    status:
      | "pending"
      | "running"
      | "waiting"
      | "completed"
      | "failed"
      | "partial"
      | "suspended";
    completedTasks: number;
    failedTasks: number;
    waitingTasks: number;
    startedAt?: string | null;
    endedAt?: string | null;
    lastRetryAt?: string | null;
    retryCount: number;
    error?: string | null;
    createdAt: string;
    subSteps: LocalSubStep[];
  }

  let { data }: { data: PageData } = $props();

  let execution = $state(data.execution as unknown as LocalExecution);

  // Update local state when data changes (e.g. navigation)
  $effect(() => {
    if (data.execution.id !== execution.id) {
      execution = data.execution as unknown as LocalExecution;
    }
  });

  let subSteps = $derived((execution.subSteps || []) as LocalSubStep[]);
  let executionChart = $derived(generateExecutionMermaid(subSteps));

  let markdownContent = $state<string | null>(null);
  let showResults = $state(false);
  let loadingResults = $state(false);
  let lastProcessedResult = $state<any>(null);
  let events = $state<any[]>([]);
  let eventsContainer: HTMLDivElement | null = null;

  // Modal state for step details
  let selectedStep = $state<LocalSubStep | null>(null);
  let showStepModal = $state(false);

  let lastStep = $derived(
    subSteps.length > 0
      ? subSteps.find((s) => s.taskId === String(subSteps.length)) || null
      : null
  );
  $effect(() => {
    console.log("subSteps : ", subSteps);
    if (
      lastStep &&
      lastStep.status === "completed" &&
      lastStep.result !== lastProcessedResult
    ) {
      lastProcessedResult = lastStep.result;
      fetchResultContent(lastStep.result);
    }
  });

  async function fetchResultContent(result: any) {
    if (!result) return;

    let path = "";
    let content = "";

    // Handle object result (already parsed)
    if (typeof result === "object" && result !== null) {
      if ("path" in result) {
        path = result.path;
      } else {
        content = JSON.stringify(result, null, 2);
      }
    }
    // Handle string result (might be JSON string or plain text)
    else if (typeof result === "string") {
      try {
        const parsed = JSON.parse(result);
        if (typeof parsed === "object" && parsed !== null && "path" in parsed) {
          path = parsed.path;
        } else {
          // If it's valid JSON but not our path object, treat as string content if it was a string originally
          // But if it was a JSON string representation of an object, maybe we want to show it as code?
          // requirement: "if there is no json object ... use the result itself"
          // If result is "{\"foo\":\"bar\"}", parsed is {foo:bar}.
          // If result is "Just text", parse throws.
          content = result;
        }
      } catch {
        content = result;
      }
    }

    if (path) {
      loadingResults = true;
      try {
        markdownContent = await apiClient.artifacts.getArtifact({
          filename: path,
        });
      } catch (e) {
        markdownContent = `Failed to load artifact: ${path} (${e})`;
      } finally {
        loadingResults = false;
      }
    } else {
      markdownContent = content;
    }
  }

  let eventSource: EventSource | null = null;

  onMount(() => {
    connectSSE();
  });

  onDestroy(() => {
    disconnectSSE();
  });

  function connectSSE() {
    const url = `${getApiBaseUrl()}/dag-executions/${execution.id}/events`;
    eventSource = new EventSource(url);

    const handleRawEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (e) {
        console.error("Failed to parse SSE event", e, event.data);
      }
    };

    // Subscribe to all named SSE event types from backend
    const eventTypes = [
      "execution.created",
      "execution.updated",
      "execution.completed",
      "execution.failed",
      "execution.suspended",
      "execution.started",
      "execution.resumed",
      "substep.started",
      "substep.completed",
      "substep.failed",
    ];

    for (const type of eventTypes) {
      eventSource.addEventListener(type, handleRawEvent);
    }

    eventSource.onerror = (err) => {
      console.error("SSE connection error", err);
      eventSource?.close();
    };
  }

  function disconnectSSE() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function handleSSEEvent(event: any) {
    // Add event to events stream
    events = [
      ...events,
      { ...event, timestamp: event.timestamp || new Date().toISOString() },
    ];

    // Auto-scroll to bottom
    if (eventsContainer) {
      setTimeout(() => {
        eventsContainer?.scrollTo({
          top: eventsContainer.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }

    if (event.type.startsWith("substep.")) {
      // Update specific substep in list
      const currentSteps = [...(execution.subSteps || [])];
      const index = currentSteps.findIndex(
        (s) => s.taskId === String(event.taskId)
      );

      if (index !== -1) {
        currentSteps[index] = {
          ...currentSteps[index],
          status:
            event.status ||
            (event.type === "substep.completed"
              ? "completed"
              : event.type === "substep.failed"
                ? "failed"
                : "running"),
          result: event.result ?? currentSteps[index].result,
          error: event.error ?? currentSteps[index].error,
          completedAt: event.timestamp
            ? new Date(event.timestamp).toISOString()
            : currentSteps[index].completedAt,
          durationMs: event.durationMs ?? currentSteps[index].durationMs,
        };

        // Direct property write triggers reactivity clearly
        execution.subSteps = currentSteps;
      } else {
        // Reload if we can't find the step (shouldn't happen if list is complete)
        invalidate("dag-execution:detail");
      }
    } else if (event.type.startsWith("execution.")) {
      const newStatus =
        event.status ||
        (event.type === "execution.completed"
          ? "completed"
          : event.type === "execution.failed"
            ? "failed"
            : execution.status);

      // Direct property write triggers reactivity clearly
      execution.status = newStatus;
      invalidate("dag-execution:detail");
    }
  }

  async function deleteExecution() {
    if (
      !confirm(
        "Are you sure you want to delete this execution? This action cannot be undone."
      )
    )
      return;

    try {
      await apiClient.dag.deleteDagExecution({ id: execution.id });
      addNotification("Execution deleted successfully", "success");
      goto("/dags");
    } catch (error) {
      addNotification("Failed to delete execution", "error");
    }
  }

  async function resumeExecution() {
    try {
      // Using fetch directly since client method name might be different or missing
      const response = await fetch(
        `${getApiBaseUrl()}/resume-dag/${execution.id}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) throw new Error("Failed to resume");

      addNotification("Execution resumed", "success");
      invalidate("dag-execution:detail");
    } catch (error) {
      addNotification("Failed to resume execution", "error");
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "suspended":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function openStepModal(step: LocalSubStep) {
    selectedStep = step;
    showStepModal = true;
  }

  function closeStepModal() {
    showStepModal = false;
    selectedStep = null;
  }
</script>

<div class="container mx-auto py-8 px-4">
  <div class="mb-6">
    <Button variant="ghost" onclick={() => goto(`/dags/${execution.dag_id}`)}>
      ← Back to DAG
    </Button>
  </div>

  <Tabs.Root value="tab-three" class="w-full">
    <Tabs.List class="grid w-full grid-cols-5">
      <Tabs.Trigger value="tab-one">The Task</Tabs.Trigger>
      <Tabs.Trigger value="tab-two">Result</Tabs.Trigger>
      <Tabs.Trigger value="tab-three">Graph</Tabs.Trigger>
      <Tabs.Trigger value="tab-four">Events</Tabs.Trigger>
      <Tabs.Trigger value="tab-five">Steps</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="tab-one" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <div class="flex items-start justify-between">
            <div>
              <Card.Title>DAG Execution Details</Card.Title>
              <Card.Description>Execution ID: {execution.id}</Card.Description>
            </div>
            <div class="flex gap-2">
              {#if execution.status === "suspended" || execution.status === "failed"}
                <Button onclick={resumeExecution} variant="outline">
                  Resume
                </Button>
              {/if}
              <Button onclick={deleteExecution} variant="destructive">
                Delete
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-500">Status</p>
              <StatusBadge status={execution.status} />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">DAG ID</p>
              <p class="text-sm">
                <a
                  href={`/dags/${execution.dag_id}`}
                  class="text-blue-600 hover:underline"
                >
                  {execution.dag_id}
                </a>
              </p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Started At</p>
              <p class="text-sm">
                {execution.started_at
                  ? formatDate(execution.started_at)
                  : "Not started"}
              </p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Completed At</p>
              <p class="text-sm">
                {execution.completed_at
                  ? formatDate(execution.completed_at)
                  : "Not completed"}
              </p>
            </div>

            {#if execution.error}
              <div class="col-span-2">
                <p class="text-sm font-medium text-gray-500">Error</p>
                <p class="text-sm text-red-600">{execution.error}</p>
              </div>
            {/if}
          </div>
          <div>
            <p class="pt-4">Requested Task</p>
            <hr />
            <div
              class="text-sm whitespace-pre-wrap h-80 overflow-y-auto border rounded bg-gray-50 p-3"
            >
              {execution.original_request}
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="tab-two" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>Results of Execution</Card.Title>
        </Card.Header>

        <Card.Content>
          {#if loadingResults}
            <div class="flex justify-center p-4">
              <span class="loading loading-spinner loading-md">Loading...</span>
            </div>
          {:else if markdownContent}
            <div
              class="prose max-w-none dark:prose-invert p-4 bg-gray-50 rounded-lg border"
            >
              <MarkdownRenderer source={markdownContent} />
            </div>
          {:else}
            <p class="text-gray-500 italic">No results available.</p>
          {/if}
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="tab-three" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>Execution Flow</Card.Title>
        </Card.Header>
        <Card.Content>
          <MermaidDiagram
            chart={executionChart}
            id="execution-{execution.id}"
          />
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="tab-four" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>Events Stream</Card.Title>
          <Card.Description>Real-time execution events</Card.Description>
        </Card.Header>
        <Card.Content>
          <div
            bind:this={eventsContainer}
            class="h-96 overflow-y-auto border rounded-lg bg-gray-50 p-4 space-y-2"
          >
            {#if events.length === 0}
              <p class="text-gray-500 italic text-sm">Waiting for events...</p>
            {:else}
              {#each events as event}
                <div
                  class="border-l-4 border-blue-500 bg-white p-3 rounded shadow-sm"
                >
                  <div class="flex items-start justify-between mb-1">
                    <Badge
                      class={event.type.includes("failed")
                        ? "bg-red-100 text-red-800"
                        : event.type.includes("completed")
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"}
                    >
                      {event.type}
                    </Badge>
                    <span class="text-xs text-gray-500">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                  <pre
                    class="text-xs overflow-x-auto bg-gray-50 p-2 rounded mt-2">{JSON.stringify(
                      event,
                      null,
                      2
                    )}</pre>
                </div>
              {/each}
            {/if}
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="tab-five" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>Execution Steps</Card.Title>
          <Card.Description>
            {subSteps.length} step{subSteps.length !== 1 ? "s" : ""}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {#if subSteps.length === 0}
            <EmptyState
              title="No steps found"
              description="This execution has no sub-steps yet."
            />
          {:else}
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head class="text-left">Task(Tool) deps</Table.Head>
                  <Table.Head class="text-left">Description</Table.Head>
                  <Table.Head class="text-left">Thought</Table.Head>
                  <Table.Head>Status</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each subSteps as step}
                  <Table.Row
                    class="cursor-pointer hover:bg-gray-50 transition-colors"
                    onclick={() => openStepModal(step)}
                  >
                    <Table.Cell class="font-mono text-sm">
                      {step.taskId}
                      ({step.toolOrPromptName}) {step.dependencies}
                    </Table.Cell>
                    <Table.Cell class="text-sm text-gray-600">
                      {#if step.description}
                        {step.description.substring(0, 50)}
                        {step.description.length > 50 ? "..." : ""}
                      {:else}
                        <span class="text-gray-400">-</span>
                      {/if}
                    </Table.Cell>
                    <Table.Cell class="text-sm text-gray-600">
                      {#if step.thought}
                        {step.thought.substring(0, 50)}
                        {step.thought.length > 50 ? "..." : ""}
                      {:else}
                        <span class="text-gray-400">-</span>
                      {/if}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge class={getStatusColor(step.status)}>
                        {step.status}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {/if}
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
  </Tabs.Root>
</div>

<!-- Step Details Modal -->
{#if showStepModal && selectedStep}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
  >
    <Card.Root class="w-full max-w-4xl max-h-screen overflow-y-auto">
      <Card.Header>
        <div class="flex items-start justify-between">
          <div>
            <Card.Title>Step Details: {selectedStep.id}</Card.Title>
            <Card.Description>
              Tool/Prompt: {selectedStep.toolOrPromptName}
            </Card.Description>
          </div>
          <button
            onclick={closeStepModal}
            class="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <!-- Metadata Row -->
        <div class="grid grid-cols-5 gap-4 border-b pb-4">
          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase">Status</p>
            <Badge class={`${getStatusColor(selectedStep.status)} mt-2`}>
              {selectedStep.status}
            </Badge>
          </div>
          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase">
              Action Type
            </p>
            <Badge variant="outline" class="mt-2"
              >{selectedStep.actionType}</Badge
            >
          </div>
          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase">
              Duration
            </p>
            <p class="text-sm mt-2">
              {selectedStep.durationMs ? `${selectedStep.durationMs}ms` : "-"}
            </p>
          </div>
          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase">
              Started At
            </p>
            <p class="text-sm mt-2">
              {selectedStep.startedAt
                ? formatDate(selectedStep.startedAt)
                : "-"}
            </p>
          </div>
          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase">
              Completed At
            </p>
            <p class="text-sm mt-2">
              {selectedStep.completedAt
                ? formatDate(selectedStep.completedAt)
                : "-"}
            </p>
          </div>
        </div>

        {#if selectedStep.description}
          <div>
            <p class="text-sm font-medium text-gray-500 mb-2">Description</p>
            <div class="bg-gray-50 rounded p-3 border">
              <p class="text-sm whitespace-pre-wrap">
                {selectedStep.description}
              </p>
            </div>
          </div>
        {/if}

        {#if selectedStep.thought}
          <div>
            <p class="text-sm font-medium text-gray-500 mb-2">Thought</p>
            <div class="bg-gray-50 rounded p-3 border">
              <p class="text-sm whitespace-pre-wrap">{selectedStep.thought}</p>
            </div>
          </div>
        {/if}

        {#if selectedStep.dependencies && selectedStep.dependencies.length > 0}
          <div>
            <p class="text-sm font-medium text-gray-500">Dependencies</p>
            <div class="flex flex-wrap gap-2 mt-2">
              {#each selectedStep.dependencies as dep}
                <Badge variant="outline">{dep}</Badge>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedStep.toolOrPromptParams && Object.keys(selectedStep.toolOrPromptParams).length > 0}
          <div>
            <p class="text-sm font-medium text-gray-500 mb-2">Parameters</p>
            <div
              class="bg-gray-50 rounded p-3 overflow-x-auto max-h-48 overflow-y-auto"
            >
              <pre class="text-xs"><code
                  >{JSON.stringify(
                    selectedStep.toolOrPromptParams,
                    null,
                    2
                  )}</code
                ></pre>
            </div>
          </div>
        {/if}

        {#if selectedStep.result}
          <div>
            <p class="text-sm font-medium text-gray-500 mb-2">Result</p>
            <div
              class="bg-gray-50 rounded p-3 overflow-x-auto max-h-48 overflow-y-auto"
            >
              {#if typeof selectedStep.result === "string"}
                <MarkdownRenderer source={selectedStep.result} />
              {:else}
                <pre class="text-xs"><code
                    >{JSON.stringify(selectedStep.result, null, 2)}</code
                  ></pre>
              {/if}
            </div>
          </div>
        {/if}

        {#if selectedStep.error}
          <div>
            <p class="text-sm font-medium text-red-600 mb-2">Error</p>
            <div class="bg-red-50 rounded p-3 border border-red-200">
              <p class="text-sm text-red-700">{selectedStep.error}</p>
            </div>
          </div>
        {/if}
      </Card.Content>
      <Card.Footer>
        <Button onclick={closeStepModal} variant="outline" class="w-full">
          Back to Steps
        </Button>
      </Card.Footer>
    </Card.Root>
  </div>
{/if}
