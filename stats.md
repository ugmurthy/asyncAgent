# LLM Inference Cost Tracking Plan

## Overview

Capture LLM inference costs (tokens and USD) at three granularities:
1. **Planning level** - aggregate costs for DAG creation (including all retry attempts + TitleMaster)
2. **Execution level** - aggregate costs for each DAG execution
3. **Sub-step level** - individual costs for inference tasks within DAG executions (including synthesis)

---

## Current State Analysis

### What's Already Tracked
- `dags.usage` - JSON column storing `{ promptTokens, completionTokens, totalTokens }` from **last successful** DAG creation attempt only
- `dags.generationStats` - JSON column storing OpenRouter-specific stats including `total_cost` (last attempt only)
- `OpenRouterFetchProvider.extractGenerationId()` fetches `total_cost`, `latency`, `generation_time` from OpenRouter `/generation` endpoint
- `LlmExecuteTool` returns usage structure but currently sets all values to `undefined`

### Gaps Identified
1. **Planning retry costs lost** - only last attempt stored; failed attempts (up to maxAttempts=3) not tracked
2. **TitleMaster costs not aggregated** - captured in memory but not included in planning totals
3. **`subSteps` table lacks usage/cost columns** - inference tasks don't persist their costs
4. **`dagExecutions` lacks aggregate cost tracking** - no rollup of execution-level costs
5. **Synthesis not tracked as sub-step** - costs captured but not persisted or aggregated
6. **`LlmExecuteTool` doesn't extract usage** from provider response
7. **OpenAI provider ignores usage** in `chat()` response
8. **No DAG-level cost endpoint** - can't query total cost (planning + all executions) for a DAG

---

## Implementation Plan

### Phase 1: Schema Changes

**File:** `packages/backend/src/db/schema.ts`

```typescript
// === ADD TO dags TABLE (planning costs with retry tracking) ===

// Aggregate planning cost/usage over ALL attempts + TitleMaster
planningTotalUsage: text('planning_total_usage', { mode: 'json' }).$type<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}>(),
planningTotalCostUsd: text('planning_total_cost_usd'),

// Per-attempt details for debugging/audit (including failed attempts)
planningAttempts: text('planning_attempts', { mode: 'json' }).$type<Array<{
  attempt: number;
  reason: 'initial' | 'retry_gaps' | 'retry_parse_error' | 'retry_validation' | 'title_master';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  costUsd?: number | null;
  errorMessage?: string;  // for failed attempts
  generationStats?: Record<string, any>;
}>>(),

// === ADD TO subSteps TABLE ===
usage: text('usage', { mode: 'json' }).$type<{
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}>(),
costUsd: text('cost_usd'),  // Store as string for precision
generationStats: text('generation_stats', { mode: 'json' }).$type<Record<string, any>>(),

// === ADD TO dagExecutions TABLE ===
totalUsage: text('total_usage', { mode: 'json' }).$type<{
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}>(),
totalCostUsd: text('total_cost_usd'),
```

**Note on existing columns:**
- `dags.usage` and `dags.generationStats` remain as **last attempt only** (for backward compatibility)
- `dags.planningTotal*` = **full planning sum** (use this for billing/analysis)

**Migration:** Run `pnpm --filter backend db:push` (directly applies schema changes to SQLite)

---

### Phase 2: Standardize Provider Response

**File:** `packages/shared/src/types/provider.ts`

Ensure `LLMResponse` interface includes:
```typescript
interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  costUsd?: number;  // OpenRouter provides this; estimate for others
  generationStats?: Record<string, any>;
}
```

**Files to update:**
- `packages/backend/src/agent/providers/openai.ts` - Extract usage from OpenAI response
- `packages/backend/src/agent/providers/openrouter-fetch.ts` - Already has `extractUsage()`, ensure it's returned
- `packages/backend/src/agent/providers/ollama.ts` - Extract if available

---

### Phase 3: Cost Retrieval Strategy

**Primary approach:** Use OpenRouter's `total_cost` from generation endpoint (already implemented in `extractGenerationId`).

**For OpenRouter:** Each LLM call returns a generation ID → poll `/generation?id=` → extract `total_cost` (actual USD spent).

**For other providers (OpenAI, Ollama):** Two options:

1. **Fetch pricing from OpenRouter API** (recommended for OpenAI models routed via OpenRouter):
   ```typescript
   // GET https://openrouter.ai/api/v1/models
   // Returns pricing.prompt and pricing.completion per model
   ```

2. **For direct OpenAI/Ollama:** Optionally fetch from `https://openrouter.ai/api/v1/models` and cache locally, or leave cost as `null` (tokens still tracked).

**New file:** `packages/backend/src/utils/pricing-cache.ts`

```typescript
interface ModelPricing {
  prompt: number;      // USD per token
  completion: number;  // USD per token
}

let pricingCache: Map<string, ModelPricing> | null = null;

export async function fetchPricing(): Promise<Map<string, ModelPricing>> {
  if (pricingCache) return pricingCache;
  
  const res = await fetch('https://openrouter.ai/api/v1/models');
  const { data } = await res.json();
  
  pricingCache = new Map();
  for (const model of data) {
    pricingCache.set(model.id, {
      prompt: parseFloat(model.pricing?.prompt ?? '0'),
      completion: parseFloat(model.pricing?.completion ?? '0'),
    });
  }
  return pricingCache;
}

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  pricing: Map<string, ModelPricing>
): number | null {
  const p = pricing.get(model);
  if (!p) return null;
  return promptTokens * p.prompt + completionTokens * p.completion;
}
```

**Note:** For OpenRouter calls, prefer the actual `total_cost` from generation stats over calculated estimates.

---

### Phase 4: Update LlmExecuteTool

**File:** `packages/backend/src/agent/tools/llmExecute.ts`

```typescript
// Line 187-205: Extract and return actual usage
const response = await provider.chat({ ... });

return {
  content: response.content,
  usage: response.usage,  // Pass through from provider
  costUsd: response.costUsd ?? calculateCost(
    input.model,
    response.usage?.promptTokens ?? 0,
    response.usage?.completionTokens ?? 0
  ),
};
```

---

### Phase 5: Update DAGExecutor

**File:** `packages/backend/src/agent/dagExecutor.ts`

#### 5a. Track per-task inference costs

In `executeTask()` (around line 250-350), after running inference:
```typescript
if (task.action_type === 'inference') {
  const result = await llmExecuteTool.execute(...);
  
  // Persist usage to sub_step
  await this.config.db.update(subSteps)
    .set({
      result: result.content,
      usage: result.usage,
      costUsd: result.costUsd?.toString(),
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(subSteps.id, subStepId));
}
```

#### 5b. Track synthesis as a sub-step

In `synthesize()` (line 776-810), create a synthesis sub-step record:
```typescript
const response = await llmProvider.chat({ ... });

// Create synthesis sub-step for cost tracking
const synthesisSubStepId = generateId();
await this.config.db.insert(subSteps).values({
  id: synthesisSubStepId,
  executionId,
  taskId: '__SYNTHESIS__',
  description: 'Final synthesis of all task results',
  thought: 'Aggregating results into final output',
  actionType: 'inference',
  toolOrPromptName: '__synthesis__',  // Reserved name for synthesis
  toolOrPromptParams: { taskCount: completedTasks.length },
  dependencies: completedTasks.map(t => t.task_id),
  status: 'completed',
  startedAt: new Date(),
  completedAt: new Date(),
  usage: response.usage,
  costUsd: response.costUsd?.toString() ?? response.generation_stats?.data?.total_cost?.toString(),
  generationStats: response.generation_stats?.data,
  result: response.content,
});

// Return both content and usage
return {
  content: response.content,
  usage: response.usage,
  costUsd: response.costUsd,
};
```

**Why as a sub-step?**
- Synthesis costs are automatically included in execution aggregation (Phase 5c)
- Consistent breakdown - can filter by `toolOrPromptName='__synthesis__'` in API responses
- No extra columns needed on `dagExecutions` for synthesis-specific costs

#### 5c. Aggregate costs at execution completion

After all tasks complete, sum up costs:
```typescript
const allSubSteps = await db.query.subSteps.findMany({
  where: eq(subSteps.executionId, executionId),
});

const totalUsage = allSubSteps.reduce((acc, step) => ({
  promptTokens: acc.promptTokens + (step.usage?.promptTokens ?? 0),
  completionTokens: acc.completionTokens + (step.usage?.completionTokens ?? 0),
  totalTokens: acc.totalTokens + (step.usage?.totalTokens ?? 0),
}), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });

const totalCostUsd = allSubSteps.reduce(
  (sum, step) => sum + parseFloat(step.costUsd ?? '0'), 
  0
);

await db.update(dagExecutions).set({
  totalUsage,
  totalCostUsd: totalCostUsd.toString(),
}).where(eq(dagExecutions.id, executionId));
```

---

### Phase 6: Update DAG Routes - Planning Cost Tracking

**File:** `packages/backend/src/app/routes/dag.ts`

#### 6a. Track ALL planning attempts (including retries)

Before the retry loop, initialize accumulators:
```typescript
// Initialize planning cost tracking
const planningAttempts: Array<{
  attempt: number;
  reason: 'initial' | 'retry_gaps' | 'retry_parse_error' | 'retry_validation' | 'title_master';
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  costUsd?: number | null;
  errorMessage?: string;
  generationStats?: Record<string, any>;
}> = [];

let planningUsageTotal = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
let planningCostTotal = 0;
```

On **each LLM call** during planning (successful OR failed):
```typescript
const response = await activeLLMProvider.chat({...});

// Track this attempt regardless of parse/validation outcome
const attemptUsage = response?.usage;
const attemptCost = response?.generation_stats?.data?.total_cost ?? null;
const attemptReason = attempt === 1 ? 'initial' : 
  (parseError ? 'retry_parse_error' : 
   (validationError ? 'retry_validation' : 'retry_gaps'));

planningAttempts.push({
  attempt,
  reason: attemptReason,
  usage: attemptUsage,
  costUsd: attemptCost,
  errorMessage: parseError?.message || validationError?.message,
  generationStats: response?.generation_stats?.data,
});

// Accumulate totals
if (attemptUsage) {
  planningUsageTotal.promptTokens += attemptUsage.promptTokens ?? 0;
  planningUsageTotal.completionTokens += attemptUsage.completionTokens ?? 0;
  planningUsageTotal.totalTokens += attemptUsage.totalTokens ?? 0;
}
if (attemptCost != null) {
  planningCostTotal += attemptCost;
}
```

#### 6b. Track TitleMaster costs as part of planning

```typescript
if (titleMasterAgent) {
  const llmResult = await llmExecuteTool.execute(...);
  dagTitle = llmResult.content;

  // Add TitleMaster to planning aggregates
  planningAttempts.push({
    attempt,
    reason: 'title_master',
    usage: llmResult.usage,
    costUsd: llmResult.costUsd,
  });

  if (llmResult.usage) {
    planningUsageTotal.promptTokens += llmResult.usage.promptTokens ?? 0;
    planningUsageTotal.completionTokens += llmResult.usage.completionTokens ?? 0;
    planningUsageTotal.totalTokens += llmResult.usage.totalTokens ?? 0;
  }
  if (llmResult.costUsd != null) {
    planningCostTotal += llmResult.costUsd;
  }
}
```

#### 6c. Persist planning costs when saving DAG

```typescript
await db.insert(dags).values({
  // existing fields...
  usage,                     // last attempt only (backward compat)
  generationStats: generation_stats,
  attempts: attempt,
  
  // NEW: full planning costs
  planningTotalUsage: planningUsageTotal,
  planningTotalCostUsd: planningCostTotal.toString(),
  planningAttempts,
  
  // ...other fields
});
```

---

### Phase 7: API Endpoints for Cost Queries

**File:** `packages/backend/src/app/routes/dag.ts`

#### 7a. Execution-level costs with full breakdown

```typescript
// GET /api/v1/dag-executions/:id/costs
fastify.get('/dag-executions/:id/costs', async (request, reply) => {
  const { id } = request.params;
  
  const execution = await db.query.dagExecutions.findFirst({
    where: eq(dagExecutions.id, id),
  });
  if (!execution) return reply.code(404).send({ error: 'Not found' });
  
  // Get planning costs from parent DAG
  const dag = execution.dagId 
    ? await db.query.dags.findFirst({ where: eq(dags.id, execution.dagId) })
    : null;
  
  // Get all sub-steps including synthesis
  const allSubSteps = await db.query.subSteps.findMany({
    where: eq(subSteps.executionId, id),
  });
  
  // Separate synthesis from regular steps
  const synthesisStep = allSubSteps.find(s => s.toolOrPromptName === '__synthesis__');
  const taskSteps = allSubSteps.filter(s => s.toolOrPromptName !== '__synthesis__');
  
  return reply.send({
    dagId: execution.dagId,
    executionId: id,
    planning: dag ? {
      totalUsage: dag.planningTotalUsage,
      totalCostUsd: dag.planningTotalCostUsd,
      attempts: dag.planningAttempts,
    } : null,
    execution: {
      totalUsage: execution.totalUsage,
      totalCostUsd: execution.totalCostUsd,
      subSteps: taskSteps.map(s => ({
        id: s.id,
        taskId: s.taskId,
        actionType: s.actionType,
        toolOrPromptName: s.toolOrPromptName,
        usage: s.usage,
        costUsd: s.costUsd,
      })),
      synthesis: synthesisStep ? {
        usage: synthesisStep.usage,
        costUsd: synthesisStep.costUsd,
      } : null,
    },
    totals: {
      planningCostUsd: dag?.planningTotalCostUsd ?? '0',
      executionCostUsd: execution.totalCostUsd ?? '0',
      grandTotalCostUsd: (
        parseFloat(dag?.planningTotalCostUsd ?? '0') + 
        parseFloat(execution.totalCostUsd ?? '0')
      ).toString(),
    },
  });
});
```

#### 7b. DAG-level costs (planning + all executions)

```typescript
// GET /api/v1/dags/:id/costs
fastify.get('/dags/:id/costs', async (request, reply) => {
  const { id } = request.params;
  
  const dag = await db.query.dags.findFirst({
    where: eq(dags.id, id),
  });
  if (!dag) return reply.code(404).send({ error: 'Not found' });
  
  const executions = await db.query.dagExecutions.findMany({
    where: eq(dagExecutions.dagId, id),
  });
  
  const executionTotalCost = executions.reduce(
    (sum, e) => sum + parseFloat(e.totalCostUsd ?? '0'), 
    0
  );
  
  return reply.send({
    dagId: id,
    planning: {
      totalUsage: dag.planningTotalUsage,
      totalCostUsd: dag.planningTotalCostUsd,
      attempts: dag.planningAttempts,
    },
    executions: executions.map(e => ({
      executionId: e.id,
      status: e.status,
      totalCostUsd: e.totalCostUsd,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
    })),
    totals: {
      planningCostUsd: dag.planningTotalCostUsd ?? '0',
      executionsCostUsd: executionTotalCost.toString(),
      grandTotalCostUsd: (
        parseFloat(dag.planningTotalCostUsd ?? '0') + executionTotalCost
      ).toString(),
    },
  });
});
```

#### 7c. Cost summary endpoint

```typescript
// GET /api/v1/costs/summary?from=...&to=...&groupBy=day
fastify.get('/costs/summary', async (request, reply) => {
  const { from, to, groupBy = 'day' } = request.query;
  
  // For now, implement groupBy=day only
  // Query dags for planning costs, dagExecutions for execution costs
  // Aggregate by date
  
  return reply.send([
    {
      date: '2025-01-01',
      planningCostUsd: '1.23',
      executionCostUsd: '4.56',
      totalCostUsd: '5.79',
    },
    // ...
  ]);
});
```

---

## Data Flow Diagram

```
API Request (create-dag / execute-dag)
    │
    ▼
┌─────────────────────────────────────────┐
│  Route Handler                          │
│  - Calls LLM for DAG creation           │
│  - Stores usage in `dags.usage`         │
│  - Stores cost in `dags.generationStats`│
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  DAGExecutor.execute()                  │
│  - For each inference sub-task:         │
│    - Call LlmExecuteTool                │
│    - Store usage/cost in `sub_steps`    │
│  - For synthesis:                       │
│    - Track synthesis usage/cost         │
│  - On completion:                       │
│    - Aggregate to `dag_executions`      │
└─────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Schema migration runs cleanly (`pnpm --filter backend db:push`)
- [ ] OpenRouter provider returns `total_cost` from generation endpoint
- [ ] OpenAI provider extracts usage from response
- [ ] LlmExecuteTool returns populated usage
- [ ] Planning retry costs captured (test with intentionally malformed prompts)
- [ ] TitleMaster costs included in `planningTotalCostUsd`
- [ ] `planningAttempts` array contains all attempts with reasons
- [ ] Sub-step records contain usage/cost after inference tasks
- [ ] Synthesis creates sub-step with `toolOrPromptName='__synthesis__'`
- [ ] DAG execution aggregates costs on completion
- [ ] `GET /dag-executions/:id/costs` returns planning + execution breakdown
- [ ] `GET /dags/:id/costs` returns costs across all executions
- [ ] `execution.totalCostUsd == sum(subSteps.costUsd)` (including synthesis)
- [ ] Cost calculator produces reasonable estimates for non-OpenRouter providers

---

## Key Improvements Over Original Plan

| Issue | Original Plan | Improved Plan |
|-------|--------------|---------------|
| Retry costs | Only stored last attempt | All attempts tracked in `planningAttempts` array |
| TitleMaster | Captured but not aggregated | Included in `planningTotalCostUsd` |
| Synthesis | Not persisted | Created as sub-step with reserved name |
| DAG-level costs | No endpoint | New `GET /dags/:id/costs` endpoint |
| Cost breakdown | Flat structure | Hierarchical: planning → execution → sub-steps → synthesis |

---

## Future Enhancements

1. **Cost budgets/limits** - Alert or stop when execution exceeds threshold
2. **Cost dashboard** - WebApp visualization of spending trends
3. **Provider cost comparison** - Track same prompts across providers
4. **Caching** - Track cost savings from cached responses
5. **`cost_events` table** - For advanced audit/analytics (when needed):
   - Every LLM call as a row with `route`, `phase`, `dagId`, `executionId`, `subStepId`
   - Enables cross-cutting queries by model, agent, tool, phase
   - Tracks costs for failed route calls (where no DAG row exists)
