<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { Button } from "$lib/ui/button";
  import { Input } from "$lib/ui/input";
  import { Badge } from "$lib/ui/badge";
  import * as Table from "$lib/ui/table";
  import * as DropdownMenu from "$lib/ui/dropdown-menu";
  import StatusBadge from "$lib/components/common/StatusBadge.svelte";
  import EmptyState from "$lib/components/common/EmptyState.svelte";
  import { formatDate, formatRelativeTime } from "$lib/utils/formatters";
  import { apiClient } from "$lib/api/client";
  import { addNotification } from "$lib/stores/notifications";
  import type { PageData } from "./$types";

  export let data: PageData;

  let searchQuery = "";
  let statusFilter:
    | "all"
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "suspended" = "all";
  let sortField: "created_at" | "started_at" = "created_at";
  let sortDirection: "asc" | "desc" = "desc";

  $: filteredExecutions = data.executions
    .filter((execution) => {
      if (statusFilter !== "all" && execution.status !== statusFilter)
        return false;
      if (searchQuery) {
        const dagTitle = (execution as any).dagTitle || "";
        const executionId = execution.id || "";
        const searchLower = searchQuery.toLowerCase();
        if (
          !dagTitle.toLowerCase().includes(searchLower) &&
          !executionId.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const field = sortField as "createdAt" | "startedAt";
      const direction = sortDirection as "asc" | "desc";

      const aVal = new Date(a[field] || a.createdAt);
      const bVal = new Date(b[field] || b.createdAt);

      if (direction === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  async function deleteExecution(executionId: string) {
    if (!confirm("Are you sure you want to delete this execution?")) return;

    try {
      await apiClient.dag.deleteDagExecution({ id: executionId });
      addNotification("Execution deleted successfully", "success");
      data.executions = await apiClient.dag
        .listDagExecutions({ limit: 100 })
        .then((res) => res.executions || []);
    } catch (error) {
      addNotification("Failed to delete execution", "error");
      console.error("Delete execution error:", error);
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
      case "pending":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function getProgressPercentage(execution: any): number {
    const total =
      execution.completed_tasks +
      execution.failed_tasks +
      execution.waiting_tasks;
    if (total === 0) return 0;
    return Math.round((execution.completed_tasks / total) * 100);
  }
</script>

<svelte:head>
  <title>DAG Executions - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">DAG Executions</h1>
      <p class="text-muted-foreground">View all DAG execution history</p>
    </div>
  </div>

  <div class="flex gap-4 items-center">
    <Input
      type="search"
      placeholder="Search by title or execution ID..."
      bind:value={searchQuery}
      class="max-w-sm"
    />

    <select
      bind:value={statusFilter}
      class="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <option value="all">All Status</option>
      <option value="pending">Pending</option>
      <option value="running">Running</option>
      <option value="completed">Completed</option>
      <option value="failed">Failed</option>
      <option value="suspended">Suspended</option>
    </select>

    <div class="text-sm text-muted-foreground">
      {filteredExecutions.length} execution{filteredExecutions.length !== 1
        ? "s"
        : ""}
    </div>
  </div>

  {#if filteredExecutions.length === 0}
    <EmptyState
      title="No executions found"
      description={searchQuery || statusFilter !== "all"
        ? "Try adjusting your filters"
        : "No DAG executions yet"}
      icon="🔄"
    />
  {:else}
    <div class="border rounded-lg">
      <Table.Root>
        <Table.Header>
          <Table.Row class="bg-gray-200">
            <Table.Head>DAG Title</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Costs</Table.Head>
            <Table.Head>Started</Table.Head>
            <Table.Head>Duration</Table.Head>
            <Table.Head class="text-right">Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each filteredExecutions as execution (execution.id)}
            <Table.Row
              class="cursor-pointer hover:bg-muted/50"
              onclick={() => goto(`/dag-executions/${execution.id}`)}
            >
              <Table.Cell class="font-medium max-w-md">
                <div
                  class="truncate"
                  title={(execution as any).dagTitle || execution.id}
                >
                  {(execution as any).dagTitle || `${execution.id}`}
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge class={getStatusColor(execution.status)}>
                  {execution.status}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  {#if execution.completedAt}
                    <span
                      class="text-sm text-muted-foreground"
                      title={JSON.stringify(execution.totalUsage, null, 2)}
                    >
                      {execution.totalTasks} tasks | &#x20B9
                      {parseFloat(execution.totalCostUsd * 100).toFixed(2)}
                    </span>
                  {:else}
                    -
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell>
                <span
                  class="text-sm text-muted-foreground"
                  title={execution.startedAt
                    ? formatDate(execution.startedAt)
                    : "Not started"}
                >
                  {execution.startedAt
                    ? formatRelativeTime(execution.startedAt)
                    : "Not started"}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span class="text-sm text-muted-foreground">
                  {#if execution.completedAt}
                    {(execution.durationMs / 1000).toFixed(0) + " s"}
                  {:else}
                    -
                  {/if}
                </span>
              </Table.Cell>
              <Table.Cell class="text-right">
                <div
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                  }}
                  role="presentation"
                >
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <Button variant="ghost" size="sm">Actions</Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item
                        onclick={() => goto(`/dag-executions/${execution.id}`)}
                      >
                        View Details
                      </DropdownMenu.Item>
                      {#if execution.dag_id}
                        <DropdownMenu.Item
                          onclick={() => goto(`/dags/${execution.dag_id}`)}
                        >
                          View DAG
                        </DropdownMenu.Item>
                      {/if}
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        class="text-destructive"
                        onclick={() => deleteExecution(execution.id)}
                      >
                        Delete Execution
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
</div>
