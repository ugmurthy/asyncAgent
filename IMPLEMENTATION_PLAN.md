# Implementation Plan: Enhanced Context Injection in Task Decomposition

## Overview
This plan outlines how to inject entity intent/grounded_values and dependency results into the `tool_or_prompt.params` for better context awareness in task execution.

## Problem Statement
Currently, inference prompts in sub_tasks lack:
1. **Entity Context**: The intent and grounded_values of relevant entities are not passed to the inference engine
2. **Dependency Output**: Results from completed tasks are not automatically included in downstream task prompts

This leads to:
- Repeated context gathering by inference steps
- Loss of information between dependent tasks
- Less coherent multi-step task execution

## Solution Architecture

### 1. **Entity Context Injection**

#### 1.1 Modify Sub-Task Structure
Add an `entity_context` field to each sub_task:

```json
{
  "id": "2",
  "description": "...",
  "entity_context": [
    {
      "entity_name": "Game Area Dimensions",
      "intent_relevance": "constraint",
      "grounded_value": "10 wide x 20 high",
      "usage_note": "Apply to canvas setup"
    },
    {
      "entity_name": "Required Features",
      "intent_relevance": "partial",
      "grounded_value": "7 shapes, SRS rotation, wall kicks, hard/soft drop, hold, preview (5-6), Nintendo scoring, level progression, pause, game over, input display",
      "usage_note": "Design CSS for these features only"
    }
  ]
}
```

#### 1.2 Prompt Template Enhancement
Modify `tool_or_prompt.params.prompt` to include a section:

```text
## Entity Constraints and Values
[Auto-populated from entity_context]

Given these constraints:
- {entity_name}: {grounded_value} (relevance: {intent_relevance})
...
```

#### 1.3 Implementation Steps
- [ ] Add optional `entity_context` array to sub_task schema
- [ ] Create `buildEntityContext()` function that:
  - Filters entities relevant to current task (via `intent_relevance` field)
  - Extracts `entity.grounded_value` for each
  - Formats as structured text block
- [ ] Create `injectEntityContext()` function that appends entity block to prompt

---

### 2. **Dependency Results Injection**

#### 2.1 Store Execution Results
Create a task execution store to hold outputs:

```typescript
interface TaskExecutionResult {
  task_id: string;
  status: "completed" | "in_progress" | "failed";
  output: string;  // The actual generated content
  metadata?: {
    tokens_used?: number;
    execution_time_ms?: number;
    model?: string;
  };
}

interface ExecutionStore {
  results: Map<string, TaskExecutionResult>;
  getByTaskId(id: string): TaskExecutionResult | null;
  getByDependencyIds(ids: string[]): TaskExecutionResult[];
  store(result: TaskExecutionResult): void;
}
```

#### 2.2 Dependency-Aware Prompt Injection
Modify task execution to:

```typescript
interface EnrichedSubTask extends SubTask {
  dependency_outputs?: {
    task_id: string;
    output: string;
    summary?: string;  // Optional brief summary instead of full output
  }[];
}
```

#### 2.3 Prompt Template Enhancement
Extend `tool_or_prompt.params.prompt` to include:

```text
## Outputs from Dependent Tasks
The following completed tasks provide context for this step:

### Task {id}: {description}
**Output:**
{output}

---
```

#### 2.4 Implementation Steps
- [ ] Create `ExecutionStore` class with methods to save/retrieve task results
- [ ] Add `dependency_outputs` field to enriched sub_task structure
- [ ] Create `buildDependencyContext()` function that:
  - Looks up each dependency_id in ExecutionStore
  - Retrieves the `output` field
  - Optionally summarizes large outputs (if > 2000 chars, use first 1000 + "...")
  - Formats as structured text block
- [ ] Create `injectDependencyContext()` function that appends dependency block to prompt
- [ ] Modify task executor to:
  - Check dependencies before execution
  - Verify all dependencies are completed
  - Call `buildDependencyContext()` before inference
  - Store result in ExecutionStore after completion

---

### 3. **Unified Prompt Assembly Pipeline**

#### 3.1 Prompt Building Sequence
```
Original Prompt
    ↓
[1] Inject Entity Context
    ↓
[2] Inject Dependency Outputs
    ↓
[3] Append Original Prompt
    ↓
Final Enriched Prompt → Inference Engine
```

#### 3.2 Prompt Builder Function
```typescript
function buildEnrichedPrompt(
  task: EnrichedSubTask,
  entities: Entity[],
  executionStore: ExecutionStore
): string {
  let prompt = "";
  
  // Section 1: Entity Context
  if (task.entity_context?.length > 0) {
    const entityBlock = buildEntityContext(task.entity_context);
    prompt += `${entityBlock}\n\n`;
  }
  
  // Section 2: Dependency Results
  if (task.dependencies?.length > 0) {
    const depBlock = buildDependencyContext(
      task.dependencies, 
      executionStore
    );
    prompt += `${depBlock}\n\n`;
  }
  
  // Section 3: Original Task Prompt
  prompt += task.tool_or_prompt.params.prompt;
  
  return prompt;
}
```

---

### 4. **Task Executor Enhancement**

#### 4.1 Update Task Execution Flow
```typescript
async function executeSubTask(
  task: EnrichedSubTask,
  entities: Entity[],
  executionStore: ExecutionStore
): Promise<TaskExecutionResult> {
  // Verify dependencies completed
  const unmetDeps = task.dependencies?.filter(
    id => !executionStore.getByTaskId(id)?.status === "completed"
  ) || [];
  
  if (unmetDeps.length > 0) {
    throw new Error(`Unmet dependencies: ${unmetDeps.join(", ")}`);
  }
  
  // Build enriched prompt
  const enrichedPrompt = buildEnrichedPrompt(task, entities, executionStore);
  
  // Execute inference
  const output = await invokeInference({
    ...task.tool_or_prompt.params,
    prompt: enrichedPrompt
  });
  
  // Store result
  const result: TaskExecutionResult = {
    task_id: task.id,
    status: "completed",
    output: output,
    metadata: {
      execution_time_ms: Date.now() - startTime,
      // Add other metadata
    }
  };
  
  executionStore.store(result);
  return result;
}
```

#### 4.2 Sequential or Parallel Execution
- For tasks with dependencies: execute sequentially
- For independent tasks: execute in parallel (batch by dependency level)

---

### 5. **Configuration & Customization**

#### 5.1 Optional Output Summarization
Add configuration for dependency output handling:

```typescript
interface DependencyConfig {
  include_full_output?: boolean;  // Default: true
  max_output_length?: number;      // Default: 2000, null = unlimited
  summarize_strategy?: "truncate" | "extract_key_sections" | "none";
}
```

#### 5.2 Entity Filtering Strategy
Allow granular control:

```typescript
interface EntityContextConfig {
  include_all?: boolean;           // Default: false
  filter_by_relevance?: "high" | "medium" | "low" | "all";  // Default: all
  include_entity_type?: boolean;   // Default: true
}
```

---

### 6. **Data Flow Diagram**

```
┌─────────────────────────────────────┐
│   Original Task Decomposition       │
│   + Sub-tasks with dependencies     │
│   + Entities with grounded_values   │
└────────────────┬────────────────────┘
                 │
                 ↓
     ┌───────────────────────────┐
     │  Task Executor Queue      │
     │  (respects dependencies)  │
     └───────────┬───────────────┘
                 │
      ┌──────────┴──────────┐
      ↓                     ↓
  ┌───────────┐      ┌──────────────┐
  │ Execution │      │ Execution    │
  │ Store     │      │ Pipeline     │
  └─────┬─────┘      └──┬───────────┘
        │                │
        │        ┌───────┴────────┐
        │        │                │
        │        ↓                ↓
        │   ┌─────────┐    ┌─────────────────┐
        │   │ Inject  │    │ Inject          │
        │   │ Entity  │    │ Dependency      │
        │   │ Context │    │ Outputs         │
        │   └────┬────┘    └────────┬────────┘
        │        └────────┬─────────┘
        │                 ↓
        │          ┌───────────────┐
        │          │ Enriched      │
        │          │ Prompt        │
        │          └────────┬──────┘
        │                   ↓
        │          ┌───────────────┐
        │          │ Inference     │
        │          │ Engine        │
        │          └────────┬──────┘
        │                   ↓
        │          ┌───────────────┐
        │          │ Task Output   │
        │          └────────┬──────┘
        │                   │
        └───────────────────┴──→ Store Result
```

---

### 7. **Implementation Phases**

#### Phase 1: Foundation (Week 1)
- [ ] Define `ExecutionStore` interface and implementation
- [ ] Create `TaskExecutionResult` type
- [ ] Implement `buildEntityContext()` function
- [ ] Add `entity_context` field to task schema

#### Phase 2: Dependency Injection (Week 2)
- [ ] Implement `buildDependencyContext()` function
- [ ] Create `buildEnrichedPrompt()` pipeline
- [ ] Modify task executor to use enriched prompts
- [ ] Add dependency validation logic

#### Phase 3: Configuration & Optimization (Week 3)
- [ ] Add `DependencyConfig` and `EntityContextConfig`
- [ ] Implement optional output summarization
- [ ] Add parallel execution for independent tasks
- [ ] Performance optimization (caching, streaming)

#### Phase 4: Testing & Integration (Week 4)
- [ ] Unit tests for context building functions
- [ ] Integration tests with example decompositions
- [ ] End-to-end task execution with dependencies
- [ ] Documentation and examples

---

### 8. **Example: Enhanced Tetris Task**

**Before:**
```json
{
  "id": "2",
  "description": "Develop CSS styles...",
  "tool_or_prompt": {
    "name": "inference",
    "params": {
      "prompt": "Generate CSS styles to be embedded..."
    }
  },
  "dependencies": ["1"]
}
```

**After (Enriched):**
```json
{
  "id": "2",
  "description": "Develop CSS styles...",
  "entity_context": [
    {
      "entity_name": "Game Area Dimensions",
      "grounded_value": "10 wide x 20 high",
      "intent_relevance": "constraint"
    },
    {
      "entity_name": "Output Format",
      "grounded_value": "Single standalone HTML file, vanilla JS/Canvas only",
      "intent_relevance": "constraint"
    }
  ],
  "tool_or_prompt": {
    "name": "inference",
    "params": {
      "prompt": "Generate CSS styles to be embedded..."
    }
  },
  "dependencies": ["1"]
}
```

**Final Prompt Sent to Inference:**
```
## Entity Constraints and Values
- Game Area Dimensions: 10 wide x 20 high (constraint)
- Output Format: Single standalone HTML file, vanilla JS/Canvas only (constraint)

## Outputs from Dependent Tasks

### Task 1: Generate the complete HTML structure...
**Output:**
<!DOCTYPE html>
<html>
<head>
  <title>Tetris Game</title>
</head>
<body>
  <canvas id="gameCanvas" width="300" height="600"></canvas>
  <!-- ... rest of HTML ... -->
</body>
</html>

---

Generate CSS styles to be embedded in the <style> tag. Style the game board with a subtle grid background...
```

---

### 9. **Key Considerations**

- **Token Efficiency**: Summarize large outputs from dependencies to avoid token bloat
- **Circular Dependencies**: Validate DAG structure before execution
- **Failure Handling**: Clear error messages if dependencies fail
- **Caching**: Cache entity context and dependency outputs if reused
- **Ordering**: Ensure topological sort of task dependencies
- **Versioning**: Store schema version for backward compatibility

---

### 10. **Success Metrics**

- ✅ Entity constraints reflected in all dependent task outputs
- ✅ Dependency outputs seamlessly integrated without prompt engineering
- ✅ Task execution respects dependency ordering
- ✅ Prompt length remains manageable (< 4000 tokens for typical task)
- ✅ All examples pass with enhanced prompts vs. without
