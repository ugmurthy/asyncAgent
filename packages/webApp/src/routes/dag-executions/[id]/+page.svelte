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
  import SvelteMarkdown from "svelte-markdown";
  import { generateExecutionMermaid } from "$lib/utils/mermaid";
  import { formatDate, formatRelativeTime } from "$lib/utils/formatters";
  import { apiClient } from "$lib/api/client";
  import { addNotification } from "$lib/stores/notifications";
  import type { PageData } from "./$types";

  // Define local types to handle missing properties in generated client
  interface LocalSubStep {
    taskId: string;
    toolOrPromptName: string;
    toolOrPromptParams?: Record<string, any>;
    dependencies: string[];
    status: string;
    result?: any;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
  }

  interface LocalExecution {
    id: string;
    dagId: string;
    status: any; // Cast to any for StatusBadge
    subSteps: LocalSubStep[];
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }

  export let data: PageData;

  $: execution = data.execution as unknown as LocalExecution;
  $: subSteps = (execution.subSteps || []) as LocalSubStep[];
  $: executionChart = generateExecutionMermaid(subSteps);

  let markdownContent: string | null = null;
  let showResults = false;
  let loadingResults = false;
  let lastProcessedResult: any = null;

  $: lastStep = subSteps.length > 0 ? subSteps[subSteps.length - 1] : null;
  
  $: if (lastStep && lastStep.status === 'completed' && lastStep.result !== lastProcessedResult) {
    lastProcessedResult = lastStep.result;
    fetchResultContent(lastStep.result);
  }

  async function fetchResultContent(result: any) {
    if (!result) return;
    
    let path = '';
    let content = '';
    
    // Handle object result (already parsed)
    if (typeof result === 'object' && result !== null) {
      if ('path' in result) {
        path = result.path;
      } else {
        content = JSON.stringify(result, null, 2);
      }
    } 
    // Handle string result (might be JSON string or plain text)
    else if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (typeof parsed === 'object' && parsed !== null && 'path' in parsed) {
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
        markdownContent = await apiClient.artifacts.getArtifact({ filename: path });
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
    if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'suspended') {
      // Don't connect if already finished, unless we want to see updates if resumed externally
      // But let's connect anyway in case it gets resumed
    }

    const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'}/dag-executions/${execution.id}/events`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (e) {
        console.error('Failed to parse SSE event', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      // Optional: retry logic or just close
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
    if (event.type === 'substep.updated' || event.type === 'substep.completed' || event.type === 'substep.failed' || event.type === 'substep.started') {
      // Update specific substep in list
      const index = subSteps.findIndex((s) => s.taskId === String(event.taskId));
      if (index !== -1) {
        subSteps[index] = { 
          ...subSteps[index], 
          status: event.status || (event.type === 'substep.completed' ? 'completed' : event.type === 'substep.failed' ? 'failed' : 'running'),
          result: event.result || subSteps[index].result,
          error: event.error || subSteps[index].error,
          completedAt: event.timestamp ? new Date(event.timestamp).toISOString() : subSteps[index].completedAt,
          durationMs: event.durationMs || subSteps[index].durationMs
        };
        // Trigger reactivity
        subSteps = [...subSteps];
      } else {
        // Reload if we can't find the step (shouldn't happen if list is complete)
        invalidate('dag-execution:detail'); 
      }
    } else if (event.type === 'execution.updated' || event.type === 'execution.completed' || event.type === 'execution.failed' || event.type === 'execution.suspended' || event.type === 'execution.resumed') {
      execution.status = event.status || (event.type === 'execution.completed' ? 'completed' : event.type === 'execution.failed' ? 'failed' : execution.status);
      execution = { ...execution };
      invalidate('dag-execution:detail');
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'}/resume-dag/${execution.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to resume');
      
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
</script>

<div class="container mx-auto py-8 px-4">
  <div class="mb-6">
    <Button variant="ghost" onclick={() => goto(`/dags/${execution.dagId}`)}>
      ← Back to DAG
    </Button>
  </div>

  <div class="space-y-6">
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
                href={`/dags/${execution.dagId}`}
                class="text-blue-600 hover:underline"
              >
                {execution.dagId}
              </a>
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500">Started At</p>
            <p class="text-sm">
              {execution.startedAt
                ? formatDate(execution.startedAt)
                : "Not started"}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500">Completed At</p>
            <p class="text-sm">
              {execution.completedAt
                ? formatDate(execution.completedAt)
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
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between cursor-pointer" onclick={() => showResults = !showResults}>
            <Card.Title>Results of Execution</Card.Title>
            <Button variant="ghost" size="sm">
                {showResults ? 'Collapse' : 'Expand'}
            </Button>
        </div>
      </Card.Header>
      {#if showResults}
        <Card.Content>
            {#if loadingResults}
                <div class="flex justify-center p-4">
                    <span class="loading loading-spinner loading-md">Loading...</span>
                </div>
            {:else if markdownContent}
                <div class="prose max-w-none dark:prose-invert p-4 bg-gray-50 rounded-lg border">
                    <SvelteMarkdown source={markdownContent} />
                </div>
            {:else}
                <p class="text-gray-500 italic">No results available.</p>
            {/if}
        </Card.Content>
      {/if}
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Execution Graph</Card.Title>
      </Card.Header>
      <Card.Content>
        <MermaidDiagram chart={executionChart} id="execution-{execution.id}" />
      </Card.Content>
    </Card.Root>

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
                <Table.Head>Task ID (tool) deps</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Started At</Table.Head>
                <Table.Head>Completed At</Table.Head>
                <Table.Head>Result</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each subSteps as step}
                <Table.Row>
                  <Table.Cell
                    class="font-mono text-sm"
                    title={JSON.stringify(step.toolOrPromptParams, null, 2)}
                  >
                    {step.taskId}
                    ({step.toolOrPromptName})
                    {step.dependencies}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge class={getStatusColor(step.status)}>
                      {step.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell class="text-sm">
                    {step.startedAt ? formatRelativeTime(step.startedAt) : "-"}
                  </Table.Cell>
                  <Table.Cell class="text-sm">
                    {step.completedAt
                      ? formatRelativeTime(step.completedAt)
                      : "-"}
                  </Table.Cell>
                  <Table.Cell class="max-w-md">
                    {#if step.result}
                      <details class="text-sm">
                        <summary class="cursor-pointer text-blue-600">
                          View result
                        </summary>
                        <pre
                          class="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">{JSON.stringify(
                            step.result,
                            null,
                            2
                          )}</pre>
                      </details>
                    {:else if step.error}
                      <p class="text-sm text-red-600">{step.error}</p>
                    {:else}
                      <span class="text-gray-400">-</span>
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
