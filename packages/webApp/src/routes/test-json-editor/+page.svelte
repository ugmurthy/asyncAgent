<script lang="ts">
  import JsonEditor from "$lib/components/common/JsonEditor.svelte";
  import type { Content } from "svelte-jsoneditor";

  // Runtime type for mode; matches svelte-jsoneditor's Mode values
  type Mode = "tree" | "text" | "table" | "form" | "view";

  let content: Content = $state({
    json: {
      name: "Async Agent",
      version: "0.1.0",
      features: ["DAG Execution", "LLM Integration", "Tool Support"],
      config: {
        maxRetries: 3,
        timeout: 30000,
        debug: false,
      },
      agents: [
        { id: 1, name: "Planner", status: "active" },
        { id: 2, name: "Executor", status: "idle" },
      ],
    },
  });

  let mode: Mode = $state("tree");
  let readOnly = $state(false);
  let showMenuBar = $state(true);
  let showNavBar = $state(true);
  let showStatusBar = $state(true);
  let editorHeight = $state("500px");

  let lastChangeInfo = $state<string | null>(null);

  function handleChange(
    updatedContent: Content,
    _previousContent: Content,
    { contentErrors }: { contentErrors: any; patchResult: any }
  ) {
    if (contentErrors) {
      lastChangeInfo = `Error: ${JSON.stringify(contentErrors)}`;
    } else {
      lastChangeInfo = `Content updated at ${new Date().toLocaleTimeString()}`;
    }
  }

  function resetContent() {
    content = {
      json: {
        message: "Content has been reset!",
        timestamp: new Date().toISOString(),
      },
    };
  }

  function loadComplexJson() {
    content = {
      json: {
        database: {
          host: "localhost",
          port: 5432,
          credentials: {
            username: "admin",
            password: "****",
          },
        },
        services: Array.from({ length: 5 }, (_, i) => ({
          id: `service-${i + 1}`,
          endpoints: [`/api/v${i + 1}/resource`],
          methods: ["GET", "POST", "PUT", "DELETE"],
        })),
        metadata: {
          created: new Date().toISOString(),
          version: "2.0.0",
        },
      },
    };
  }
</script>

<div class="container mx-auto p-6 max-w-6xl">
  <h1 class="text-3xl font-bold mb-6">JSON Editor Test Page</h1>

  <div class="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
    <h2 class="text-xl font-semibold mb-4">Controls</h2>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <div>
        <label class="block text-sm font-medium mb-1">Mode</label>
        <select bind:value={mode} class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
          <option value="tree">Tree</option>
          <option value="text">Text</option>
          <option value="table">Table</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Height</label>
        <select bind:value={editorHeight} class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
          <option value="300px">300px</option>
          <option value="400px">400px</option>
          <option value="500px">500px</option>
          <option value="600px">600px</option>
        </select>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 mb-4">
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={readOnly} class="rounded" />
        <span class="text-sm">Read Only</span>
      </label>

      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={showMenuBar} class="rounded" />
        <span class="text-sm">Menu Bar</span>
      </label>

      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={showNavBar} class="rounded" />
        <span class="text-sm">Navigation Bar</span>
      </label>

      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={showStatusBar} class="rounded" />
        <span class="text-sm">Status Bar</span>
      </label>
    </div>

    <div class="flex gap-2">
      <button onclick={resetContent} class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Reset Content
      </button>
      <button onclick={loadComplexJson} class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
        Load Complex JSON
      </button>
    </div>
  </div>

  {#if lastChangeInfo}
    <div class="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
      {lastChangeInfo}
    </div>
  {/if}

  <div class="mb-6">
    <h2 class="text-xl font-semibold mb-2">Editor</h2>
    <JsonEditor
      bind:content
      bind:mode
      {readOnly}
      mainMenuBar={showMenuBar}
      navigationBar={showNavBar}
      statusBar={showStatusBar}
      height={editorHeight}
      onChange={handleChange}
    />
  </div>

  <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
    <h2 class="text-xl font-semibold mb-2">Current Content (Debug)</h2>
    <pre class="text-sm overflow-auto max-h-64 p-3 bg-white dark:bg-gray-900 rounded border">
      {JSON.stringify("json" in content ? content.json : content, null, 2)}
    </pre>
  </div>
</div>
