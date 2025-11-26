<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { Button } from "$lib/ui/button";
  import { Input } from "$lib/ui/input";
  import { Badge } from "$lib/ui/badge";
  import * as Table from "$lib/ui/table";
  import * as DropdownMenu from "$lib/ui/dropdown-menu";
  import StatusBadge from "$lib/components/common/StatusBadge.svelte";
  import EmptyState from "$lib/components/common/EmptyState.svelte";
  import {
    formatDate,
    formatRelativeTime,
    truncate,
    formatCronExpression,
  } from "$lib/utils/formatters";
  import { apiClient } from "$lib/api/client";
  import { addNotification } from "$lib/stores/notifications";
  import type { PageData } from "./$types";
  import type { DAG } from "@async-agent/api-js-client";

  export let data: PageData;

  let searchQuery = "";
  let statusFilter: "all" | "active" | "paused" = "all";
  let sortField: "createdAt" | "updatedAt" | "intent" = "createdAt";
  let sortDirection: "asc" | "desc" = "desc";

  $: filteredDags = data.dags
    .filter((dag) => {
      if (statusFilter !== "all" && dag.status !== statusFilter) return false;
      const intent = getIntent(dag);
      if (
        searchQuery &&
        !intent.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      const field = sortField as "createdAt" | "updatedAt" | "intent";
      const direction = sortDirection as "asc" | "desc";

      if (field === "intent") {
        aVal = getIntent(a);
        bVal = getIntent(b);
      } else {
        aVal = new Date(a[field]);
        bVal = new Date(b[field]);
      }

      if (direction === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  function getIntent(dag: DAG): string {
    try {
      if (!dag.result?.intent) return "N/A";
      const result =
        typeof dag.result.intent.primary === "string"
          ? dag.result.intent.primary
          : "?";
      return result || "N/A";
    } catch {
      return "N/A";
    }
  }

  function getClarificationNeeded(dag: DAG): boolean {
    try {
      return dag.result?.clarification_needed || false;
    } catch {
      return false;
    }
  }

  async function executeDag(dagId: string) {
    try {
      await apiClient.dag.executeDag({ requestBody: { dagId } });
      addNotification("DAG execution started", "success");
      invalidate("dags:list");
    } catch (error) {
      addNotification("Failed to execute DAG", "error");
    }
  }

  async function pauseDag(dagId: string) {
    try {
      await apiClient.dag.updateDag({
        id: dagId,
        requestBody: { status: "paused" },
      });
      addNotification("DAG paused", "success");
      invalidate("dags:list");
      const dagsList = await apiClient.dag.listDags({});
      data.dags = dagsList.dags || [];
    } catch (error) {
      addNotification("Failed to pause DAG", "error");
    }
  }

  async function resumeDag(dagId: string) {
    try {
      await apiClient.dag.updateDag({
        id: dagId,
        requestBody: { status: "active" },
      });
      addNotification("DAG resumed", "success");
      invalidate("dags:list");
      const dagsList = await apiClient.dag.listDags({});
      data.dags = dagsList.dags || [];
    } catch (error) {
      addNotification("Failed to resume DAG", "error");
    }
  }

  async function deleteDag(dagId: string) {
    if (!confirm("Are you sure you want to delete this DAG?")) return;

    try {
      await apiClient.dag.deleteDag({ id: dagId });
      addNotification("DAG deleted successfully", "success");
      data.dags = await apiClient.dag
        .listDags({})
        .then((res) => res.dags || []);
    } catch (error: any) {
      if (error.status === 409) {
        addNotification(
          "Cannot delete DAG: it has existing executions. Delete the executions first.",
          "error"
        );
      } else if (error.status === 404) {
        addNotification("DAG not found", "error");
      } else {
        addNotification("Failed to delete DAG", "error");
      }
      console.error("Delete DAG error:", error);
    }
  }

  function getScheduleDisplay(dag: DAG): string {
    // DAGs don't have schedules - return N/A for now
    return "N/A";
  }

  function useThisDag(dag: DAG) {
    // params might be saved with camelCase (goalText) or kebab-case (goal-text)
    // @ts-ignore
    const goalText = dag.params?.goalText || dag.params?.["goal-text"] || "";
    
    if (goalText) {
      goto(`/dags/new?initialGoal=${encodeURIComponent(goalText)}`);
    } else {
      addNotification("Could not retrieve goal text from this DAG", "error");
    }
  }
</script>

<svelte:head>
  <title>DAGs - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">DAGs</h1>
      <p class="text-muted-foreground">Manage your Directed Acyclic Graphs</p>
    </div>
    <Button onclick={() => goto("/dags/new")}>Create DAG</Button>
  </div>

  <div class="flex gap-4 items-center">
    <Input
      type="search"
      placeholder="Search DAGs by intent..."
      bind:value={searchQuery}
      class="max-w-sm"
    />

    <select
      bind:value={statusFilter}
      class="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <option value="all">All Status</option>
      <option value="active">Active</option>
      <option value="paused">Paused</option>
    </select>

    <div class="text-sm text-muted-foreground">
      {filteredDags.length} DAG{filteredDags.length !== 1 ? "s" : ""}
    </div>
  </div>

  {#if filteredDags.length === 0}
    <EmptyState
      title="No DAGs found"
      description={searchQuery || statusFilter !== "all"
        ? "Try adjusting your filters"
        : "Create your first DAG to get started"}
      icon="🔀"
    >
      {#if !searchQuery && statusFilter === "all"}
        <Button onclick={() => goto("/dags/new")}>Create Your First DAG</Button>
      {/if}
    </EmptyState>
  {:else}
    <div class="border rounded-lg">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Job</Table.Head>
            <Table.Head>Clarification</Table.Head>

            <Table.Head>Agent</Table.Head>
            <Table.Head>Schedule</Table.Head>
            <Table.Head>Created</Table.Head>
            <Table.Head class="text-right">Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each filteredDags as dag (dag.id)}
            <Table.Row
              class="cursor-pointer hover:bg-muted/50"
              onclick={() => goto(`/dags/${dag.id}`)}
            >
              <Table.Cell class="font-medium max-w-md">
                <div class="truncate" title={getIntent(dag)}>
                  {truncate(getIntent(dag), 80)}
                </div>
              </Table.Cell>
              <Table.Cell>
                {#if getClarificationNeeded(dag)}
                  <Badge variant="destructive">Required</Badge>
                {:else}
                  <Badge variant="secondary">None</Badge>
                {/if}
              </Table.Cell>

              <Table.Cell>
                <span class="text-sm text-muted-foreground">
                  {dag.agentName || "N/A"}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span class="text-sm text-muted-foreground">
                  {getScheduleDisplay(dag)}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span
                  class="text-sm text-muted-foreground"
                  title={formatDate(dag.createdAt)}
                >
                  {formatRelativeTime(dag.createdAt)}
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
                        onclick={() => goto(`/dags/${dag.id}`)}
                      >
                        View Details
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onclick={() => executeDag(dag.id)}>
                        Execute DAG
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onclick={() => useThisDag(dag)}>
                        Use this DAG
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      {#if dag.status === "active"}
                        <DropdownMenu.Item onclick={() => pauseDag(dag.id)}>
                          Pause DAG
                        </DropdownMenu.Item>
                      {:else if dag.status === "paused"}
                        <DropdownMenu.Item onclick={() => resumeDag(dag.id)}>
                          Resume DAG
                        </DropdownMenu.Item>
                      {/if}
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        class="text-destructive"
                        onclick={() => deleteDag(dag.id)}
                      >
                        Delete DAG
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
