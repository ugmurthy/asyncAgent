# Backend Test Suite

## Overview

This test suite provides comprehensive coverage for the async-agent backend using Vitest.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test -- --watch
```

## Test Structure

### Unit Tests

#### Environment (`src/util/__tests__/env.test.ts`)
- Validates environment variable parsing
- Tests default values
- Tests custom configurations
- Tests various LLM provider settings

#### Database Schema (`src/db/__tests__/schema.test.ts`)
- Validates table structure
- Ensures all columns are defined
- Tests schema relationships

#### Server Health (`src/app/__tests__/server.test.ts`)
- Tests health check endpoints
- Validates server initialization

### Integration Tests

#### Goal Workflow (`src/__tests__/integration/goal-workflow.test.ts`)
- Tests goal creation schema validation
- Tests goal update schema validation
- Tests goal parameters validation
- Validates webhook and schedule configurations

## Test Configuration

The test suite uses Vitest with the following configuration (see `vitest.config.ts`):

- **Environment**: Node
- **Globals**: Enabled for easier test writing
- **Coverage**: V8 provider with text, JSON, and HTML reports
- **Excluded from coverage**: node_modules, dist, config files, migrations

## Adding New Tests

1. Create test files with the pattern `*.test.ts`
2. Place unit tests in `__tests__` directories next to the code they test
3. Place integration tests in `src/__tests__/integration/`
4. Use descriptive test names that explain what is being tested

## Example Test

```typescript
import { describe, it, expect } from 'vitest'

describe('MyModule', () => {
  it('should do something specific', () => {
    expect(true).toBe(true)
  })
})
```

## Coverage Goals

Aim for:
- 80%+ line coverage
- Focus on critical business logic
- Test edge cases and error conditions
- Integration tests for end-to-end workflows
