<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { Button } from "$lib/ui/button";
  import { Badge } from "$lib/ui/badge";
  import * as Card from "$lib/ui/card";
  import * as Table from "$lib/ui/table";
  import * as Tabs from "$lib/ui/tabs";
  import StatusBadge from "$lib/components/common/StatusBadge.svelte";
  import EmptyState from "$lib/components/common/EmptyState.svelte";
  import { formatDate, formatRelativeTime } from "$lib/utils/formatters";
  import { apiClient } from "$lib/api/client";
  import { addNotification } from "$lib/stores/notifications";
  import type { PageData } from "./$types";

  export let data: PageData;

  $: execution = data.execution;
  $: subSteps = execution.subSteps || [];

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
      await apiClient.dag.resumeDagExecution({
        executionId: execution.id,
        requestBody: {},
      });
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
