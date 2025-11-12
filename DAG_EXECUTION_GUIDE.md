# DAG Execution Route Documentation

## Overview

The POST `/api/v1/execute-dag` route processes decomposer agent output by executing sub-tasks as a directed acyclic graph (DAG), then synthesizing results using LLM inference.

## Implementation

### Files Created

1. **`packages/backend/src/agent/dagExecutor.ts`**
   - Core DAG execution logic
   - Handles task dependencies and parallel execution
   - Integrates with LLM for synthesis step
   - Pass-through validation function

2. **`packages/backend/src/app/routes/dag.ts`**
   - POST `/execute-dag` route handler
   - Input validation using Zod schemas
   - Error handling and response formatting

3. **`packages/backend/src/app/server.ts`** (modified)
   - Registered the new DAG routes

## API Endpoint

### POST `/api/v1/execute-dag`

Executes a decomposer job containing a DAG of sub-tasks.

#### Request Body

```json
{
  "original_request": "string",
  "intent": {
    "primary": "string",
    "sub_intents": ["string"]
  },
  "entities": [
    {
      "entity": "string",
      "type": "string",
      "grounded_value": "string"
    }
  ],
  "sub_tasks": [
    {
      "id": "string",
      "description": "string",
      "thought": "string",
      "action_type": "tool" | "inference",
      "tool_or_prompt": {
        "name": "string",
        "params": {}
      },
      "expected_output": "string",
      "dependencies": ["string"]
    }
  ],
  "synthesis_plan": "string",
  "validation": {
    "coverage": "string",
    "gaps": ["string"],
    "iteration_triggers": ["string"]
  },
  "clarification_needed": boolean,
  "clarification_query": "string"
}
```

#### Response (Clarification Needed)

```json
{
  "status": "clarification_required",
  "clarification_query": "string",
  "job": { /* original job */ }
}
```

#### Response (Success)

```json
{
  "status": "completed",
  "executionId": "string",
  "result": "string (markdown)",
  "originalRequest": "string",
  "tasksExecuted": number
}
```

#### Response (Error)

```json
{
  "status": "failed",
  "error": "string"
}
```

## How It Works

### 1. Task Dependency Resolution

The DAG executor analyzes task dependencies and executes them in the correct order:

- Tasks with no dependencies or `dependencies: ["none"]` run first
- Tasks wait for their dependencies to complete
- Tasks with satisfied dependencies run in parallel
- Deadlock detection prevents infinite loops

### 2. Task Execution

Two types of tasks are supported:

#### Tool Tasks (`action_type: "tool"`)
```json
{
  "action_type": "tool",
  "tool_or_prompt": {
    "name": "webSearch",
    "params": {
      "query": "search terms"
    }
  }
}
```

- Executes using the tool registry
- Validates input against tool schema
- Returns tool execution result

#### Inference Tasks (`action_type: "inference"`)
```json
{
  "action_type": "inference",
  "tool_or_prompt": {
    "name": "inference",
    "params": {
      "prompt": "Analyze the data and provide insights"
    }
  }
}
```

- Uses LLM to process information
- Receives context from dependent tasks
- Returns LLM-generated content

### 3. Result Substitution

Tasks can reference results from previous tasks:

```json
{
  "tool_or_prompt": {
    "params": {
      "content": "<Result from Task 4>"
    }
  }
}
```

The executor automatically substitutes these placeholders with actual results.

### 4. Synthesis

After all tasks complete, the synthesis step:

1. Collects all task results
2. Applies the `synthesis_plan` instructions
3. Uses LLM to generate final markdown output
4. Returns formatted report

### 5. Validation

Currently a pass-through function that returns the synthesis output unchanged. Can be extended for:
- Output format validation
- Content quality checks
- Requirement coverage verification

## Example Usage

### Using the Test Script

```bash
# Make sure backend is running
pnpm --filter backend start

# In another terminal
./test-dag-route.sh
```

### Using curl

```bash
curl -X POST http://localhost:3000/api/v1/execute-dag \
  -H "Content-Type: application/json" \
  -d @res.json
```

### Using the example (res.json)

The example job will:
1. Search for announcements about Claude Code and AmpCode
2. Search for Claude Code reviews and features
3. Search for AmpCode reviews and features
4. Synthesize results into a markdown report
5. Save the report to `coding_agent.report.md`

## Integration with Decomposer Agent

To use this with a decomposer agent:

1. Create a decomposer agent that outputs jobs in the expected format
2. POST the decomposer output to `/execute-dag`
3. Retrieve the final report from the response

Example workflow:
```
User Request → Decomposer Agent → DAG Executor → Final Report
```

## Error Handling

The executor handles several error scenarios:

- **Invalid input**: Returns 400 with validation errors
- **Missing tools**: Returns 500 with error message
- **Tool execution failure**: Logs error and continues (can be customized)
- **DAG deadlock**: Returns 500 with remaining task info
- **LLM errors**: Returns 500 with error details

## Future Enhancements

1. **Validation Logic**: Implement actual validation rules
2. **Retry Logic**: Add retry mechanism for failed tasks
3. **Partial Results**: Return partial results on failure
4. **Progress Tracking**: WebSocket updates for long-running jobs
5. **Result Caching**: Cache task results for reuse
6. **Execution History**: Store DAG executions in database
7. **Visualization**: Generate DAG visualization
8. **Conditional Tasks**: Support conditional task execution
9. **Loop Detection**: Enhanced cycle detection
10. **Resource Limits**: Task timeout and resource constraints
