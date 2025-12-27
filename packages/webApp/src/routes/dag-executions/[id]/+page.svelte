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
  import VerticalProgressBar, { type ProgressStep } from "$lib/components/common/VerticalProgressBar.svelte";
  import MarkdownRenderer from "$lib/components/common/MarkdownRenderer.svelte";
  import MarkdownWithPdfExport from "$lib/components/common/MarkdownWithPdfExport.svelte";
  import * as Dialog from "$lib/ui/dialog";
  import { Download, FileText, ArrowUpDown } from "@lucide/svelte";
  import { artifacts as artifactsApi } from "$lib/api/client";
  import { generateExecutionMermaid } from "$lib/utils/mermaid";
  import { generateExecutionMermaid as generateExecutionStateDiagram } from "$lib/utils/mermaidStateDiagram";
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
    originalRequest?: string | null;
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
  let executionStateChart = $derived(generateExecutionStateDiagram(subSteps));

  // Progress steps derived from subSteps for the VerticalProgressBar
  let progressSteps = $derived<ProgressStep[]>(
    subSteps.map((step) => ({
      id: step.id,
      taskId: step.taskId,
      label: step.toolOrPromptName,
      description: step.description || step.thought,
      status: step.status,
      timestamp: step.startedAt || step.createdAt,
      durationMs: step.durationMs,
    }))
  );

  let markdownContent = $state<string | null>(null);
  let showResults = $state(false);
  let loadingResults = $state(false);
  let lastProcessedResult = $state<any>(null);
  let events = $state<any[]>([]);
  let eventsContainer: HTMLDivElement | null = null;

  // Modal state for step details
  let selectedStep = $state<LocalSubStep | null>(null);
  let showStepModal = $state(false);

  // Artifacts state
  interface ArtifactInfo {
    name: string;
    taskId: string;
    toolName: string;
  }
  let artifactsList = $derived(() => {
    const artifacts: ArtifactInfo[] = [];
    for (const step of subSteps) {
      if (
        step.toolOrPromptName === "writeFile" ||
        step.toolOrPromptName === "readFile"
      ) {
        let filename = "";
        if (step.toolOrPromptParams?.filename) {
          filename = step.toolOrPromptParams.filename;
        } else if (step.toolOrPromptParams?.path) {
          filename = step.toolOrPromptParams.path;
        } else if (typeof step.result === "object" && step.result?.path) {
          filename = step.result.path;
        } else if (typeof step.result === "string") {
          try {
            const parsed = JSON.parse(step.result);
            if (parsed?.path) filename = parsed.path;
          } catch {}
        }
        if (filename) {
          artifacts.push({
            name: filename,
            taskId: step.taskId,
            toolName: step.toolOrPromptName,
          });
        }
      }
    }
    return artifacts;
  });
  let selectedArtifact = $state<ArtifactInfo | null>(null);
  let artifactContent = $state("");
  let isLoadingArtifact = $state(false);
  let artifactSortOrder: "asc" | "desc" = $state("asc");
  let markdownContainer: HTMLDivElement | null = $state(null);

  let sortedArtifacts = $derived(() => {
    const list = [...artifactsList()];
    list.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return artifactSortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  });

  function toggleArtifactSort() {
    artifactSortOrder = artifactSortOrder === "asc" ? "desc" : "asc";
  }

  async function openArtifact(artifact: ArtifactInfo) {
    selectedArtifact = artifact;
    isLoadingArtifact = true;
    try {
      const content = await artifactsApi.getArtifact({
        filename: artifact.name,
      });
      artifactContent = content;
    } catch (err) {
      console.error("Failed to load artifact:", err);
      artifactContent = "Failed to load artifact content.";
    } finally {
      isLoadingArtifact = false;
    }
  }

  function downloadArtifactAsMarkdown() {
    if (!selectedArtifact || !artifactContent) return;
    const blob = new Blob([artifactContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedArtifact.name.endsWith(".md")
      ? selectedArtifact.name
      : `${selectedArtifact.name}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadArtifactAsPDF() {
    if (!markdownContainer) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const doc = printWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head>");
    doc.write(`<title>${selectedArtifact?.name || "Artifact"}</title>`);
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const styleEl = doc.createElement("style");
        styleEl.textContent = Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
        doc.head.appendChild(styleEl);
      } catch {}
    });
    const printStyle = doc.createElement("style");
    printStyle.textContent =
      "@media print { body { margin: 20mm; } @page { margin: 20mm; } }";
    doc.head.appendChild(printStyle);
    doc.write('</head><body class="prose max-w-none p-8">');
    doc.write(markdownContainer.innerHTML);
    doc.write("</body></html>");
    doc.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  let synthesisStep = $derived(
    subSteps.find((s) => s.taskId === "__SYNTHESIS__") || null
  );
  $effect(() => {
    console.log("subSteps : ", subSteps);
    if (
      synthesisStep &&
      synthesisStep.status === "completed" &&
      synthesisStep.result !== lastProcessedResult
    ) {
      lastProcessedResult = synthesisStep.result;
      fetchResultContent(synthesisStep.result);
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
          //result: event.result ?? currentSteps[index].result,
          description: event.description ?? currentSteps[index].description,
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
    <Button variant="ghost" onclick={() => goto(`/dags/${execution.dagId}`)}>
      ← Back to DAG
    </Button>
  </div>

  <Tabs.Root value="tab-progress" class="w-full">
    <Tabs.List class="grid w-full grid-cols-8">
      <Tabs.Trigger value="tab-one">The Task</Tabs.Trigger>
      <Tabs.Trigger value="tab-two">Result</Tabs.Trigger>
      <Tabs.Trigger value="tab-artifacts">Artifacts</Tabs.Trigger>
      <Tabs.Trigger value="tab-three">Graph</Tabs.Trigger>
      <Tabs.Trigger value="tab-state">StateDiagram</Tabs.Trigger>
      <Tabs.Trigger value="tab-progress">Progress</Tabs.Trigger>
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
                  href={`/dags/${execution.dagId}`}
                  class="text-blue-600 hover:underline"
                >
                  {execution.dagId} : {execution.dagTitle}
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
          <div>
            <p class="pt-4">Requested Task</p>
            <hr />
            <div
              class="text-sm whitespace-pre-wrap h-80 overflow-y-auto border rounded bg-gray-50 p-3"
            >
              {execution.originalRequest}
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
            <MarkdownWithPdfExport
              source={markdownContent}
              filename="execution-{execution.id}.pdf"
            />
          {:else}
            <p class="text-gray-500 italic">No results available.</p>
          {/if}
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="tab-artifacts" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center justify-between">
            <span>Artifacts ({sortedArtifacts().length})</span>
            <Button
              variant="ghost"
              size="sm"
              onclick={() => toggleArtifactSort()}
              class="flex items-center gap-1 text-sm font-normal"
            >
              Sort by Name
              <ArrowUpDown
                size={14}
                class={artifactSortOrder === "asc" ? "" : "rotate-180"}
              />
            </Button>
          </Card.Title>
          <Card.Description>
            Files from writeFile and readFile operations
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {#if sortedArtifacts().length > 0}
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>File Name</Table.Head>
                  <Table.Head>Task</Table.Head>
                  <Table.Head>Tool</Table.Head>
                  <Table.Head class="text-right">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each sortedArtifacts() as artifact}
                  <Table.Row
                    class="cursor-pointer hover:bg-gray-50 transition-colors"
                    onclick={() => openArtifact(artifact)}
                  >
                    <Table.Cell class="font-medium flex items-center gap-2">
                      <FileText size={16} class="text-gray-500" />
                      {artifact.name}
                    </Table.Cell>
                    <Table.Cell class="font-mono text-sm text-gray-600">
                      {artifact.taskId}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="outline">{artifact.toolName}</Badge>
                    </Table.Cell>
                    <Table.Cell class="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={(e: MouseEvent) => {
                          e.stopPropagation();
                          openArtifact(artifact);
                        }}
                      >
                        View
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {:else}
            <EmptyState
              title="No artifacts found"
              description="No writeFile or readFile operations in this execution."
            />
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

    <Tabs.Content value="tab-state" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>Execution State Diagram</Card.Title>
        </Card.Header>
        <Card.Content>
          <MermaidDiagram
            chart={executionStateChart}
            id="execution-state-{execution.id}"
          />
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="tab-progress" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>Execution Progress</Card.Title>
          <Card.Description>
            Real-time progress of execution steps
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="max-h-[600px] overflow-y-auto pr-2">
            <VerticalProgressBar
              steps={progressSteps}
              title="Step Progress"
              showTimestamps={true}
              onStepClick={(step) => {
                const found = subSteps.find((s) => s.id === step.id);
                if (found) openStepModal(found);
              }}
            />
          </div>
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

<!-- Artifact Details Dialog -->
<Dialog.Root
  open={!!selectedArtifact}
  onOpenChange={(open) => !open && (selectedArtifact = null)}
>
  <Dialog.Content class="max-w-4xl max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <FileText size={20} />
        {selectedArtifact?.name || "Artifact"}
      </Dialog.Title>
      <Dialog.Description>View and download artifact content</Dialog.Description
      >
    </Dialog.Header>

    <div class="space-y-4">
      <div class="flex gap-2">
        <Button
          onclick={downloadArtifactAsMarkdown}
          variant="outline"
          class="flex items-center gap-2"
        >
          <Download size={16} />
          Download Markdown
        </Button>
        <Button
          onclick={downloadArtifactAsPDF}
          variant="outline"
          class="flex items-center gap-2"
        >
          <Download size={16} />
          Download PDF
        </Button>
      </div>

      <div class="border rounded-lg p-4 bg-gray-50">
        {#if isLoadingArtifact}
          <p class="text-center text-gray-500">Loading artifact...</p>
        {:else if artifactContent}
          <div
            bind:this={markdownContainer}
            class="prose max-w-none dark:prose-invert"
          >
            <MarkdownRenderer source={artifactContent} />
          </div>
        {:else}
          <p class="text-center text-gray-500">No content available</p>
        {/if}
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
