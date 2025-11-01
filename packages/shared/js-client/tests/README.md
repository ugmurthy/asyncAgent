# Tests for @async-agent/api-js-client

This directory contains unit tests for the Async Agent API client using Vitest.

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run tests with coverage
pnpm test -- --coverage
```

## Test Structure

### `client.test.ts`
Tests for the main API operations:

**Goals API Tests:**
- ✅ List all goals
- ✅ Filter goals by status
- ✅ Create a new goal
- ✅ Get a specific goal by ID
- ✅ Trigger a goal run

**Runs API Tests:**
- ✅ List all runs
- ✅ Filter runs by status
- ✅ Get a specific run by ID
- ✅ Get run steps

**Client Configuration Tests:**
- ✅ Create client with custom base URL
- ✅ Create client with authentication headers

### `health.test.ts`
Tests for health check endpoints:
- ✅ Get basic health status
- ✅ Get detailed readiness status

## Test Approach

All tests use **mocked API responses** to avoid making real HTTP requests. This ensures:
- Fast test execution
- No dependency on a running server
- Predictable test results
- No side effects

## Example Test Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsyncAgentClient } from '../src';

describe('My Feature', () => {
  let client: AsyncAgentClient;

  beforeEach(() => {
    client = new AsyncAgentClient({
      BASE: 'http://localhost:3000/api/v1'
    });
  });

  it('should do something', async () => {
    // Mock the response
    const mockData = { /* ... */ };
    vi.spyOn(client.goals, 'listGoals').mockResolvedValue(mockData);

    // Call the method
    const result = await client.goals.listGoals();

    // Assert
    expect(result).toBeDefined();
    expect(result).toEqual(mockData);
  });
});
```

## Coverage

To generate a test coverage report:

```bash
pnpm test -- --coverage
```

This will create an HTML report in the `coverage/` directory.

## Adding New Tests

When adding new endpoints or features:

1. Create a new test file in `tests/` or add to an existing one
2. Follow the existing test patterns
3. Mock the API responses
4. Test both success and error cases
5. Verify type safety with TypeScript

## CI/CD

These tests can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: pnpm --filter @async-agent/api-js-client test

- name: Run Tests with Coverage
  run: pnpm --filter @async-agent/api-js-client test -- --coverage
```
