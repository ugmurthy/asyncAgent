<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/ui/button";
  import { Input } from "$lib/ui/input";
  import { Textarea } from "$lib/ui/textarea";
  import * as Card from "$lib/ui/card";
  import { dag as dagApi, agents as agentsApi } from "$lib/api/client";
  import { addNotification } from "$lib/stores/notifications";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import type { Agent } from "@async-agent/api-js-client";

  let goalText = "";
  let agentName = "";
  let agents: Agent[] = [];
  let loadingAgents = false;
  
  // Advanced settings
  let showAdvanced = false;
  let provider = "";
  let model = "";
  let temperature = 0.7;
  let maxTokens: number | undefined = undefined;

  let isSubmitting = false;
  let errors: Record<string, string> = {};

  onMount(async () => {
    const initialGoal = $page.url.searchParams.get("initialGoal");
    if (initialGoal) {
      goalText = initialGoal;
    }

    try {
      loadingAgents = true;
      const response = await agentsApi.listAgents({});
      // @ts-ignore - Handle potential API response wrapper vs direct array
      agents = response.agents || response || [];
      
      if (Array.isArray(agents)) {
        // Select first active agent by default
        const activeAgent = agents.find(a => a.active);
        if (activeAgent) {
            agentName = activeAgent.name;
        }
      }
    } catch (error: any) {
      console.error("Failed to load agents:", error);
      addNotification("Failed to load agents", "error");
    } finally {
      loadingAgents = false;
    }
  });

  function validateForm(): boolean {
    errors = {};

    if (!goalText.trim()) {
      errors.goalText = "Goal description is required";
    }

    if (!agentName) {
      errors.agentName = "Agent selection is required";
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) {
      addNotification("Please fix validation errors", "error");
      return;
    }

    isSubmitting = true;

    try {
      const requestBody: any = {
        "goal-text": goalText,
        agentName,
      };
      
      if (provider) requestBody.provider = provider;
      if (model) requestBody.model = model;
      if (temperature !== 0.7) requestBody.temperature = temperature;
      if (maxTokens) requestBody.max_tokens = maxTokens;

      const response = await dagApi.createDag({ requestBody });

      addNotification("DAG created successfully", "success");
      
      // The response contains dagId if successful, or status: 'clarification_required'
      // @ts-ignore
      if (response.status === 'success' && response.dagId) {
         // @ts-ignore
         goto(`/dags/${response.dagId}`);
      // @ts-ignore
      } else if (response.status === 'clarification_required') {
         // @ts-ignore
         addNotification(`Clarification needed: ${response.clarification_query}`, "warning");
      } else {
         goto('/dags');
      }

    } catch (error: any) {
      console.error("Failed to create DAG:", error);
      addNotification(error.message || "Failed to create DAG", "error");
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create DAG - AsyncAgent</title>
</svelte:head>

<div class="container mx-auto py-6 max-w-3xl space-y-6">
  <div class="flex items-center gap-2">
    <Button variant="ghost" size="sm" onclick={() => goto("/dags")}>
      ← Back to DAGs
    </Button>
  </div>

  <div>
    <h1 class="text-3xl font-bold">Create New DAG</h1>
    <p class="text-muted-foreground mt-1">
      Decompose a high-level goal into a Directed Acyclic Graph of tasks
    </p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
    <Card.Root>
      <Card.Header>
        <Card.Title>Goal Details</Card.Title>
        <Card.Description>
          Describe what you want to achieve. The agent will decompose this into tasks.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="space-y-2">
          <label for="goalText" class="text-sm font-medium">
            Goal Description <span class="text-destructive">*</span>
          </label>
          <Textarea
            id="goalText"
            bind:value={goalText}
            placeholder="e.g., Research the latest trends in AI agent architecture and write a summary blog post..."
            rows={5}
            class={errors.goalText ? "border-destructive" : ""}
          />
          {#if errors.goalText}
            <p class="text-sm text-destructive">{errors.goalText}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <label for="agentName" class="text-sm font-medium">
            Select Agent <span class="text-destructive">*</span>
          </label>
          {#if loadingAgents}
            <p class="text-sm text-muted-foreground">Loading agents...</p>
          {:else if agents.length === 0}
             <p class="text-sm text-destructive">No agents available. Please create an agent first.</p>
          {:else}
            <select
              id="agentName"
              bind:value={agentName}
              class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="" disabled>Select an agent...</option>
              {#each agents as agent}
                <option value={agent.name}>
                  {agent.name} (v{agent.version}) {agent.active ? "" : "(Inactive)"}
                </option>
              {/each}
            </select>
          {/if}
          {#if errors.agentName}
            <p class="text-sm text-destructive">{errors.agentName}</p>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <div 
            class="flex items-center justify-between cursor-pointer w-full" 
            onclick={() => showAdvanced = !showAdvanced}
            onkeydown={(e) => e.key === 'Enter' && (showAdvanced = !showAdvanced)}
            role="button"
            tabindex="0"
        >
            <Card.Title>Advanced Settings (Optional)</Card.Title>
            <Button variant="ghost" size="sm">{showAdvanced ? 'Hide' : 'Show'}</Button>
        </div>
      </Card.Header>
      {#if showAdvanced}
      <Card.Content class="space-y-4">
         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
                <label for="provider" class="text-sm font-medium">LLM Provider</label>
                <select
                    id="provider"
                    bind:value={provider}
                    class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <option value="">Default (Server Config)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="ollama">Ollama</option>
                </select>
            </div>
            <div class="space-y-2">
                <label for="model" class="text-sm font-medium">Model Name</label>
                <Input 
                    id="model" 
                    bind:value={model} 
                    placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                />
            </div>
         </div>
         
         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div class="space-y-2">
                <label for="temperature" class="text-sm font-medium">Temperature ({temperature})</label>
                <input 
                    id="temperature" 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1" 
                    bind:value={temperature}
                    class="w-full"
                />
             </div>
             <div class="space-y-2">
                <label for="maxTokens" class="text-sm font-medium">Max Tokens</label>
                <Input 
                    id="maxTokens" 
                    type="number" 
                    bind:value={maxTokens} 
                    placeholder="Optional limit"
                />
             </div>
         </div>
      </Card.Content>
      {/if}
    </Card.Root>

    <div class="flex gap-3 justify-end">
      <Button type="button" variant="outline" onclick={() => goto("/dags")}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create DAG"}
      </Button>
    </div>
  </form>
</div>
