# desiAgent Refactoring Plan - Executive Summary

## What is Being Done?

Converting the `@async-agent/backend` Fastify HTTP server into a **reusable, library-first** npm package called **desiAgent** that:
- ✅ Runs on **bun 1.3.5+** (not Node.js)
- ✅ Exports **40+ API functions** for programmatic use
- ✅ **Removes all HTTP/Fastify dependencies** (pure library)
- ✅ Configurable via **setup function** + environment
- ✅ Loads **agent definitions from .mdx files** (`~/.desiAgent/agents/`)
- ✅ Works as standalone library **or** wrapped by HTTP servers

---

## Core Transformation

### From: HTTP Request → Handler → Logic
```
GET /api/v1/goals/:id  →  Route Handler  →  Query DB  →  JSON Response
```

### To: Function Call → Logic
```
desiClient.goals.get(id)  →  GoalService.get()  →  Query DB  →  Goal Object
```

---

## What Gets Exported?

### Main Entry Point
```typescript
import { setupDesiAgent } from 'desiagent';

const client = await setupDesiAgent({
  llmProvider: 'openai',
  openaiApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4o',
  databasePath: '~/.desiAgent/data/agent.db',
  agentDefinitionsPath: '~/.desiAgent/agents',
});
```

### API Surface (Organized Services)
```typescript
// Goals
client.goals.create(objective, params)
client.goals.list(filter?)
client.goals.get(id)
client.goals.update(id, updates)
client.goals.delete(id)
client.goals.run(id)
client.goals.pause(id)
client.goals.resume(id)

// Agents
client.agents.create(name, version, prompt)
client.agents.list(filter?)
client.agents.get(id)
client.agents.update(id, updates)
client.agents.delete(id)
client.agents.activate(id)
client.agents.resolve(name)

// DAGs
client.dags.create(objective, params)
client.dags.createAndExecute(objective, params)
client.dags.execute(dagId, params)
client.dags.list(filter?)
client.dags.listScheduled()
client.dags.get(id)
client.dags.update(id, updates)
client.dags.delete(id)
client.dags.resume(executionId)

// Executions
client.executions.list(filter?)
client.executions.get(id)
client.executions.getSubSteps(id)
client.executions.delete(id)
client.executions.streamEvents(id)  // AsyncIterable<ExecutionEvent>

// Runs
client.runs.list(filter?)
client.runs.get(id)
client.runs.getSteps(id)
client.runs.delete(id)

// Tools
client.tools.list(filter?)

// Tasks
client.executeTask(agent, task, files?)

// Artifacts
client.artifacts.list()
client.artifacts.get(filename)

// Lifecycle
client.shutdown()
```

---

## File Organization

### Source Files (Reuse from Backend)
```
✅ src/db/schema.ts              → Schema definitions
✅ src/db/client.ts              → Database initialization (update for bun)
✅ src/agent/orchestrator.ts     → Goal/run execution orchestrator
✅ src/agent/planner.ts          → LLM-based agent planning
✅ src/agent/dagExecutor.ts      → DAG decomposition & execution
✅ src/agent/providers/*.ts      → LLM providers (OpenAI, Ollama, etc.)
✅ src/agent/tools/*.ts          → Tool implementations (Bash, Web, File, etc.)
✅ src/scheduler/*.ts            → Cron & DAG schedulers
✅ src/events/bus.ts             → Event system
✅ src/util/logger.ts            → Pino logger
```

### New Files to Create
```
🆕 src/index.ts                  → Main export, setupDesiAgent() function
🆕 src/types/config.ts           → Configuration types (DesiAgentConfig)
🆕 src/types/index.ts            → All type exports
🆕 src/errors/index.ts           → Custom error classes
🆕 src/util/mdx-loader.ts        → Parse .mdx agent definition files
🆕 src/core/execution/goals.ts   → Goal service (extract from route handlers)
🆕 src/core/execution/agents.ts  → Agent service
🆕 src/core/execution/dags.ts    → DAG service
🆕 src/core/execution/runs.ts    → Run service
🆕 bunfig.toml                   → Bun-specific configuration
```

### Files to Remove
```
❌ src/app/server.ts             → Fastify server setup
❌ src/app/routes/*.ts           → HTTP route handlers
❌ All Fastify plugin registrations
❌ HTTP-specific middleware
```

---

## Dependencies: What Stays, What Goes

### Remove (Server-Only)
```json
{
  "fastify": "❌",
  "@fastify/cors": "❌",
  "@fastify/env": "❌",
  "@fastify/multipart": "❌",
  "@fastify/rate-limit": "❌"
}
```

### Keep (Core Logic)
```json
{
  "drizzle-orm": "✅",           // Database ORM
  "better-sqlite3": "✅ (or bun:sqlite)",  // Database driver
  "openai": "✅",                // LLM provider
  "ollama": "✅",                // LLM provider
  "zod": "✅",                   // Validation
  "pino": "✅",                  // Logging
  "node-cron": "✅",             // Scheduling
  "nanoid": "✅",                // ID generation
  "lodash": "✅"                 // Utilities
}
```

---

## Critical Implementation Challenges

### 🔴 HIGH RISK
- **Bun SQLite Compatibility**: `better-sqlite3` is a native C++ module; may not work with bun
  - **Solution**: Investigate bun's built-in `bun:sqlite` support or create abstraction layer
  
- **Tool Subprocess Integration**: BashTool, file operations must adapt to bun subprocess APIs
  - **Solution**: Test each tool with bun; create adapters if needed

- **HTTP Context Removal**: Routes heavily depend on Fastify request/response objects
  - **Solution**: Automated refactoring; extensive testing of extracted services

### 🟡 MEDIUM RISK
- **Agent Definition Format (.mdx)**: Need clear schema for agent configs stored as markdown files
  - **Solution**: Define Zod schema, provide examples, validate on load

- **Circular Dependencies**: Complex service dependencies could cause module load failures
  - **Solution**: Use dependency injection; careful design of import order

### 🟢 LOW RISK
- Logger, validation, event bus: Already decoupled from HTTP; minimal changes needed

---

## Implementation Phases (Estimated 54 Hours)

| Phase | Tasks | Time | Risk |
|-------|-------|------|------|
| **1. Setup & Config** | Create bun package structure, types | 2h | Low |
| **2. Service Extraction** | Extract goals, agents, DAGs, runs services | 16h | High |
| **3. Tool Refactoring** | Adapt tools to bun/non-HTTP context | 8h | High |
| **4. Database Layer** | bun sqlite adapter, migrations | 6h | High |
| **5. Testing** | Unit + integration tests (80%+ coverage) | 12h | Medium |
| **6. Agent Loader** | Parse .mdx agent definition files | 4h | Medium |
| **7. Documentation** | README, API docs, examples | 6h | Low |

---

## How Will It Be Used?

### Pattern 1: Standalone Library (Primary Use Case)
```typescript
// app.ts or script.ts
import { setupDesiAgent } from 'desiagent';

const client = await setupDesiAgent(config);

// Direct function calls
const goal = await client.goals.create('Analyze this document', { ... });
const execution = await client.dags.execute(dagId);
const events = client.executions.streamEvents(execution.id);

for await (const event of events) {
  console.log('Event:', event);
}

await client.shutdown();
```

### Pattern 2: HTTP API Wrapper (for Backend)
```typescript
// packages/backend/src/routes/goals.ts
import { FastifyInstance } from 'fastify';
import type { DesiAgentClient } from 'desiagent';

export function goalRoutes(fastify: FastifyInstance, desiClient: DesiAgentClient) {
  fastify.post('/api/v1/goals', async (request, reply) => {
    const goal = await desiClient.goals.create(
      request.body.objective,
      request.body.params
    );
    return reply.send(goal);
  });
  
  // Thin wrapper around library function
}
```

### Pattern 3: CLI Tool
```typescript
#!/usr/bin/env bun
import { setupDesiAgent } from 'desiagent';

const client = await setupDesiAgent(config);
const goal = await client.goals.create(process.argv[2]);
console.log('Created goal:', goal.id);
```

---

## Configuration Example

```typescript
interface DesiAgentConfig {
  // Database location (auto-created)
  databasePath?: string;  // Default: ~/.desiAgent/data/agent.db
  
  // LLM Provider setup
  llmProvider: 'openai' | 'openrouter' | 'ollama';
  openaiApiKey?: string;
  openrouterApiKey?: string;
  ollamaBaseUrl?: string;
  modelName: string;  // e.g., 'gpt-4o', 'mistral'
  
  // Agent definitions location
  agentDefinitionsPath?: string;  // Default: ~/.desiAgent/agents
  
  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Optional event handlers
  onExecutionStart?: (executionId: string) => void;
  onExecutionEnd?: (executionId: string, result: any) => void;
}
```

---

## Agent Definition Format (.mdx)

```mdx
---
name: "DataAnalyzer"
version: "1.0.0"
description: "Analyzes CSV and JSON data"
provider: "openai"
model: "gpt-4o"
tags: ["data", "analysis"]
---

# Data Analysis Agent

This agent specializes in analyzing structured data files.

## Capabilities
- Parse CSV files
- Analyze JSON structures
- Generate summaries
- Create visualizations

## Example Usage
\`\`\`
objective: "Analyze sales_data.csv and identify trends"
params:
  filePath: "./data/sales_data.csv"
  outputFormat: "markdown"
\`\`\`
```

---

## Key Design Decisions

| Decision | Recommendation | Rationale |
|----------|---|---|
| **Bun vs Node.js** | Pure bun, but may need Node fallback | Performance, modern runtime |
| **Database** | Try bun:sqlite first, fallback to better-sqlite3 | Native, no C++ compilation |
| **New Repository** | Create separate `desiAgent` repo | Easier to publish to npm, decoupled lifecycle |
| **Package Name** | `desiagent` (unscoped) or `@desiagent/core` | Short, memorable; align with naming |
| **Scheduler Export** | Expose as optional, configurable service | Users can disable for testing/CLI |
| **Tools** | All core tools in main library; plugins optional | Full feature parity with backend |

---

## Success Metrics

✅ Library builds and runs on bun 1.3.5+
✅ All 40+ APIs exported and documented
✅ 80%+ test coverage on core logic
✅ Can be `import { setupDesiAgent } from 'desiagent'`
✅ Configuration via `DesiAgentConfig` object
✅ Agent definitions loadable from `.desiAgent/agents/*.mdx`
✅ Published to npm registry
✅ Backward compatible (existing backend wraps library)
✅ Complete documentation + examples
✅ Zero breaking changes to data contracts

---

## Next Actions

1. ✅ **Review & Approve Plan** - Validate approach with team
2. ⏳ **Create New Repository** - `desiAgent` separate from monorepo
3. ⏳ **Phase 1: Setup** - Package structure, types, config
4. ⏳ **Phase 2: Extract Services** - Goals, Agents, DAGs, Runs
5. ⏳ **Phase 3: Bun Compatibility** - Test tools, database layer
6. ⏳ **Phase 4-5: Testing & Docs** - Coverage, examples, API reference
7. ⏳ **Phase 6: Publish** - npm registry release
8. ⏳ **Phase 7: Backend Integration** - Refactor backend to use library

---

## Questions to Clarify Before Starting

1. **Repository Strategy**: Should desiAgent live in this monorepo as a package, or separate repo?
2. **Bun Commitment**: Is bun 1.3.5+ a hard requirement, or "nice to have"?
3. **Backward Compatibility**: Can backend break HTTP API or must it maintain current signatures?
4. **Scheduler Default**: Should schedulers auto-start or require explicit `.start()` call?
5. **Agent Schema**: Finalize .mdx frontmatter properties required for agents?
6. **Priority**: Which of the 40+ APIs are most critical to implement first?
