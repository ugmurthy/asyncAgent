# Testing the JavaScript SDK

Comprehensive test suite for the `@async-agent/api-js-client` package.

## Quick Start

```bash
# Run all tests
pnpm test

# Watch mode (re-runs on changes)
pnpm test:watch

# From repository root
pnpm test  # Runs tests in all packages including this one
```

## Test Coverage

### ✅ Goals API (11 tests)
- **List Goals**
  - Get all goals
  - Filter by status (active, paused, archived)
- **Create Goal**
  - With basic params
  - With schedule configuration
  - With webhook URL
- **Get Goal**
  - Retrieve by ID
  - Includes schedules
- **Update Goal**
  - Modify objective
  - Change status
  - Update params
- **Trigger Run**
  - Manual execution
- **Pause/Resume**
  - Pause goal
  - Resume goal

### ✅ Runs API (4 tests)
- **List Runs**
  - Get all runs
  - Filter by status (pending, running, completed, failed)
  - Includes goal details
- **Get Run**
  - Retrieve by ID
  - With goal information
- **Get Steps**
  - List all steps in a run
  - Includes tool usage and observations
- **Delete Run**
  - Remove run and steps

### ✅ Health API (2 tests)
- **Health Check**
  - Basic health status
- **Readiness Check**
  - LLM provider info
  - Model configuration
  - Active schedules count

### ✅ Client Configuration (2 tests)
- Custom base URL
- Authentication headers

## Test Examples

### Testing Goals Listing

```typescript
import { AsyncAgentClient } from '@async-agent/api-js-client';

const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1'
});

// List all goals
const goals = await client.goals.listGoals();
console.log(`Found ${goals.length} goals`);

// Filter active goals only
const activeGoals = await client.goals.listGoals({ 
  status: 'active' 
});
```

### Testing Runs Listing

```typescript
// List all runs
const runs = await client.runs.listRuns();
console.log(`Found ${runs.length} runs`);

// Filter completed runs
const completedRuns = await client.runs.listRuns({ 
  status: 'completed' 
});

// Get detailed run information
const run = await client.runs.getRun({ id: 'run_xyz789' });
console.log(`Run status: ${run.status}`);
console.log(`Steps executed: ${run.stepsExecuted}/${run.stepBudget}`);

// Get run steps
const steps = await client.runs.getRunSteps({ id: 'run_xyz789' });
steps.forEach(step => {
  console.log(`Step ${step.stepNo}: ${step.thought}`);
  if (step.toolName) {
    console.log(`  Used tool: ${step.toolName}`);
  }
});
```

### Testing with Authentication

```typescript
const client = new AsyncAgentClient({
  BASE: 'http://localhost:3000/api/v1',
  HEADERS: {
    'Authorization': 'Bearer your-token-here'
  }
});

const goals = await client.goals.listGoals();
```

## Mock Testing Strategy

All tests use mocked responses (via Vitest's `vi.mock` and `vi.spyOn`) to:

1. **Avoid real HTTP calls** - Tests run without a server
2. **Fast execution** - No network latency
3. **Predictable results** - Controlled test data
4. **No side effects** - Safe to run repeatedly

Example mock:

```typescript
import { vi } from 'vitest';

// Mock a successful response
vi.spyOn(client.goals, 'listGoals').mockResolvedValue([
  {
    id: 'goal_abc123',
    objective: 'Test goal',
    params: { stepBudget: 20 },
    status: 'active',
    createdAt: '2025-10-30T10:30:00.000Z',
    updatedAt: '2025-10-30T10:30:00.000Z',
    schedules: []
  }
]);

const goals = await client.goals.listGoals();
expect(goals).toHaveLength(1);
```

## Test Structure

```
tests/
├── client.test.ts      # Goals & Runs API tests
├── health.test.ts      # Health check tests
└── README.md           # Testing documentation
```

## Running Specific Tests

```bash
# Run only client tests
pnpm test client.test

# Run only health tests
pnpm test health.test

# Run tests matching a pattern
pnpm test -- --grep "Goals API"
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
name: Test JavaScript SDK

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm --filter @async-agent/api-js-client test
      
      - name: Coverage
        run: pnpm --filter @async-agent/api-js-client test -- --coverage
```

## Test Data Patterns

All test data follows the OpenAPI schema:

**Goal ID format**: `goal_[a-z0-9]+` (e.g., `goal_abc123`)  
**Run ID format**: `run_[a-z0-9]+` (e.g., `run_xyz789`)  
**Step ID format**: `step_[a-z0-9]+` (e.g., `step_abc123`)  
**Schedule ID format**: `sched_[a-z0-9]+` (e.g., `sched_xyz789`)

## Type Safety

All tests are written in TypeScript and use the generated types:

```typescript
import type { 
  Goal, 
  Run, 
  GoalWithSchedules, 
  RunWithGoal,
  Step 
} from '@async-agent/api-js-client';

// TypeScript ensures data matches schema
const goal: GoalWithSchedules = {
  // ... TypeScript will validate this
};
```

## Next Steps

- [ ] Add integration tests (with real API)
- [ ] Add E2E tests with test fixtures
- [ ] Increase coverage to 100%
- [ ] Add performance tests
- [ ] Add error handling tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [OpenAPI Specification](../../openapi.yaml)
- [API Documentation](https://localhost:3000/api/docs)
