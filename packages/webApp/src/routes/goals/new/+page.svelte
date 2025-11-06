<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/ui/button";
  import { Input } from "$lib/ui/input";
  import { Textarea } from "$lib/ui/textarea";
  import * as Card from "$lib/ui/card";
  import { goals as goalsApi, agents as agentsApi } from "$lib/api/client";
  import { addNotification } from "$lib/stores/notifications";
  import { onMount } from "svelte";
  import type { Agent } from "@async-agent/api-js-client";

  let objective = "";
  let stepBudget = 20;
  let webhookUrl = "";
  let cronExpression = "";
  let timezone = "UTC";
  let enableSchedule = false;
  let agentName = "";
  let agentId = "";
  let agents: Agent[] = [];
  let loadingAgents = false;

  let isSubmitting = false;
  let errors: Record<string, string> = {};

  const timezones = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];

  onMount(async () => {
    try {
      loadingAgents = true;
      agents = await agentsApi.listAgents({});
    } catch (error: any) {
      console.error("Failed to load agents:", error);
    } finally {
      loadingAgents = false;
    }
  });

  function validateForm(): boolean {
    errors = {};

    if (!objective.trim()) {
      errors.objective = "Objective is required";
    } else if (objective.length < 10) {
      errors.objective = "Objective must be at least 10 characters";
    } else if (objective.length > 10000) {
      errors.objective = "Objective must be less than 10000 characters";
    }

    if (stepBudget < 1 || stepBudget > 100) {
      errors.stepBudget = "Step budget must be between 1 and 100";
    }

    if (webhookUrl && !isValidUrl(webhookUrl)) {
      errors.webhookUrl = "Invalid URL format";
    }

    if (enableSchedule && !cronExpression.trim()) {
      errors.cronExpression =
        "Cron expression is required when schedule is enabled";
    }

    return Object.keys(errors).length === 0;
  }

  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmit() {
    if (!validateForm()) {
      addNotification("Please fix validation errors", "error");
      return;
    }

    isSubmitting = true;

    try {
      const goalData: any = {
        objective,
        params: {
          stepBudget,
        },
      };

      if (webhookUrl) {
        goalData.webhookUrl = webhookUrl;
      }

      if (agentName) {
        goalData.agentName = agentName;
      }

      if (agentId) {
        goalData.agentId = agentId;
      }

      // Add schedule to goal data if enabled
      if (enableSchedule && cronExpression) {
        goalData.schedule = {
          cronExpr: cronExpression,
          timezone,
        };
      }

      const newGoal = await goalsApi.createGoal({ requestBody: goalData });

      addNotification("Goal created successfully", "success");
      goto(`/goals/${newGoal.id}`);
    } catch (error: any) {
      console.error("Failed to create goal:", error);
      addNotification(error.message || "Failed to create goal", "error");
    } finally {
      isSubmitting = false;
    }
  }

  const cronPresets = [
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every day at midnight", value: "0 0 * * *" },
    { label: "Every day at 9 AM", value: "0 9 * * *" },
    { label: "Every Monday at 9 AM", value: "0 9 * * 1" },
    { label: "Every 5 minutes", value: "*/5 * * * *" },
    { label: "Every 15 minutes", value: "*/15 * * * *" },
  ];
</script>

<svelte:head>
  <title>Create Goal - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 max-w-3xl space-y-6">
  <div class="flex items-center gap-2">
    <Button variant="ghost" size="sm" onclick={() => goto("/goals")}>
      ← Back to Goals
    </Button>
  </div>

  <div>
    <h1 class="text-3xl font-bold">Create New Goal</h1>
    <p class="text-muted-foreground mt-1">
      Define a new goal for your async agent
    </p>
  </div>

  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <Card.Root>
      <Card.Header>
        <Card.Title>Goal Details</Card.Title>
        <Card.Description
          >Define what you want the agent to accomplish</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="space-y-2">
          <label for="objective" class="text-sm font-medium">
            Objective <span class="text-destructive">*</span>
          </label>
          <Textarea
            id="objective"
            bind:value={objective}
            placeholder="Describe the goal objective in detail..."
            rows={5}
            class={errors.objective ? "border-destructive" : ""}
          />
          {#if errors.objective}
            <p class="text-sm text-destructive">{errors.objective}</p>
          {:else}
            <p class="text-sm text-muted-foreground">
              {objective.length} / 10000 characters (minimum 10)
            </p>
          {/if}
        </div>

        <div class="space-y-2">
          <label for="stepBudget" class="text-sm font-medium">
            Step Budget
          </label>
          <Input
            id="stepBudget"
            type="number"
            bind:value={stepBudget}
            min="1"
            max="100"
            class={errors.stepBudget ? "border-destructive" : ""}
          />
          {#if errors.stepBudget}
            <p class="text-sm text-destructive">{errors.stepBudget}</p>
          {:else}
            <p class="text-sm text-muted-foreground">
              Maximum number of steps the agent can execute (1-100)
            </p>
          {/if}
        </div>

        <div class="space-y-2">
          <label for="webhookUrl" class="text-sm font-medium">
            Webhook URL (optional)
          </label>
          <Input
            id="webhookUrl"
            type="url"
            bind:value={webhookUrl}
            placeholder="https://example.com/webhook"
            class={errors.webhookUrl ? "border-destructive" : ""}
          />
          {#if errors.webhookUrl}
            <p class="text-sm text-destructive">{errors.webhookUrl}</p>
          {:else}
            <p class="text-sm text-muted-foreground">
              URL to receive notifications about goal execution
            </p>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Agent Configuration (Optional)</Card.Title>
        <Card.Description
          >Specify which agent should execute this goal</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="space-y-2">
          <label for="agentSelection" class="text-sm font-medium">
            Select Agent
          </label>
          {#if loadingAgents}
            <p class="text-sm text-muted-foreground">Loading agents...</p>
          {:else if agents.length === 0}
            <p class="text-sm text-muted-foreground">No agents available</p>
          {:else}
            <select
              id="agentSelection"
              on:change={(e) => {
                const value = e.currentTarget.value;
                if (value.startsWith("name:")) {
                  agentName = value.replace("name:", "");
                  agentId = "";
                } else if (value.startsWith("id:")) {
                  agentId = value.replace("id:", "");
                  agentName = "";
                } else {
                  agentName = "";
                  agentId = "";
                }
              }}
              class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Use default agent</option>
              <optgroup label="Active Agents">
                {#each agents.filter((a) => a.active) as agent}
                  <option value="id:{agent.id}"
                    >{agent.name} v{agent.version} (Active)</option
                  >
                {/each}
              </optgroup>
              <optgroup label="All Agents">
                {#each agents as agent}
                  <option value="id:{agent.id}"
                    >{agent.name} v{agent.version}</option
                  >
                {/each}
              </optgroup>
            </select>
          {/if}
          <p class="text-sm text-muted-foreground">
            Leave empty to use the default active agent
          </p>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Schedule (Optional)</Card.Title>
        <Card.Description
          >Configure automatic execution schedule</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            id="enableSchedule"
            bind:checked={enableSchedule}
            class="h-4 w-4"
          />
          <label for="enableSchedule" class="text-sm font-medium">
            Enable scheduled execution
          </label>
        </div>

        {#if enableSchedule}
          <div class="space-y-4 pl-6 border-l-2">
            <div class="space-y-2">
              <label for="cronPreset" class="text-sm font-medium">
                Quick Presets
              </label>
              <select
                id="cronPreset"
                on:change={(e) => {
                  const value = e.currentTarget.value;
                  if (value) cronExpression = value;
                }}
                class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select a preset...</option>
                {#each cronPresets as preset}
                  <option value={preset.value}>{preset.label}</option>
                {/each}
              </select>
            </div>

            <div class="space-y-2">
              <label for="cronExpression" class="text-sm font-medium">
                Cron Expression <span class="text-destructive">*</span>
              </label>
              <Input
                id="cronExpression"
                bind:value={cronExpression}
                placeholder="0 0 * * *"
                class={errors.cronExpression ? "border-destructive" : ""}
              />
              {#if errors.cronExpression}
                <p class="text-sm text-destructive">{errors.cronExpression}</p>
              {:else}
                <p class="text-sm text-muted-foreground">
                  Format: minute hour day month weekday
                </p>
              {/if}
            </div>

            <div class="space-y-2">
              <label for="timezone" class="text-sm font-medium">
                Timezone
              </label>
              <select
                id="timezone"
                bind:value={timezone}
                class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {#each timezones as tz}
                  <option value={tz}>{tz}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <div class="flex gap-3 justify-end">
      <Button type="button" variant="outline" onclick={() => goto("/goals")}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Goal"}
      </Button>
    </div>
  </form>
</div>
