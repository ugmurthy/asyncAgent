# desiAgent Library - Code Examples & Reference

This document provides concrete code examples for the refactored desiAgent library.

---

## Example 1: Basic Setup & Usage

### Installation
```bash
npm install desiagent
# or
bun add desiagent
```

### Minimal Setup
```typescript
// main.ts
import { setupDesiAgent } from 'desiagent';

const client = await setupDesiAgent({
  llmProvider: 'openai',
  openaiApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4o',
});

// Create and execute a goal
const goal = await client.goals.create(
  'Analyze the repository structure and suggest improvements',
  { stepBudget: 10 }
);

console.log('Goal created:', goal.id);

// Run the goal
const run = await client.goals.run(goal.id);
console.log('Run started:', run.id, 'Status:', run.status);

// Get execution details
const execution = await client.executions.get(run.id);
console.log('Execution:', execution);

await client.shutdown();
```

### Advanced Setup with Configuration
```typescript
import { setupDesiAgent } from 'desiagent';
import path from 'path';

const config = {
  // LLM Provider
  llmProvider: 'openai' as const,
  openaiApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4o',
  
  // Database
  databasePath: path.join(process.env.HOME!, '.desiAgent/data/agent.db'),
  
  // Agents
  agentDefinitionsPath: path.join(process.env.HOME!, '.desiAgent/agents'),
  
  // Logging
  logLevel: 'info' as const,
  
  // Callbacks
  onExecutionStart: (executionId: string) => {
    console.log(`[START] Execution ${executionId}`);
  },
  
  onExecutionEnd: (executionId: string, result: any) => {
    console.log(`[END] Execution ${executionId}:`, result.status);
  },
};

const client = await setupDesiAgent(config);
// ... use client
```

---

## Example 2: Goal Management API

```typescript
// Create a new goal with schedule
const goal = await client.goals.create(
  'Daily report generation',
  {
    stepBudget: 20,
    allowedTools: ['readFile', 'writeFile', 'bash'],
    constraints: {
      maxTokens: 8000,
      temperature: 0.7,
    },
  }
);
console.log('Created goal:', goal.id, goal.objective);

// List all active goals
const activeGoals = await client.goals.list({ status: 'active' });
console.log('Active goals:', activeGoals.length);

// Get specific goal with related schedules
const fullGoal = await client.goals.get(goal.id);
console.log('Goal details:');
console.log('  Objective:', fullGoal.objective);
console.log('  Status:', fullGoal.status);
console.log('  Schedules:', fullGoal.schedules?.length);

// Update goal properties
const updated = await client.goals.update(goal.id, {
  objective: 'Weekly report generation',
  params: {
    stepBudget: 25,
  },
});
console.log('Updated goal:', updated.id);

// Manually run a goal
const run = await client.goals.run(goal.id);
console.log('Goal execution started:', run.id);

// Check run status
const runDetails = await client.runs.get(run.id);
console.log('Run status:', runDetails.status);
console.log('Steps executed:', runDetails.stepsExecuted);
console.log('Working memory:', runDetails.workingMemory);

// Get execution steps
const steps = await client.runs.getSteps(run.id);
steps.forEach((step, i) => {
  console.log(`Step ${i + 1}:`, step.thought);
  if (step.toolName) {
    console.log(`  Tool: ${step.toolName}`);
    console.log(`  Duration: ${step.durationMs}ms`);
  }
});

// Pause and resume
await client.goals.pause(goal.id);
console.log('Goal paused');

await client.goals.resume(goal.id);
console.log('Goal resumed');

// Delete goal (cascade deletes schedules, runs, steps)
await client.goals.delete(goal.id);
console.log('Goal deleted');
```

---

## Example 3: Agent Management API

```typescript
// Create an agent with custom prompt
const agent = await client.agents.create(
  'DataAnalyzer',
  '1.0.0',
  `You are a data analysis expert. 
   Analyze CSV/JSON files and extract insights.
   Always validate data before processing.
   Return results as structured markdown.`
);
console.log('Created agent:', agent.id);

// List all agents
const allAgents = await client.agents.list();
console.log('Total agents:', allAgents.length);

// List agents with filter
const activeAnalyzers = await client.agents.list({
  name: 'Analyzer',
  active: true,
});

// Get agent details
const agentDetails = await client.agents.get(agent.id);
console.log('Agent:', agentDetails.name);
console.log('Version:', agentDetails.version);
console.log('Active:', agentDetails.active);
console.log('Prompt:', agentDetails.promptTemplate);

// Activate agent (makes it the default for that name)
await client.agents.activate(agent.id);
console.log('Agent activated');

// Resolve active agent by name
const activeAgent = await client.agents.resolve('DataAnalyzer');
if (activeAgent) {
  console.log('Active DataAnalyzer agent:', activeAgent.id);
}

// Update agent
const updatedAgent = await client.agents.update(agent.id, {
  promptTemplate: 'Updated prompt...',
  model: 'gpt-4o',
  provider: 'openai',
});

// Delete agent (only if not active)
await client.agents.delete(agent.id);
console.log('Agent deleted');
```

---

## Example 4: DAG (Directed Acyclic Graph) Execution

### Simple DAG Creation
```typescript
// Create a DAG from natural language
const dag = await client.dags.create(
  'Analyze a CSV file: read data, validate quality, generate summary report',
  {
    stepBudget: 15,
    allowedTools: ['readFile', 'writeFile', 'bash'],
  }
);

console.log('DAG created:', dag.id);
console.log('Tasks:', dag.subTasks?.length);

// Execute the DAG
const execution = await client.dags.execute(dag.id);
console.log('Execution started:', execution.id);
```

### Create and Execute in One Call
```typescript
const execution = await client.dags.createAndExecute(
  'Fetch weather data and generate report for New York',
  {
    stepBudget: 10,
    params: {
      city: 'New York',
      format: 'markdown',
    },
  }
);

console.log('Execution:', execution.id);
console.log('Status:', execution.status);  // 'running', 'completed', 'failed', etc.
```

### Monitor Execution with Event Streaming
```typescript
const execution = await client.dags.execute(dagId);

console.log('Streaming events for execution:', execution.id);

// AsyncIterable pattern for streaming
for await (const event of client.executions.streamEvents(execution.id)) {
  const timestamp = new Date(event.timestamp).toISOString();
  
  switch (event.type) {
    case 'step_started':
      console.log(`[${timestamp}] Step started: ${event.stepName}`);
      break;
    case 'step_completed':
      console.log(`[${timestamp}] Step completed: ${event.stepName}`);
      console.log(`  Duration: ${event.duration}ms`);
      break;
    case 'step_failed':
      console.log(`[${timestamp}] Step failed: ${event.stepName}`);
      console.log(`  Error: ${event.error}`);
      break;
    case 'execution_completed':
      console.log(`[${timestamp}] Execution completed`);
      console.log(`  Result: ${event.result}`);
      break;
    case 'execution_failed':
      console.log(`[${timestamp}] Execution failed: ${event.error}`);
      break;
  }
}
```

### Query Execution Results
```typescript
// Get execution details
const execution = await client.executions.get(executionId);
console.log('Execution details:');
console.log('  Status:', execution.status);
console.log('  Started:', execution.startedAt);
console.log('  Ended:', execution.endedAt);
console.log('  SubSteps:', execution.subSteps?.length);
console.log('  Result:', execution.result);

// Get sub-steps
const subSteps = await client.executions.getSubSteps(executionId);
subSteps.forEach((step, i) => {
  console.log(`\nSubStep ${i + 1}: ${step.description}`);
  console.log(`  Status: ${step.status}`);
  console.log(`  Tool: ${step.toolName}`);
  console.log(`  Output: ${step.output}`);
});

// Resume a suspended or failed execution
if (execution.status === 'suspended') {
  const resumed = await client.dags.resume(executionId);
  console.log('Execution resumed:', resumed.id);
}

// Delete execution
await client.executions.delete(executionId);
console.log('Execution deleted');

// List executions with filtering
const executions = await client.executions.list({
  status: 'completed',
  dagId: dagId,
  limit: 10,
  offset: 0,
});

console.log('Completed executions:', executions.length);
```

---

## Example 5: Tool Management & Task Execution

### List Available Tools
```typescript
// Get all tools
const allTools = await client.tools.list();
console.log('Available tools:');
allTools.forEach(tool => {
  console.log(`  - ${tool.name}: ${tool.description}`);
  console.log(`    Parameters: ${JSON.stringify(tool.inputSchema)}`);
});

// Filter tools by name
const fileTools = await client.tools.list({
  names: ['readFile', 'writeFile', 'glob'],
});

console.log('File tools:', fileTools.map(t => t.name).join(', '));
```

### Execute a Task Directly
```typescript
// Execute a task with a specific agent
const result = await client.executeTask(
  'DataAnalyzer',  // Agent name
  'Analyze the CSV file at ./data.csv and find patterns',
  []  // No file attachments needed (path provided in task)
);

console.log('Task result:');
console.log('  Status:', result.status);
console.log('  Output:', result.output);
console.log('  Metrics:', result.metrics);
```

### Execute Task with File Uploads
```typescript
import fs from 'fs';

// Read file to upload
const fileContent = fs.readFileSync('./my-document.pdf');

const result = await client.executeTask(
  'DocumentAnalyzer',
  'Analyze this document and extract key information',
  [
    {
      name: 'document.pdf',
      content: fileContent,
      mimeType: 'application/pdf',
    },
  ]
);

console.log('Analysis result:', result.output);
```

---

## Example 6: Agent Definition (.mdx) Format

### File: `~/.desiAgent/agents/DataAnalyzer.mdx`
```mdx
---
name: "DataAnalyzer"
version: "1.0.0"
description: "Analyzes CSV and JSON data files"
provider: "openai"
model: "gpt-4o"
tags: ["data", "analysis", "reporting"]
temperature: 0.7
maxTokens: 4000
---

# Data Analysis Agent

This agent specializes in analyzing structured data files (CSV, JSON, etc.)

## Capabilities

- **CSV Parsing**: Read and validate CSV files
- **Data Validation**: Check for data quality issues
- **Statistical Analysis**: Calculate basic statistics
- **Insight Generation**: Identify patterns and trends
- **Report Generation**: Create markdown reports

## System Prompt

You are an expert data analyst. When analyzing data:

1. Always validate the data format first
2. Check for missing or invalid values
3. Calculate summary statistics
4. Identify interesting patterns
5. Generate clear, actionable insights
6. Format results as markdown

Be precise and only claim findings you can support with data.

## Example Usage

**Task**: Analyze sales data and identify top performers

**Parameters**:
- `filePath`: Path to CSV file
- `metric`: Column to analyze (e.g., "revenue")
- `groupBy`: Column to group by (e.g., "salesperson")

**Output**: Markdown report with insights and recommendations
```

### File: `~/.desiAgent/agents/WebScraper.mdx`
```mdx
---
name: "WebScraper"
version: "1.0.0"
description: "Scrapes and summarizes web content"
provider: "openai"
model: "gpt-4-turbo"
tags: ["web", "scraping", "summarization"]
---

# Web Scraper & Summarizer

Fetches web pages and extracts key information.

## Tools Available
- fetchPage: Download and parse web content
- webSearch: Find relevant pages
- writeFile: Save results

## Instructions
Focus on extracting structured information and generating concise summaries.
```

---

## Example 7: Configuration Types Reference

```typescript
// Full configuration interface
interface DesiAgentConfig {
  // === Required ===
  
  // LLM Provider
  llmProvider: 'openai' | 'openrouter' | 'ollama';
  modelName: string;
  
  // === Conditional (required based on provider) ===
  openaiApiKey?: string;           // If llmProvider === 'openai'
  openrouterApiKey?: string;       // If llmProvider === 'openrouter'
  ollamaBaseUrl?: string;          // If llmProvider === 'ollama'
  
  // === Optional ===
  
  // Database
  databasePath?: string;           // Default: ~/.desiAgent/data/agent.db
  
  // Agents
  agentDefinitionsPath?: string;   // Default: ~/.desiAgent/agents
  
  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';  // Default: 'info'
  
  // Callbacks
  onExecutionStart?: (executionId: string) => void;
  onExecutionEnd?: (executionId: string, result: ExecutionResult) => void;
  
  // Model parameters (override agent defaults)
  temperature?: number;            // 0.0-2.0
  maxTokens?: number;              // Max tokens per response
  
  // Scheduler
  autoStartSchedulers?: boolean;   // Default: true
  
  // Timeouts
  executionTimeoutMs?: number;     // Default: 5 minutes
}

// Example with all options
const fullConfig: DesiAgentConfig = {
  llmProvider: 'openai',
  modelName: 'gpt-4o',
  openaiApiKey: process.env.OPENAI_API_KEY,
  
  databasePath: path.join(process.env.HOME!, '.desiAgent/data/agent.db'),
  agentDefinitionsPath: path.join(process.env.HOME!, '.desiAgent/agents'),
  
  logLevel: 'debug',
  temperature: 0.7,
  maxTokens: 4000,
  
  autoStartSchedulers: true,
  executionTimeoutMs: 5 * 60 * 1000,
  
  onExecutionStart: (id) => console.log('Started:', id),
  onExecutionEnd: (id, result) => console.log('Finished:', id, result.status),
};
```

---

## Example 8: Error Handling

```typescript
import { 
  setupDesiAgent,
  DesiAgentError,
  ConfigurationError,
  NotFoundError,
  ValidationError,
  ExecutionError,
} from 'desiagent';

try {
  const client = await setupDesiAgent(config);
  
  try {
    const goal = await client.goals.get('nonexistent-id');
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.error('Goal not found:', error.message);
    }
  }
  
  try {
    const goal = await client.goals.create(
      'x'.repeat(100000),  // Too long
      { stepBudget: -1 }   // Invalid
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation failed:', error.details);
    }
  }
  
  try {
    const execution = await client.dags.execute(dagId);
    // Wait for execution...
  } catch (error) {
    if (error instanceof ExecutionError) {
      console.error('Execution failed:', error.details);
    }
  }
  
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration invalid:', error.message);
    console.error('Missing/invalid fields:', error.invalidFields);
  } else if (error instanceof DesiAgentError) {
    console.error('DesiAgent error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Example 9: Using as HTTP API Wrapper (Backend Integration)

```typescript
// packages/backend/src/app/routes/goals.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DesiAgentClient } from 'desiagent';
import { createGoalSchema } from '@async-agent/shared';

export async function goalsRoutes(
  fastify: FastifyInstance,
  desiClient: DesiAgentClient
) {
  // POST /api/v1/goals - Create goal
  fastify.post('/api/v1/goals', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createGoalSchema.parse(request.body);
      
      const goal = await desiClient.goals.create(
        body.objective,
        body.params
      );
      
      return reply.send(goal);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to create goal' });
    }
  });

  // GET /api/v1/goals - List goals
  fastify.get('/api/v1/goals', async (request: FastifyRequest, reply: FastifyReply) => {
    const filter = request.query.status ? { status: request.query.status } : undefined;
    const goals = await desiClient.goals.list(filter);
    return reply.send(goals);
  });

  // GET /api/v1/goals/:id - Get goal
  fastify.get('/api/v1/goals/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const goal = await desiClient.goals.get(request.params.id);
    if (!goal) {
      return reply.code(404).send({ error: 'Goal not found' });
    }
    return reply.send(goal);
  });

  // ... more routes following same pattern
}
```

---

## Example 10: CLI Tool Usage

```typescript
#!/usr/bin/env bun
// desi-cli.ts
import { setupDesiAgent } from 'desiagent';
import fs from 'fs';

const [command, ...args] = process.argv.slice(2);

async function main() {
  const client = await setupDesiAgent({
    llmProvider: process.env.LLM_PROVIDER as any,
    modelName: process.env.LLM_MODEL,
    openaiApiKey: process.env.OPENAI_API_KEY,
  });

  switch (command) {
    case 'goal:create':
      const goal = await client.goals.create(args[0], JSON.parse(args[1] || '{}'));
      console.log(`Created goal: ${goal.id}`);
      console.log(JSON.stringify(goal, null, 2));
      break;

    case 'goal:run':
      const run = await client.goals.run(args[0]);
      console.log(`Started execution: ${run.id}`);
      
      // Stream events
      for await (const event of client.executions.streamEvents(run.id)) {
        console.log(`[${event.type}]`, event);
      }
      break;

    case 'dag:create':
      const dag = await client.dags.create(args[0]);
      console.log(`Created DAG: ${dag.id}`);
      fs.writeFileSync(`dag-${dag.id}.json`, JSON.stringify(dag, null, 2));
      break;

    default:
      console.log('Usage:');
      console.log('  desi goal:create "<objective>" [params.json]');
      console.log('  desi goal:run <goalId>');
      console.log('  desi dag:create "<objective>"');
  }

  await client.shutdown();
}

main().catch(console.error);
```

---

## Example 11: Configuration via Environment

### `.env` file
```bash
# LLM Provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o

# Paths
DATABASE_PATH=~/.desiAgent/data/agent.db
AGENT_DEFINITIONS_PATH=~/.desiAgent/agents

# Logging
LOG_LEVEL=info

# Model Parameters
TEMPERATURE=0.7
MAX_TOKENS=4000

# Execution
EXECUTION_TIMEOUT_MS=300000
AUTO_START_SCHEDULERS=true
```

### Load from environment
```typescript
import dotenv from 'dotenv';

dotenv.config();

const client = await setupDesiAgent({
  llmProvider: process.env.LLM_PROVIDER as 'openai' | 'openrouter' | 'ollama',
  modelName: process.env.LLM_MODEL!,
  openaiApiKey: process.env.OPENAI_API_KEY,
  databasePath: process.env.DATABASE_PATH,
  agentDefinitionsPath: process.env.AGENT_DEFINITIONS_PATH,
  logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
  temperature: parseInt(process.env.TEMPERATURE || '0.7'),
  maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
});
```

---

## Summary of Key Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| **setupDesiAgent()** | Initialize library | See Example 1 |
| **client.goals.*** | Manage goals | See Example 2 |
| **client.agents.*** | Manage agents | See Example 3 |
| **client.dags.*** | Create/execute DAGs | See Example 4 |
| **client.executions.streamEvents()** | Monitor execution | See Example 4 |
| **.mdx agent files** | Define agent behavior | See Example 6 |
| **HTTP wrapper** | Expose as API | See Example 9 |
| **CLI tool** | Command-line interface | See Example 10 |

---

## Performance Tips

1. **Reuse DesiAgentClient**: Create once, reuse across operations
2. **Batch operations**: Use filters to limit queries
3. **Streaming**: Use `streamEvents()` to avoid polling
4. **Connection pooling**: Database connection is reused automatically
5. **Cleanup**: Call `client.shutdown()` when done to release resources

---

## Common Pitfalls to Avoid

❌ Creating new client for each operation (expensive)
✅ Create once: `const client = await setupDesiAgent(...)`

❌ Not calling `client.shutdown()`
✅ Always await shutdown: `await client.shutdown()`

❌ Blocking on event streams
✅ Use `for await` loop with AsyncIterable

❌ Hardcoding secrets in code
✅ Use environment variables and config

❌ Not validating user input
✅ Library validates with Zod automatically
