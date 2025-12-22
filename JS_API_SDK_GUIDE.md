# JavaScript API SDK Guide

The Async Agent JavaScript SDK provides a type-safe, auto-generated client for interacting with the Async Agent API. It's built from the OpenAPI specification and includes full TypeScript support.

## Installation

```bash
npm install @async-agent/api-js-client
```

Or with pnpm:

```bash
pnpm add @async-agent/api-js-client
```

## Quick Start

```typescript
import { AsyncAgentClient } from '@async-agent/api-js-client';

// Create a client instance
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1'
});

// Use the client
const goals = await client.goals.listGoals();
```

## Client Configuration

### Basic Configuration

```typescript
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  // Optional: API version (defaults to '0.3.0')
  VERSION: '0.3.0'
});
```

### Authentication

```typescript
// Using Bearer token
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  TOKEN: 'your-bearer-token'
});

// Or with custom headers
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  HEADERS: {
    'Authorization': 'Bearer your-token-here',
    'X-Custom-Header': 'value'
  }
});

// Using basic auth
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  USERNAME: 'username',
  PASSWORD: 'password'
});
```

### Advanced Configuration

```typescript
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  VERSION: '0.3.0',
  WITH_CREDENTIALS: true,
  CREDENTIALS: 'include',
  TOKEN: 'your-token',
  HEADERS: {
    'X-Custom-Header': 'value'
  },
  ENCODE_PATH: true
});
```

## API Services

The client provides access to 8 main services:

- `client.health` - Health and readiness checks
- `client.goals` - Goal management
- `client.runs` - Run execution and monitoring
- `client.agents` - Agent management
- `client.tools` - Tool registry and definitions
- `client.dag` - DAG creation and execution
- `client.artifacts` - Access to generated artifacts
- `client.task` - Execute agent tasks with file uploads

## Health Service

### Check API Health

```typescript
// Get basic health status
const health = await client.health.getHealth();
console.log(health.status); // 'ok'
console.log(health.timestamp);
```

### Check Readiness

```typescript
// Get detailed readiness status
const readiness = await client.health.getHealthReady();
console.log(readiness.status); // 'ready'
console.log(readiness.provider); // 'openai'
console.log(readiness.model); // 'gpt-4o'
console.log(readiness.scheduler.activeSchedules); // number of active schedules
```

## Goals Service

Goals represent autonomous tasks that the agent executes.

### List Goals

```typescript
// List all goals
const goals = await client.goals.listGoals();

// Filter by status
const activeGoals = await client.goals.listGoals({ 
  status: 'active' 
});
```

Status values: `'active'`, `'paused'`, `'completed'`, `'failed'`

### Create a Goal

```typescript
const goal = await client.goals.createGoal({
  requestBody: {
    objective: 'Monitor GitHub repository for new issues and summarize them',
    params: {
      stepBudget: 20,
      allowedTools: ['web_search', 'web_scrape']
    },
    webhookUrl: 'https://example.com/webhook', // optional
    agentName: 'defaultAgent' // optional - uses active version
  }
});

console.log(goal.id); // 'goal_...'
console.log(goal.status); // 'active'
```

### Create Goal with Schedule

```typescript
const goal = await client.goals.createGoal({
  requestBody: {
    objective: 'Daily market analysis',
    params: {
      stepBudget: 30,
      allowedTools: ['web_search']
    },
    schedule: {
      cronExpr: '0 9 * * *', // 9 AM daily
      timezone: 'UTC'
    }
  }
});
```

### Get Goal Details

```typescript
const goal = await client.goals.getGoal({ id: 'goal_abc123' });

console.log(goal.id);
console.log(goal.objective);
console.log(goal.params);
console.log(goal.schedules); // array of associated schedules
```

### Update Goal

```typescript
const updated = await client.goals.updateGoal({
  id: 'goal_abc123',
  requestBody: {
    objective: 'Updated objective',
    params: { stepBudget: 50 },
    status: 'paused'
  }
});
```

### Trigger Goal Execution

```typescript
const result = await client.goals.triggerGoalRun({
  id: 'goal_abc123',
  requestBody: {}
});

console.log(result.runId); // 'run_...'
console.log(result.message);
```

### Pause Goal

```typescript
const result = await client.goals.pauseGoal({
  id: 'goal_abc123',
  requestBody: {}
});

console.log(result.message); // 'Goal paused successfully'
```

### Resume Goal

```typescript
const result = await client.goals.resumeGoal({
  id: 'goal_abc123',
  requestBody: {}
});

console.log(result.message); // 'Goal resumed successfully'
```

### Delete Goal

```typescript
// Delete goal and all associated schedules/runs
await client.goals.deleteGoal({ id: 'goal_abc123' });
```

## Runs Service

Runs represent individual executions of a goal.

### List Runs

```typescript
// List all runs (limited to 50 most recent)
const runs = await client.runs.listRuns();

// Filter by status
const completedRuns = await client.runs.listRuns({ 
  status: 'completed' 
});

// Filter by goal
const goalRuns = await client.runs.listRuns({ 
  goalId: 'goal_abc123' 
});

// Combine filters
const filtered = await client.runs.listRuns({ 
  goalId: 'goal_abc123',
  status: 'completed'
});
```

Status values: `'pending'`, `'running'`, `'completed'`, `'failed'`, `'stopped'`

### Get Run Details

```typescript
const run = await client.runs.getRun({ id: 'run_xyz789' });

console.log(run.id);
console.log(run.goalId);
console.log(run.status);
console.log(run.startedAt);
console.log(run.endedAt);
console.log(run.stepsExecuted);
console.log(run.stepBudget);
console.log(run.workingMemory); // agent's working memory
console.log(run.error); // error message if failed
```

### Get Run Steps

```typescript
const steps = await client.runs.getRunSteps({ id: 'run_xyz789' });

steps.forEach(step => {
  console.log(`Step ${step.stepNo}:`);
  console.log(`  Thought: ${step.thought}`);
  console.log(`  Tool: ${step.toolName}`);
  console.log(`  Tool Input: ${JSON.stringify(step.toolInput)}`);
  console.log(`  Observation: ${step.observation}`);
  console.log(`  Duration: ${step.durationMs}ms`);
});
```

Step object structure:
- `id` - Unique step identifier
- `runId` - Associated run ID
- `stepNo` - Step number in sequence
- `thought` - Agent's reasoning
- `toolName` - Tool used (null if no tool)
- `toolInput` - Input to tool
- `observation` - Tool output
- `durationMs` - Execution time
- `error` - Error message if failed
- `createdAt` - Timestamp

### Delete Run

```typescript
await client.runs.deleteRun({ id: 'run_xyz789' });
```

## Agents Service

Manage agent versions and configurations.

### List Agents

```typescript
// List all agents
const agents = await client.agents.listAgents();

// Filter by name
const myAgent = await client.agents.listAgents({ 
  name: 'defaultAgent' 
});

// Filter by active status
const activeAgents = await client.agents.listAgents({ 
  active: 'true' 
});
```

### Create Agent

```typescript
const agent = await client.agents.createAgent({
  requestBody: {
    name: 'myAgent',
    version: '1.0.0',
    prompt: 'You are a helpful assistant...'
  }
});

console.log(agent.id); // 'agent_...'
```

### Get Agent

```typescript
const agent = await client.agents.getAgent({ id: 'agent_abc123' });

console.log(agent.name);
console.log(agent.version);
console.log(agent.prompt);
console.log(agent.active);
```

### Update Agent

```typescript
const updated = await client.agents.updateAgent({
  id: 'agent_abc123',
  requestBody: {
    prompt: 'Updated system prompt...',
    active: true
  }
});
```

### Delete Agent

```typescript
await client.agents.deleteAgent({ id: 'agent_abc123' });
```

## Tools Service

Access available tools and their definitions.

### List Tools

```typescript
const tools = await client.tools.listTools();

tools.forEach(tool => {
  console.log(`Tool: ${tool.name}`);
  console.log(`  Description: ${tool.description}`);
  console.log(`  Input Schema: ${JSON.stringify(tool.inputSchema)}`);
});
```

### Get Tool

```typescript
const tool = await client.tools.getTool({ name: 'web_search' });

console.log(tool.name);
console.log(tool.description);
console.log(tool.inputSchema);
```

## DAG Service

Work with Directed Acyclic Graphs for complex task execution.

### List DAGs

```typescript
const dags = await client.dag.listDags({
  limit: 50,
  offset: 0
});

console.log(dags.dags);
console.log(dags.pagination);
```

### Create DAG

```typescript
const dag = await client.dag.createDag({
  requestBody: {
    description: 'Multi-step workflow',
    tasks: [
      {
        id: 'task1',
        description: 'Gather data',
        type: 'search'
      },
      {
        id: 'task2',
        description: 'Analyze results',
        type: 'analysis'
      }
    ]
  }
});
```

### Execute DAG

```typescript
const execution = await client.dag.executeDag({
  id: 'dag_abc123'
});

console.log(execution.id); // 'dag-exec_...'
console.log(execution.status);
```

### Get Execution Status

```typescript
const exec = await client.dag.getDagExecution({ 
  id: 'dag-exec_xyz789' 
});

console.log(exec.status); // 'pending', 'running', 'completed', etc.
console.log(exec.completedTasks);
console.log(exec.failedTasks);
console.log(exec.totalTasks);
console.log(exec.finalResult);
```

### Get Execution Steps

```typescript
const steps = await client.dag.getDagExecutionSteps({ 
  executionId: 'dag-exec_xyz789' 
});

console.log(steps.executionId);
console.log(steps.subSteps);
```

### Update DAG

```typescript
const updated = await client.dag.updateDag({
  id: 'dag_abc123',
  requestBody: {
    status: 'paused',
    cronSchedule: '0 9 * * *',
    scheduleActive: true
  }
});
```

### Delete DAG Execution

```typescript
const result = await client.dag.deleteDagExecution({ 
  executionId: 'dag-exec_xyz789' 
});

console.log(result.cascadeInfo.relatedSubStepsDeleted);
```

## Task Service

Execute agent tasks with optional file uploads.

### Execute Task

```typescript
const result = await client.task.executeTask({
  requestBody: {
    objective: 'Analyze this document',
    agentName: 'defaultAgent'
  }
});
```

### Execute Task with File

```typescript
const formData = new FormData();
formData.append('objective', 'Analyze this CSV file');
formData.append('agentName', 'dataAgent');
formData.append('file', fileBlob);

const result = await client.task.executeTask({
  requestBody: formData
});
```

## Artifacts Service

Access generated output files.

### List Artifacts

```typescript
const artifacts = await client.artifacts.listArtifacts();
```

### Get Artifact

```typescript
const artifact = await client.artifacts.getArtifact({ 
  name: 'report.pdf' 
});
```

## Error Handling

All methods throw `ApiError` on HTTP errors:

```typescript
import { ApiError, AsyncAgentClient } from '@async-agent/api-js-client';

const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1'
});

try {
  const goal = await client.goals.getGoal({ id: 'invalid_id' });
} catch (error) {
  if (error instanceof ApiError) {
    console.log(`HTTP ${error.status}: ${error.message}`);
    console.log(error.body);
  }
}
```

## Type Safety

All responses are fully typed:

```typescript
import type { 
  Goal, 
  GoalWithSchedules, 
  Run, 
  RunWithGoal,
  Step,
  Agent,
  DAG,
  DAGExecution
} from '@async-agent/api-js-client';

const goal: Goal = await client.goals.createGoal({
  requestBody: {
    objective: 'My goal'
  }
});

const run: RunWithGoal = await client.runs.getRun({ id: 'run_123' });

const steps: Step[] = await client.runs.getRunSteps({ id: 'run_123' });
```

## Cancellation

All methods return a `CancelablePromise`:

```typescript
import { CancelError } from '@async-agent/api-js-client';

const promise = client.goals.listGoals();

try {
  // Cancel the request
  promise.cancel();
  await promise;
} catch (error) {
  if (error instanceof CancelError) {
    console.log('Request was cancelled');
  }
}
```

## Frontend URLs for Testing

When developing with the JavaScript SDK, use these URLs to verify the frontend is rendering correctly:

### Local Development

| Purpose | URL | Notes |
|---------|-----|-------|
| **Web Application Home** | `http://localhost:5173` | Main SvelteKit web UI |
| **Goals Dashboard** | `http://localhost:5173/goals` | View and manage goals |
| **Runs List** | `http://localhost:5173/runs` | Monitor all runs |
| **Create New Goal** | `http://localhost:5173/goals/new` | Create goal form |
| **View Specific Goal** | `http://localhost:5173/goals/goal_xyz789` | Details page for a goal |
| **View Specific Run** | `http://localhost:5173/runs/run_xyz789` | Run details with steps |
| **Agents Management** | `http://localhost:5173/agents` | View and manage agents |
| **DAG Management** | `http://localhost:5173/dag` | Create and execute DAGs |
| **Settings** | `http://localhost:5173/settings` | Application settings |

### API Health Checks

| Purpose | URL | Notes |
|---------|-----|-------|
| **Basic Health Check** | `http://localhost:3000/health` | Returns `{"status":"ok","timestamp":"..."}` |
| **Readiness Check** | `http://localhost:3000/health/ready` | Returns provider, model, scheduler info |
| **OpenAPI Spec** | `http://localhost:3000/openapi.json` | Full API specification |

### API Endpoints (REST)

| Operation | URL | Method |
|-----------|-----|--------|
| **List Goals** | `http://localhost:3000/api/v1/goals` | GET |
| **Create Goal** | `http://localhost:3000/api/v1/goals` | POST |
| **Get Goal** | `http://localhost:3000/api/v1/goals/goal_xyz789` | GET |
| **List Runs** | `http://localhost:3000/api/v1/runs` | GET |
| **Get Run** | `http://localhost:3000/api/v1/runs/run_xyz789` | GET |
| **List DAG Executions** | `http://localhost:3000/api/v1/dag/execution` | GET |

### Testing with cURL

```bash
# Check health
curl http://localhost:3000/health

# Check readiness
curl http://localhost:3000/health/ready

# List goals
curl http://localhost:3000/api/v1/goals

# Create goal
curl -X POST http://localhost:3000/api/v1/goals \
  -H "Content-Type: application/json" \
  -d '{
    "objective": "Test goal from curl",
    "params": {"stepBudget": 10}
  }'

# Get specific goal
curl http://localhost:3000/api/v1/goals/goal_abc123
```

### Frontend Verification Checklist

When you start both the backend and web app, verify:

- [ ] Web app loads at `http://localhost:5173`
- [ ] Dashboard displays without errors
- [ ] API health check passes: `http://localhost:3000/health`
- [ ] Can create a goal via web UI
- [ ] Created goal appears in goals list
- [ ] Can trigger a run from the web UI
- [ ] Run appears in runs list with status updates
- [ ] Can view run details and steps

## Common Patterns

### Polling for Completion

```typescript
async function waitForRunCompletion(runId: string, maxWait = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < maxWait) {
    const run = await client.runs.getRun({ id: runId });
    
    if (run.status === 'completed' || run.status === 'failed') {
      return run;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Run did not complete within timeout');
}

const result = await waitForRunCompletion('run_123');
console.log(`Run ${result.id} finished with status: ${result.status}`);
```

### Create and Execute Goal

```typescript
async function createAndExecuteGoal(objective: string) {
  // Create goal
  const goal = await client.goals.createGoal({
    requestBody: {
      objective,
      params: { stepBudget: 20 }
    }
  });
  
  // Trigger execution
  const triggerResult = await client.goals.triggerGoalRun({
    id: goal.id,
    requestBody: {}
  });
  
  // Wait for completion
  const run = await waitForRunCompletion(triggerResult.runId);
  
  // Get steps
  const steps = await client.runs.getRunSteps({ id: run.id });
  
  return { goal, run, steps };
}
```

### Batch Operations

```typescript
async function createMultipleGoals(objectives: string[]) {
  const promises = objectives.map(objective =>
    client.goals.createGoal({
      requestBody: { objective }
    })
  );
  
  return Promise.all(promises);
}

const goals = await createMultipleGoals([
  'Task 1',
  'Task 2',
  'Task 3'
]);
```

## Testing

The SDK is designed for easy testing with mocked responses:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AsyncAgentClient } from '@async-agent/api-js-client';

describe('Goal Management', () => {
  it('should create and retrieve a goal', async () => {
    const client = new AsyncAgentClient();
    
    vi.spyOn(client.goals, 'createGoal').mockResolvedValue({
      id: 'goal_123',
      objective: 'Test goal',
      params: { stepBudget: 10 },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    const goal = await client.goals.createGoal({
      requestBody: { objective: 'Test goal' }
    });
    
    expect(goal.id).toBe('goal_123');
    expect(client.goals.createGoal).toHaveBeenCalled();
  });
});
```

## Troubleshooting

### Connection Issues

```typescript
// Verify API is running
const health = await client.health.getHealth();
console.log('API is running:', health.status === 'ok');

// Check readiness
const ready = await client.health.getHealthReady();
console.log('LLM Provider:', ready.provider);
console.log('Model:', ready.model);
```

### Authentication Errors

```typescript
// Verify token is valid
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  TOKEN: 'your-token'
});

try {
  await client.goals.listGoals();
} catch (error) {
  if (error.status === 401 || error.status === 403) {
    console.log('Authentication failed - check your token');
  }
}
```

### Rate Limiting

```typescript
// Handle rate limit (429)
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

const goals = await withRetry(() => client.goals.listGoals());
```

## API Reference

For complete endpoint documentation, see the [OpenAPI specification](./openapi.yaml).

### Endpoints by Service

**Health**
- `GET /health` - Get health status
- `GET /health/ready` - Get readiness status

**Goals**
- `GET /api/v1/goals` - List goals
- `POST /api/v1/goals` - Create goal
- `GET /api/v1/goals/{id}` - Get goal
- `PATCH /api/v1/goals/{id}` - Update goal
- `DELETE /api/v1/goals/{id}` - Delete goal
- `POST /api/v1/goals/{id}/run` - Trigger run
- `POST /api/v1/goals/{id}/pause` - Pause goal
- `POST /api/v1/goals/{id}/resume` - Resume goal

**Runs**
- `GET /api/v1/runs` - List runs
- `GET /api/v1/runs/{id}` - Get run
- `DELETE /api/v1/runs/{id}` - Delete run
- `GET /api/v1/runs/{id}/steps` - Get run steps

**Agents**
- `GET /api/v1/agents` - List agents
- `POST /api/v1/agents` - Create agent
- `GET /api/v1/agents/{id}` - Get agent
- `PATCH /api/v1/agents/{id}` - Update agent
- `DELETE /api/v1/agents/{id}` - Delete agent

**Tools**
- `GET /api/v1/tools` - List tools
- `GET /api/v1/tools/{name}` - Get tool

**DAG**
- `GET /api/v1/dag` - List DAGs
- `POST /api/v1/dag` - Create DAG
- `GET /api/v1/dag/{id}` - Get DAG
- `PATCH /api/v1/dag/{id}` - Update DAG
- `DELETE /api/v1/dag/{id}` - Delete DAG
- `POST /api/v1/dag/{id}/execute` - Execute DAG
- `GET /api/v1/dag/execution/{executionId}` - Get execution
- `GET /api/v1/dag/execution/{executionId}/steps` - Get execution steps
- `DELETE /api/v1/dag/execution/{executionId}` - Delete execution

**Task**
- `POST /api/v1/task/execute` - Execute task with optional file upload

**Artifacts**
- `GET /api/v1/artifacts` - List artifacts
- `GET /api/v1/artifacts/{name}` - Get artifact
