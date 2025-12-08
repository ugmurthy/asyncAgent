# DAG Execution Tracking - Implementation Plan

## Overview
Track DAG execution with sub-step results in database tables, enabling status monitoring and execution history.

## Current State Analysis

### Existing Code
- **DAG Route** ([dag.ts:268-313](file:///Users/ugmurthy/riding-amp/asyncAgent/packages/backend/src/app/routes/dag.ts#L268-L313))
  - Creates execution ID with `dag-exec` prefix (line 293)
  - Executes DAG using `dagExecutor.execute(job)` 
  - Returns result but doesn't persist execution details

- **DAGExecutor** ([dagExecutor.ts](file:///Users/ugmurthy/riding-amp/asyncAgent/packages/backend/src/agent/dagExecutor.ts))
  - Executes sub-tasks in dependency order (lines 322-347)
  - Stores results in memory (`taskResults` Map)
  - Tracks execution progress (`executedTasks` Set)
  - Currently no database persistence

### Existing Schema
- `dags` table stores DAG definitions (not executions)
- `runs`/`steps` tables exist for goal-based agent runs
- No tables for DAG execution tracking

---

## Database Schema Design

### 1. `dag_executions` Table
Tracks overall DAG execution status and metadata.

```typescript
export const dagExecutions = sqliteTable('dag_executions', {
  id: text('id').primaryKey(), // dag-exec-{uuid}
  dagId: text('dag_id').references(() => dags.id, { onDelete: 'set null' }),
  
  // Original request info
  originalRequest: text('original_request').notNull(),
  primaryIntent: text('primary_intent').notNull(),
  
  // Execution tracking
  status: text('status', { 
    enum: ['pending', 'running', 'waiting', 'completed', 'failed', 'partial'] 
  }).notNull().default('pending'),
  
  // Timing
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  
  // Execution details
  totalTasks: integer('total_tasks').notNull(),
  completedTasks: integer('completed_tasks').notNull().default(0),
  failedTasks: integer('failed_tasks').notNull().default(0),
  waitingTasks: integer('waiting_tasks').notNull().default(0),
  
  // Results
  finalResult: text('final_result'), // Final synthesized result from DAGExecutor
  synthesisResult: text('synthesis_result'), // Raw synthesis output
  error: text('error'),
  
  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
```

### 2. `sub_steps` Table
Stores individual sub-task execution results.

```typescript
export const subSteps = sqliteTable('sub_steps', {
  id: text('id').primaryKey(), // sub-step-{uuid}
  executionId: text('execution_id').notNull().references(() => dagExecutions.id, { onDelete: 'cascade' }),
  
  // Task identification
  taskId: text('task_id').notNull(), // From DecomposerJob sub_task.id (e.g., "1", "2")
  
  // Task details
  description: text('description').notNull(),
  thought: text('thought').notNull(),
  actionType: text('action_type', { enum: ['tool', 'inference'] }).notNull(),
  
  // Tool/Inference info
  toolOrPromptName: text('tool_or_prompt_name').notNull(),
  toolOrPromptParams: text('tool_or_prompt_params', { mode: 'json' }).$type<Record<string, any>>(),
  
  // Dependencies
  dependencies: text('dependencies', { mode: 'json' }).notNull().$type<string[]>(),
  
  // Execution tracking
  status: text('status', { 
    enum: ['pending', 'running', 'waiting', 'completed', 'failed'] 
  }).notNull().default('pending'),
  
  // Timing
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  
  // Results
  result: text('result', { mode: 'json' }).$type<any>(),
  error: text('error'),
  
  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
```

### 3. Relations

```typescript
export const dagExecutionsRelations = relations(dagExecutions, ({ one, many }) => ({
  dag: one(dags, {
    fields: [dagExecutions.dagId],
    references: [dags.id],
  }),
  subSteps: many(subSteps),
}));

export const subStepsRelations = relations(subSteps, ({ one }) => ({
  execution: one(dagExecutions, {
    fields: [subSteps.executionId],
    references: [dagExecutions.id],
  }),
}));
```

---

## Status Derivation Strategy

### Execution Status Calculation

**Simpler Approach (Recommended):**
Use real-time aggregation from `sub_steps` table when needed:

```typescript
function deriveExecutionStatus(subSteps: SubStep[]): {
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'partial';
  completedTasks: number;
  failedTasks: number;
  waitingTasks: number;
} {
  const completed = subSteps.filter(s => s.status === 'completed').length;
  const failed = subSteps.filter(s => s.status === 'failed').length;
  const running = subSteps.filter(s => s.status === 'running').length;
  const waiting = subSteps.filter(s => s.status === 'waiting').length;
  const total = subSteps.length;

  let status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'partial';
  
  // Priority: waiting > running > completed/failed
  if (waiting > 0) {
    // Any task waiting for human input pauses the execution
    status = 'waiting';
  } else if (failed > 0 && completed + failed === total) {
    // All done but some failed
    status = failed === total ? 'failed' : 'partial';
  } else if (completed === total) {
    status = 'completed';
  } else if (running > 0 || completed > 0) {
    status = 'running';
  } else {
    status = 'pending';
  }

  return { status, completedTasks: completed, failedTasks: failed, waitingTasks: waiting };
}
```

**Alternative Approach (More Performant):**
Update `dag_executions` record after each sub-step completes using database triggers or application-level updates.

---

## Implementation Steps

### Phase 1: Database Schema
1. ✅ Add `dag_executions` table to `schema.ts`
2. ✅ Add `sub_steps` table to `schema.ts`
3. ✅ Add relations
4. ✅ Generate migration: `pnpm --filter backend db:generate`
5. ✅ Push to database: `pnpm --filter backend db:push`

### Phase 2: DAGExecutor Modifications
1. ✅ Add database dependency to `DAGExecutorConfig`
2. ✅ Modify `execute()` method to accept/generate `executionId`
3. ✅ Create `dag_executions` record at start of execution
4. ✅ Create `sub_steps` records for all tasks at initialization
5. ✅ Update `sub_steps` status as tasks execute:
   - Set status to 'running' when task starts
   - Store result and set status to 'completed'/'failed' when task finishes
6. ✅ Update `dag_executions` status and results when complete

### Phase 3: Route Updates
1. ✅ Update `/execute-dag` route to:
   - Generate execution ID
   - Pass database to DAGExecutor
   - Return execution ID in response
2. ✅ Add new routes:
   - `GET /dag-executions/:id` - Get execution details
   - `GET /dag-executions/:id/sub-steps` - Get all sub-steps for execution
   - `GET /dag-executions` - List all executions (with filters)

### Phase 4: Testing
1. ✅ Test DAG execution with persistence
2. ✅ Test status derivation
3. ✅ Test retrieval routes
4. ✅ Test error handling scenarios

---

## Code Changes Required

### 1. Schema Updates
**File:** `packages/backend/src/db/schema.ts`
- Add tables and relations as shown above
- Export new types: `DagExecution`, `SubStep`, etc.

### 2. DAGExecutor Updates
**File:** `packages/backend/src/agent/dagExecutor.ts`

```typescript
export interface DAGExecutorConfig {
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
  db: Database; // ADD THIS
}

async execute(job: DecomposerJob, executionId: string): Promise<string> {
  const startTime = Date.now();
  
  // 1. Create dag_executions record
  await this.config.db.insert(dagExecutions).values({
    id: executionId,
    originalRequest: job.original_request,
    primaryIntent: job.intent.primary,
    status: 'running',
    totalTasks: job.sub_tasks.length,
    startedAt: new Date(),
  });
  
  // 2. Create sub_steps records
  await this.config.db.insert(subSteps).values(
    job.sub_tasks.map(task => ({
      id: generateId('sub-step'),
      executionId,
      taskId: task.id,
      description: task.description,
      // ... other fields
      status: 'pending',
    }))
  );
  
  // 3. Execute DAG (modify executeTask to update sub_steps)
  const finalResult = await this.executeDAG(job, executionId);
  
  // 4. Update dag_executions with final result
  const { status, completedTasks, failedTasks, waitingTasks } = 
    await this.deriveExecutionStatus(executionId);
    
  await this.config.db.update(dagExecutions)
    .set({
      status,
      completedTasks,
      failedTasks,
      waitingTasks,
      finalResult, // Store the final result here
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    })
    .where(eq(dagExecutions.id, executionId));
    
  return finalResult;
}
```

### 3. Route Updates
**File:** `packages/backend/src/app/routes/dag.ts`

```typescript
fastify.post('/execute-dag', async (request, reply) => {
  const job = DecomposerJobSchema.parse(request.body);
  const executionId = generateId('dag-exec');
  
  const dagExecutor = new DAGExecutor({
    logger: log,
    llmProvider,
    toolRegistry,
    db, // Pass database
  });

  const result = await dagExecutor.execute(job, executionId);
  
  return reply.code(200).send({
    status: 'completed',
    executionId,
    result,
  });
});

// New routes
fastify.get('/dag-executions/:id', async (request, reply) => {
  // Fetch execution with sub-steps
});

fastify.get('/dag-executions', async (request, reply) => {
  // List executions with pagination/filters
});
```

---

## Benefits

1. **Full Execution History**: Track all DAG executions over time
2. **Sub-Task Visibility**: See individual task results and timing
3. **Status Monitoring**: Real-time status of ongoing executions including human-in-the-loop scenarios
4. **Debugging**: Easily identify which tasks failed and why
5. **Analytics**: Analyze execution patterns, bottlenecks, and success rates
6. **Resume Capability**: Potential future feature to resume failed or waiting executions
7. **Human-in-the-Loop**: Track tasks waiting for human input with dedicated 'waiting' status
8. **Final Results Storage**: Access complete execution results including synthesis output

---

## Future Enhancements

1. **Retry Logic**: Automatically retry failed sub-steps
2. **Partial Results**: Use completed sub-steps even when some fail
3. **Progress Webhooks**: Notify external systems of execution progress
4. **Execution Graph Visualization**: Generate visual DAG execution flow
5. **Performance Metrics**: Track execution time trends per task type
6. **Human Input Handler**: API endpoints to provide input for waiting tasks and resume execution
7. **Timeout Management**: Auto-fail tasks waiting too long for human input
