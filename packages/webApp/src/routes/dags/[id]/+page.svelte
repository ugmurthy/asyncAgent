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

  $: dag = data.dag;
  $: executions = data.executions;

  function getIntent(): string {
    try {
      const intent =
        dag.result?.intent?.sub_intents || dag.result?.intent?.primary;
      if (!intent) return "N/A";
      if (typeof intent === "string") return intent;
      return JSON.stringify(intent);
    } catch {
      return "N/A";
    }
  }

  async function executeDag() {
    try {
      await apiClient.dag.executeDag({ requestBody: { dagId: dag.id } });
      addNotification("DAG execution started", "success");
      setTimeout(() => invalidate("dags:detail"), 500);
    } catch (error) {
      addNotification("Failed to execute DAG", "error");
    }
  }

  async function pauseDag() {
    try {
      await apiClient.dag.updateDag({
        id: dag.id,
        requestBody: { status: "paused" },
      });
      addNotification("DAG paused", "success");
      invalidate("dags:detail");
    } catch (error) {
      addNotification("Failed to pause DAG", "error");
    }
  }

  async function resumeDag() {
    try {
      await apiClient.dag.updateDag({
        id: dag.id,
        requestBody: { status: "active" },
      });
      addNotification("DAG resumed", "success");
      invalidate("dags:detail");
    } catch (error) {
      addNotification("Failed to resume DAG", "error");
    }
  }

  async function deleteDag() {
    if (
      !confirm(
        "Are you sure you want to delete this DAG? This action cannot be undone."
      )
    )
      return;

    try {
      await apiClient.dag.deleteDag({ id: dag.id });
      addNotification("DAG deleted successfully", "success");
      goto("/dags");
    } catch (error: any) {
      if (error.status === 409) {
        addNotification(
          "Cannot delete DAG: it has existing executions. Delete the executions first.",
          "error"
        );
      } else {
        addNotification("Failed to delete DAG", "error");
      }
    }
  }

  async function deleteExecution(executionId: string) {
    if (!confirm("Are you sure you want to delete this execution?")) return;

    try {
      await apiClient.dag.deleteDagExecution({ id: executionId });
      addNotification("Execution deleted", "success");
      const executionsList = await apiClient.dag.listDagExecutions({});
      data.executions =
        executionsList.executions?.filter((e) => e.dagId === dag.id) || [];
    } catch (error) {
      addNotification("Failed to delete execution", "error");
    }
  }
</script>

<svelte:head>
  <title>DAG: {getIntent().substring(0, 50)} - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 space-y-6">
  <div class="flex items-start justify-between">
    <div class="space-y-2 flex-1">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" onclick={() => goto("/dags")}>
          ← Back to DAGs
        </Button>
      </div>
      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-bold">DAG Details</h1>
        <StatusBadge status={dag.status as any} type="goal" />
      </div>
    </div>

    <div class="flex gap-2">
      <Button variant="default" onclick={executeDag}>Execute</Button>
      {#if dag.status === "active"}
        <Button variant="outline" onclick={pauseDag}>Pause</Button>
      {:else if dag.status === "paused"}
        <Button variant="outline" onclick={resumeDag}>Resume</Button>
      {/if}
      <Button variant="destructive" onclick={deleteDag}>Delete</Button>
    </div>
  </div>

  <Tabs.Root value="overview" class="w-full">
    <Tabs.List>
      <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
      <Tabs.Trigger value="executions">
        Executions ({executions.length})
      </Tabs.Trigger>
      <Tabs.Trigger value="result">Result</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="overview" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>DAG Information</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm font-medium text-muted-foreground">ID</div>
              <div class="font-mono text-sm">{dag.id}</div>
            </div>
            <div>
              <div class="text-sm font-medium text-muted-foreground">
                Status
              </div>
              <div><StatusBadge status={dag.status as any} type="goal" /></div>
            </div>
            <div>
              <div class="text-sm font-medium text-muted-foreground">Agent</div>
              <div>{dag.agentName || "N/A"}</div>
            </div>
            <div>
              <div class="text-sm font-medium text-muted-foreground">
                Created
              </div>
              <div title={formatDate(dag.createdAt)}>
                {formatRelativeTime(dag.createdAt)}
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-muted-foreground">
                Clarification needed
              </div>
              <div title={dag?.result.clarification_needed ? "Yes" : "None"}>
                {dag?.result.clarification_needed ? "Yes" : "None"}
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-muted-foreground">
                Executions
              </div>
              <div>{executions.length}</div>
            </div>
          </div>

          <div>
            <div class="text-sm font-medium text-muted-foreground mb-2">
              The Request
            </div>
            <div class="p-3 bg-muted rounded-md">
              {dag?.result.original_request}
            </div>
            <div class="text-sm font-medium text-muted-foreground mb-2">
              Intent
            </div>
            <div class="p-3 bg-muted rounded-md">
              {dag?.result.intent.primary + " :"}
              {getIntent()}
            </div>
          </div>

          {#if dag.result?.clarification_needed}
            <div>
              <div class="text-sm font-medium text-muted-foreground mb-2">
                Clarification Needed
              </div>
              <Badge variant="destructive">Clarification Required</Badge>
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <Tabs.Content value="executions" class="space-y-4">
      {#if executions.length === 0}
        <EmptyState
          title="No executions yet"
          description="This DAG has not been executed. Click 'Execute' to run it."
          icon="🚀"
        >
          <Button onclick={executeDag}>Execute DAG</Button>
        </EmptyState>
      {:else}
        <div class="border rounded-lg">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Execution ID</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Started</Table.Head>
                <Table.Head>Completed</Table.Head>
                <Table.Head class="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each executions as execution (execution.id)}
                <Table.Row>
                  <Table.Cell class="font-mono text-xs font-thin">
                    {execution.id}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={execution.status as any} type="run" />
                  </Table.Cell>
                  <Table.Cell>
                    <span
                      class="text-sm text-muted-foreground"
                      title={formatDate(execution.createdAt)}
                    >
                      {formatRelativeTime(execution.createdAt)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {#if execution.endedAt}
                      <span
                        class="text-sm text-muted-foreground"
                        title={formatDate(execution.endedAt)}
                      >
                        {formatRelativeTime(execution.endedAt)}
                      </span>
                    {:else}
                      <span class="text-sm text-muted-foreground">—</span>
                    {/if}
                  </Table.Cell>
                  <Table.Cell class="text-right">
                    <div class="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => goto(`/dag-executions/${execution.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="text-destructive"
                        onclick={() => deleteExecution(execution.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}
    </Tabs.Content>

    <Tabs.Content value="result" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>DAG Result</Card.Title>
        </Card.Header>
        <Card.Content>
          <pre
            class="p-4 bg-muted rounded-md overflow-x-auto text-sm">{JSON.stringify(
              dag.result,
              null,
              2
            )}</pre>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
  </Tabs.Root>
</div>
