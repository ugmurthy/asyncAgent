# @async-agent/api-js-client

TypeScript/JavaScript client for the Async Agent API.

**Auto-generated from OpenAPI specification using `openapi-typescript-codegen`.**

## Installation

```bash
npm install @async-agent/api-js-client
```

## Usage

```typescript
import { AsyncAgentClient } from '@async-agent/api-js-client';

// Create client instance
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  // Optional: add headers for authentication
  HEADERS: {
    'Authorization': 'Bearer your-token-here'
  }
});

// List all goals
const goals = await client.goals.listGoals();

// Create a goal
const goal = await client.goals.createGoal({
  requestBody: {
    objective: 'Monitor GitHub repository for new issues',
    params: {
      stepBudget: 20
    }
  }
});

// Get a specific goal
const goalDetails = await client.goals.getGoal({ id: 'goal_abc123' });

// Trigger a run
const run = await client.goals.triggerGoalRun({ 
  id: goal.id,
  requestBody: {}
});

// List runs
const runs = await client.runs.listRuns();

// Get run steps
const steps = await client.runs.getRunSteps({ id: 'run_xyz789' });
```

## Development

This client is auto-generated from the OpenAPI specification using `openapi-typescript-codegen`.

### Regenerate the client

```bash
pnpm run generate
```

### Build

```bash
pnpm run build
```

### Test

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

See [tests/README.md](./tests/README.md) for more information about testing.

## Features

- ✅ Full TypeScript support with auto-generated types
- ✅ Axios-based HTTP client
- ✅ Auto-generated from OpenAPI 3.1 spec
- ✅ No Java required for generation
- ✅ Tree-shakeable ES modules
