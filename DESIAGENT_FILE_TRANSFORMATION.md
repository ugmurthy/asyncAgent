# desiAgent File Transformation Map

This document shows the detailed file-by-file transformation from @async-agent/backend → desiAgent library.

---

## Source Analysis

### Files to Keep (As-Is or Minor Updates)

| Source File | Destination | Changes | Status |
|---|---|---|---|
| `src/db/schema.ts` | `src/db/schema.ts` | None (database agnostic) | ✅ Keep |
| `src/agent/orchestrator.ts` | `src/core/agent/orchestrator.ts` | Remove Fastify context | ✅ Refactor |
| `src/agent/planner.ts` | `src/core/agent/planner.ts` | None (pure logic) | ✅ Keep |
| `src/agent/dagExecutor.ts` | `src/core/agent/dagExecutor.ts` | None (pure logic) | ✅ Keep |
| `src/agent/providers/openai.ts` | `src/core/agent/providers/openai.ts` | Update config handling | ✅ Refactor |
| `src/agent/providers/openrouter.ts` | `src/core/agent/providers/openrouter.ts` | Update config handling | ✅ Refactor |
| `src/agent/providers/ollama.ts` | `src/core/agent/providers/ollama.ts` | Update config handling | ✅ Refactor |
| `src/agent/tools/bash.ts` | `src/core/tools/bash.ts` | Test bun subprocess API | ⚠️ Test |
| `src/agent/tools/readFile.ts` | `src/core/tools/readFile.ts` | Test bun fs API | ⚠️ Test |
| `src/agent/tools/writeFile.ts` | `src/core/tools/writeFile.ts` | Test bun fs API | ⚠️ Test |
| `src/agent/tools/*.ts` (others) | `src/core/tools/*.ts` | Minor import updates | ✅ Keep |
| `src/scheduler/cron.ts` | `src/core/scheduler/cron.ts` | Make start/stop explicit | ✅ Refactor |
| `src/scheduler/dag-scheduler.ts` | `src/core/scheduler/dag-scheduler.ts` | Make start/stop explicit | ✅ Refactor |
| `src/events/bus.ts` | `src/events/bus.ts` | None (event system) | ✅ Keep |
| `src/util/logger.ts` | `src/util/logger.ts` | Test bun compatibility | ⚠️ Test |
| `src/db/client.ts` | `src/db/client.ts` | **Major**: bun sqlite support | 🔴 Critical |

---

## Files to Extract & Create

### Route Handlers → Services

| Source Route | Extracted Service | Methods |
|---|---|---|
| `src/app/routes/goals.ts` | `src/core/execution/goals.ts` | `create()`, `list()`, `get()`, `update()`, `delete()`, `run()`, `pause()`, `resume()` |
| `src/app/routes/agents.ts` | `src/core/execution/agents.ts` | `create()`, `list()`, `get()`, `update()`, `activate()`, `delete()`, `resolve()` |
| `src/app/routes/runs.ts` | `src/core/execution/runs.ts` | `list()`, `get()`, `getSteps()`, `delete()` |
| `src/app/routes/dag/*.ts` | `src/core/execution/dags.ts` | `create()`, `createAndExecute()`, `execute()`, `list()`, `get()`, `update()`, `delete()`, `getExecutions()`, `getSubSteps()`, `resume()`, `streamEvents()` |
| `src/app/routes/tools.ts` | `src/core/execution/tools.ts` | `list()` |
| `src/app/routes/artifacts.ts` | `src/core/execution/artifacts.ts` | `list()`, `get()` |
| `src/app/routes/task.ts` | `src/core/execution/tasks.ts` | `execute()` |

---

## Files to Create (New)

### Configuration & Types
```
src/
├── types/
│   ├── config.ts          # DesiAgentConfig interface
│   ├── client.ts          # DesiAgentClient interface
│   ├── execution.ts       # Goal, Run, DAG types
│   ├── agent.ts           # Agent types
│   └── index.ts           # Export all types
└── errors/
    └── index.ts           # Custom error classes
```

### Main Entry Point
```
src/
└── index.ts               # setupDesiAgent() main export
```

### Utilities
```
src/util/
├── mdx-loader.ts          # Parse .mdx agent definition files
└── env.ts                 # Updated for config (no Fastify)
```

### Services
```
src/core/execution/
├── goals.ts               # Goal service (from goals.ts route)
├── agents.ts              # Agent service (from agents.ts route)
├── dags.ts                # DAG service (from dag/*.ts routes)
├── runs.ts                # Run service (from runs.ts route)
├── tasks.ts               # Task execution (from task.ts route)
├── tools.ts               # Tool service (from tools.ts route)
└── artifacts.ts           # Artifact service (from artifacts.ts route)
```

### Config Files
```
├── bunfig.toml            # Bun-specific configuration
├── package.json           # Updated metadata, exports, scripts
├── tsconfig.json          # ESM, strict mode, bun target
└── vitest.config.ts       # Testing configuration
```

---

## Files to Remove

### HTTP-Specific Code
```
❌ src/app/server.ts
   └─ Entire Fastify setup, plugin registration
   
❌ src/app/routes/*.ts (all HTTP routes)
   ├── goals.ts
   ├── agents.ts
   ├── runs.ts
   ├── dag.ts
   ├── dag/handlers/*.ts
   ├── tools.ts
   ├── artifacts.ts
   └── task.ts

❌ src/app/__tests__/server.test.ts
   └─ Server startup tests
```

---

## Dependency Changes

### Remove (Fastify & HTTP-specific)
```json
{
  "fastify": "^4.25.2",
  "@fastify/cors": "^8.5.0",
  "@fastify/env": "^4.3.0",
  "@fastify/multipart": "^8.3.1",
  "@fastify/rate-limit": "^8.1.1"
}
```

### Keep (Core Library Logic)
```json
{
  "drizzle-orm": "^0.29.2",
  "better-sqlite3": "^12.4.1",
  "openai": "^4.24.1",
  "ollama": "^0.5.0",
  "zod": "^3.22.4",
  "pino": "^8.17.2",
  "nanoid": "^5.0.4",
  "node-cron": "^3.0.3",
  "lodash": "^4.17.21",
  "glob": "^13.0.0",
  "cheerio": "^1.0.0-rc.12",
  "nodemailer": "^6.9.7",
  "pdf-parse": "^2.4.5"
}
```

---

## Transformation Checklist

### Phase 1: Copy & Preserve
- [ ] Copy all database files (schema, client, migrations)
- [ ] Copy all agent files (orchestrator, planner, dagExecutor)
- [ ] Copy all provider files (OpenAI, Ollama, OpenRouter)
- [ ] Copy all tool files
- [ ] Copy scheduler files
- [ ] Copy events/bus

### Phase 2: Extract Services
- [ ] Extract GoalService from goals.ts route
- [ ] Extract AgentService from agents.ts route
- [ ] Extract RunService from runs.ts route
- [ ] Extract DAGService from dag/*.ts routes
- [ ] Extract ToolService from tools.ts route
- [ ] Extract ArtifactService from artifacts.ts route
- [ ] Extract TaskService from task.ts route

### Phase 3: Create New Files
- [ ] Create types/config.ts (DesiAgentConfig)
- [ ] Create types/client.ts (DesiAgentClient interface)
- [ ] Create types/index.ts (all exports)
- [ ] Create errors/index.ts (error classes)
- [ ] Create util/mdx-loader.ts (agent definition parser)
- [ ] Create src/index.ts (setupDesiAgent function)

### Phase 4: Update Configuration
- [ ] Create bunfig.toml
- [ ] Update package.json
- [ ] Update tsconfig.json
- [ ] Create vitest.config.ts

---

## Integration Points

### Backend Will Use desiAgent
```
packages/backend/
├── package.json (adds: "desiagent": "^0.1.0")
├── src/
│   └── app/
│       ├── server.ts (initialize desiAgent client)
│       └── routes/
│           ├── goals.ts (thin HTTP wrapper)
│           ├── agents.ts (thin HTTP wrapper)
│           └── ... (all become wrappers)
```

### Example Integration
```typescript
// packages/backend/src/app/routes/goals.ts (AFTER)
import { DesiAgentClient } from 'desiagent';

export async function goalsRoutes(
  fastify: FastifyInstance,
  desiClient: DesiAgentClient
) {
  fastify.post('/api/v1/goals', async (request, reply) => {
    const goal = await desiClient.goals.create(
      request.body.objective,
      request.body.params
    );
    return reply.send(goal);
  });
}
```

---

## Success Indicators

✅ All source files copied to desiAgent with same functionality
✅ All routes successfully extracted as services
✅ New configuration/types files created
✅ Package builds without errors
✅ All tests pass on bun 1.3.5+
✅ Library can be installed from npm
✅ Backend successfully uses library
✅ No breaking changes to HTTP API
