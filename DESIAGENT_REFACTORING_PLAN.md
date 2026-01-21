# desiAgent Library - Refactoring Plan

## Executive Summary

Refactor the @async-agent/backend Fastify-based API server into a standalone, **bun-compatible** library called **desiAgent**. This library will expose all business logic and core functionality as importable functions/classes while removing HTTP/Fastify dependencies. The library will use bun 1.3.5+, support configuration via setup functions, and look for agent definitions in `.desiAgent/agents` folder as `.mdx` files.

---

## Phase 1: Inventory & Analysis

### 1.1 Current Route Map (API → Library Functions)

| **HTTP Route** | **Method** | **Handler Logic** | **Target Library Function** | **Priority** |
|---|---|---|---|---|
| `/api/v1/goals` | POST | Create goal + schedule | `createGoal(objective, params)` | P0 |
| `/api/v1/goals` | GET | List goals by status | `listGoals(filter?)` | P0 |
| `/api/v1/goals/:id` | GET | Get goal with schedules | `getGoal(id)` | P0 |
| `/api/v1/goals/:id` | PATCH | Update goal | `updateGoal(id, updates)` | P0 |
| `/api/v1/goals/:id` | DELETE | Delete goal cascade | `deleteGoal(id)` | P0 |
| `/api/v1/goals/:id/run` | POST | Trigger goal execution | `runGoal(id)` | P0 |
| `/api/v1/goals/:id/pause` | POST | Pause goal & schedules | `pauseGoal(id)` | P1 |
| `/api/v1/goals/:id/resume` | POST | Resume paused goal | `resumeGoal(id)` | P1 |
|||
|||
| `/api/v1/agents` | POST | Create agent | `createAgent(name, version, prompt)` | P0 |
| `/api/v1/agents` | GET | List agents | `listAgents(filter?)` | P0 |
| `/api/v1/agents/:id` | GET | Get agent details | `getAgent(id)` | P0 |
| `/api/v1/agents/:id` | PATCH | Update agent | `updateAgent(id, updates)` | P0 |
| `/api/v1/agents/:id` | DELETE | Delete agent | `deleteAgent(id)` | P0 |
| `/api/v1/agents/:id/activate` | POST | Activate agent version | `activateAgent(id)` | P1 |
| `/api/v1/agents/resolve/:name` | GET | Get active agent by name | `resolveAgent(name)` | P0 |
| `/api/v1/dags` | GET | List DAGs | `listDAGs(filter?)` | P0 |
| `/api/v1/dags/scheduled` | GET | List scheduled DAGs | `listScheduledDAGs()` | P1 |
| `/api/v1/dags/:id` | GET | Get DAG details | `getDAG(id)` | P0 |
| `/api/v1/dags/:id` | PATCH | Update DAG | `updateDAG(id, updates)` | P0 |
| `/api/v1/dags/:id` | DELETE | Delete DAG | `deleteDAG(id)` | P0 |
| `/api/v1/create-dag` | POST | Create DAG from text | `createDAGFromText(objective, params)` | P0 |
| `/api/v1/execute-dag` | POST | Execute existing DAG | `executeDAG(dagId, params)` | P0 |
| `/api/v1/create-and-execute-dag` | POST | Create + execute DAG | `createAndExecuteDAG(objective, params)` | P0 |
| `/api/v1/resume-dag/:executionId` | POST | Resume suspended DAG | `resumeDAGExecution(executionId)` | P1 |
| `/api/v1/dag-run` | POST | Run DAG by ID | `runDAG(dagId)` | P1 |
| `/api/v1/dag-experiments` | POST | Run DAG experiments | `runDAGExperiments(dagId, configs)` | P2 |
| `/api/v1/dag-executions` | GET | List DAG executions | `listDAGExecutions(filter?)` | P0 |
| `/api/v1/dag-executions/:id` | GET | Get execution with sub-steps | `getDAGExecution(id)` | P0 |
| `/api/v1/dag-executions/:id` | DELETE | Delete execution | `deleteDAGExecution(id)` | P1 |
| `/api/v1/dag-executions/:id/sub-steps` | GET | Get sub-steps | `getDAGExecutionSubSteps(id)` | P1 |
| `/api/v1/dag-executions/:id/events` | GET (SSE) | Stream execution events | `streamDAGExecutionEvents(id)` (Async Iterator) | P2 |
|||
|||
| `/api/v1/runs` | GET | List runs | `listRuns(filter?)` | P0 |
| `/api/v1/runs/:id` | GET | Get run details | `getRun(id)` | P0 |
| `/api/v1/runs/:id/steps` | GET | Get run steps | `getRunSteps(id)` | P0 |
| `/api/v1/runs/:id` | DELETE | Delete run | `deleteRun(id)` | P1 |
|||
| `/api/v1/tools` | GET | List available tools | `listTools(filter?)` | P0 |
| `/api/v1/task` | POST | Execute task with agent | `executeTask(agent, task, files)` | P0 |
| `/api/v1/artifacts` | GET | List artifacts | `listArtifacts()` | P1 |
| `/api/v1/artifacts/:filename` | GET | Get artifact file | `getArtifact(filename)` | P1 |

### 1.2 Core Modules Analysis

#### Database Layer (`src/db/`)
- **schema.ts**: Drizzle ORM table definitions
  - goals, schedules, runs, steps, outputs, memories, agents, dags, dagExecutions, subSteps
  - ✅ Can be reused as-is in library
- **client.ts**: SQLite connection management
  - Uses `better-sqlite3` + Drizzle ORM
  - ✅ Reusable; needs refactoring for bun compatibility

#### Agent Execution (`src/agent/`)
- **orchestrator.ts**: Main execution orchestrator
  - Executes runs, manages agent prompts, handles LLM providers
  - ✅ Core library logic
- **planner.ts**: Agent thought/action planning
  - LLM-based reasoning and tool selection
  - ✅ Core library logic
  
- **dagExecutor.ts**: DAG decomposition and execution
  - Complex DAG validation, task execution, result synthesis
  - ✅ Core library logic
- **providers/**: LLM provider implementations
  - OpenAI, OpenRouter, Ollama adapters
  - ✅ Reusable with minor updates for bun
- **tools/**: Tool definitions and registry
  - ~13 tools: WebSearch, ReadFile, WriteFile, Bash, etc.
  - ✅ Reusable; may need fs/subprocess adjustments for bun

#### Scheduler (`src/scheduler/`)
- **cron.ts**: Goal schedule execution
- **dag-scheduler.ts**: DAG schedule execution
- **queue.ts**: Execution queue management
- ✅ Reusable; can be exposed as library APIs

#### Utilities (`src/util/`)
- **logger.ts**: Pino-based structured logging
  - ✅ Reusable (Pino works with bun)
- **env.ts**: Environment variable management
  - ⚠️ Needs refactoring: remove Fastify-specific env loading

#### Database Query Helpers (`src/db/queries/` if exists)
- Not found in initial scan; query logic is inline
- ✅ Will extract into separate service classes

### 1.3 Dependencies Analysis

#### Keep (Core Library)
```json
{
  "drizzle-orm": "^0.29.2",
  "better-sqlite3": "^12.4.1",
  "openai": "^4.24.1",
  "ollama": "^0.5.0",
  "zod": "^3.22.4",
  "nanoid": "^5.0.4",
  "node-cron": "^3.0.3",
  "pino": "^8.17.2",
  "lodash": "^4.17.21",
  "glob": "^13.0.0",
  "cron-parser": "^5.4.0",
  "cronstrue": "^3.9.0",
  "p-queue": "^8.0.1"
}
```

#### Remove (Server-Specific)
```json
{
  "fastify": "^4.25.2",
  "@fastify/cors": "^8.5.0",
  "@fastify/env": "^4.3.0",
  "@fastify/multipart": "^8.3.1",
  "@fastify/rate-limit": "^8.1.1"
}
```

#### Conditional (Use Bun Equivalents)
```json
{
  "better-sqlite3": "⚠️ Requires bun sqlite support or replacement",
  "nodemailer": "^6.9.7",
  "cheerio": "^1.0.0-rc.12",
  "pdf-parse": "^2.4.5",
  "parallel-web": "^0.2.4"
}
```

#### Check for Bun 1.3.5+ Compatibility
- Better-sqlite3: May need to use `bun:sqlite` instead
- Nodemailer: Compatible
- Cheerio: Compatible
- PDF-parse: Check compatibility

### 1.4 Database Persistence Strategy

**Current**: SQLite at `./data/async-agent.db` (relative to backend)

**New Strategy**:
- Users provide database path via config
- Or use default: `~/.desiAgent/data/agent.db`
- Support .mdx agent definitions: `~/.desiAgent/agents/*.mdx`
- Auto-init database on first use with schema migrations

---

## Phase 2: Architecture & Design

### 2.1 Final Library Structure

```
desiAgent/                        # Separate repository
├── src/
│   ├── index.ts                 # Main entry point (setup function)
│   ├── core/
│   │   ├── agent/
│   │   │   ├── orchestrator.ts
│   │   │   ├── planner.ts
│   │   │   ├── dagExecutor.ts
│   │   │   └── providers/       # LLM providers
│   │   ├── execution/
│   │   │   ├── goals.ts         # Goal management service
│   │   │   ├── runs.ts          # Run management service
│   │   │   ├── dags.ts          # DAG management service
│   │   │   └── agents.ts        # Agent management service
│   │   ├── tools/
│   │   │   ├── registry.ts
│   │   │   ├── bash.ts
│   │   │   ├── filesystem.ts
│   │   │   ├── web.ts
│   │   │   └── ...
│   │   └── scheduler/
│   │       ├── cron.ts
│   │       ├── dag-scheduler.ts
│   │       └── queue.ts
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema
│   │   ├── client.ts            # DB initialization (bun-compatible)
│   │   └── migrations/
│   ├── types/
│   │   ├── index.ts             # Main type exports
│   │   └── config.ts            # Configuration types
│   ├── util/
│   │   ├── logger.ts
│   │   ├── env.ts
│   │   └── mdx-loader.ts        # Parse .mdx agent files
│   └── errors/
│       └── index.ts             # Custom error classes
├── dist/                        # Built output
├── package.json                 # Updated for bun/npm
├── tsconfig.json
├── bunfig.toml                  # Bun config
├── vitest.config.ts             # Testing
├── README.md
└── CHANGELOG.md
```

### 2.2 Main Entry Point: Setup Function

```typescript
// src/index.ts
interface DesiAgentConfig {
  // Database
  databasePath?: string;          // Defaults to ~/.desiAgent/data/agent.db
  
  // LLM Provider
  llmProvider: 'openai' | 'openrouter' | 'ollama';
  openaiApiKey?: string;
  openrouterApiKey?: string;
  ollamaBaseUrl?: string;
  modelName: string;
  
  // Agent discovery
  agentDefinitionsPath?: string;  // Defaults to ~/.desiAgent/agents
  
  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Optional callbacks
  onExecutionStart?: (executionId: string) => void;
  onExecutionEnd?: (executionId: string, result: any) => void;
}

interface DesiAgentClient {
  // Goal APIs
  goals: {
    create(objective: string, params?: any): Promise<Goal>;
    list(filter?: GoalFilter): Promise<Goal[]>;
    get(id: string): Promise<Goal | null>;
    update(id: string, updates: Partial<Goal>): Promise<Goal>;
    delete(id: string): Promise<void>;
    run(id: string): Promise<Run>;
    pause(id: string): Promise<void>;
    resume(id: string): Promise<void>;
  };
  
  // Agent APIs
  agents: {
    create(name: string, version: string, prompt: string): Promise<Agent>;
    list(filter?: AgentFilter): Promise<Agent[]>;
    get(id: string): Promise<Agent | null>;
    update(id: string, updates: Partial<Agent>): Promise<Agent>;
    delete(id: string): Promise<void>;
    activate(id: string): Promise<void>;
    resolve(name: string): Promise<Agent | null>;
  };
  
  // DAG APIs
  dags: {
    create(objective: string, params?: any): Promise<DAG>;
    list(filter?: DAGFilter): Promise<DAG[]>;
    listScheduled(): Promise<DAG[]>;
    get(id: string): Promise<DAG | null>;
    update(id: string, updates: Partial<DAG>): Promise<DAG>;
    delete(id: string): Promise<void>;
    execute(dagId: string, params?: any): Promise<DAGExecution>;
    createAndExecute(objective: string, params?: any): Promise<DAGExecution>;
    resume(executionId: string): Promise<DAGExecution>;
  };
  
  // Execution APIs
  executions: {
    list(filter?: ExecutionFilter): Promise<DAGExecution[]>;
    get(id: string): Promise<DAGExecution | null>;
    getSubSteps(id: string): Promise<SubStep[]>;
    delete(id: string): Promise<void>;
    streamEvents(id: string): AsyncIterable<ExecutionEvent>;
  };
  
  // Run APIs
  runs: {
    list(filter?: RunFilter): Promise<Run[]>;
    get(id: string): Promise<Run | null>;
    getSteps(id: string): Promise<Step[]>;
    delete(id: string): Promise<void>;
  };
  
  // Tool APIs
  tools: {
    list(filter?: ToolFilter): Promise<ToolDefinition[]>;
  };
  
  // Task execution
  executeTask(agent: string, task: string, files?: File[]): Promise<TaskResult>;
  
  // Artifact APIs
  artifacts: {
    list(): Promise<string[]>;
    get(filename: string): Promise<Buffer>;
  };
  
  // Lifecycle
  shutdown(): Promise<void>;
}

export async function setupDesiAgent(config: DesiAgentConfig): Promise<DesiAgentClient>;
```

### 2.3 Core Service Classes

```typescript
// src/core/execution/goals.ts
export class GoalService {
  constructor(private db: Database, private llmProvider: LLMProvider) {}
  
  async create(objective: string, params?: any): Promise<Goal>;
  async list(filter?: GoalFilter): Promise<Goal[]>;
  async get(id: string): Promise<Goal | null>;
  async update(id: string, updates: Partial<Goal>): Promise<Goal>;
  async delete(id: string): Promise<void>;
  async run(id: string): Promise<Run>;
  async pause(id: string): Promise<void>;
  async resume(id: string): Promise<void>;
}

// src/core/execution/dags.ts
export class DAGService {
  constructor(private db: Database, private llmProvider: LLMProvider) {}
  
  async create(objective: string, params?: any): Promise<DAG>;
  async list(filter?: DAGFilter): Promise<DAG[]>;
  // ... similar methods
}

// src/core/agent/orchestrator.ts
export class AgentOrchestrator {
  // Existing class, refactored to remove Fastify context
  async executeRun(runId: string): Promise<void>;
}

// src/core/agent/dagExecutor.ts
export class DAGExecutor {
  // Existing class, refactored
  async execute(decomposerJob: DecomposerJob): Promise<ExecutionResult>;
}

// src/util/mdx-loader.ts
export class MDXAgentLoader {
  loadAgentFromFile(filePath: string): Promise<AgentDefinition>;
  loadAllAgents(dirPath: string): Promise<AgentDefinition[]>;
}
```

### 2.4 Configuration & Initialization Flow

1. **User calls**: `setupDesiAgent(config)`
2. **Initialization steps**:
   - Validate config
   - Initialize database (auto-migrate)
   - Load agent definitions from `.mdx` files (if available)
   - Seed default agent if needed
   - Initialize LLM provider
   - Initialize tool registry
   - Start optional schedulers
   - Return `DesiAgentClient` object
3. **Usage**: Import and use `DesiAgentClient` API methods
4. **Cleanup**: Call `client.shutdown()` when done

---

## Phase 3: Implementation Tasks

### 3.1 Files to Create

| **File** | **Purpose** | **Complexity** |
|---|---|---|
| `src/index.ts` | Main export & setup function | Medium |
| `src/types/index.ts` | Type exports | Low |
| `src/types/config.ts` | Configuration types | Low |
| `src/errors/index.ts` | Custom error classes | Low |
| `src/util/mdx-loader.ts` | Parse .mdx agent files | High |
| `src/core/execution/goals.ts` | Goal service (extract from route) | High |
| `src/core/execution/agents.ts` | Agent service | High |
| `src/core/execution/dags.ts` | DAG service | High |
| `src/core/execution/runs.ts` | Run service | Medium |
| `bunfig.toml` | Bun configuration | Low |

### 3.2 Files to Modify

| **File** | **Changes** | **Complexity** |
|---|---|---|
| `src/app/server.ts` | Remove entirely (Fastify setup) | - |
| `src/db/client.ts` | Update for bun compatibility | Medium |
| `src/util/env.ts` | Remove Fastify env handling | Low |
| `src/agent/orchestrator.ts` | Remove Fastify context, add exports | Low |
| `src/agent/dagExecutor.ts` | Ensure no HTTP context | Low |
| `src/agent/tools/*.ts` | Review subprocess calls (bun compat) | Medium |
| `src/util/logger.ts` | Keep as-is or update for bun | Low |
| `package.json` | Update scripts, deps, main entry | Low |
| `tsconfig.json` | Update for bun/esnext | Low |

### 3.3 Files to Remove

- `src/app/routes/**/*.ts` (all route handlers)
- `src/app/server.ts`
- `src/app/__tests__/server.test.ts`
- Build config for server (keep only library build)

### 3.4 File Mapping: Copy & Adapt

| **Source** | **Destination** | **Adapt For** |
|---|---|---|
| `src/db/schema.ts` | ✓ Keep as-is | Database agnostic |
| `src/db/client.ts` | `src/db/client.ts` | Bun sqlite support |
| `src/agent/orchestrator.ts` | ✓ Keep as-is | Remove Fastify, keep logic |
| `src/agent/planner.ts` | ✓ Keep as-is | Pure LLM logic |
| `src/agent/dagExecutor.ts` | ✓ Keep as-is | Pure execution logic |
| `src/agent/providers/*.ts` | ✓ Keep as-is | Provider implementations |
| `src/agent/tools/*.ts` | ✓ Update paths | Keep tool logic, fix imports |
| `src/scheduler/cron.ts` | ✓ Keep as-is | Scheduler logic |
| `src/scheduler/dag-scheduler.ts` | ✓ Keep as-is | Scheduler logic |
| `src/events/bus.ts` | ✓ Keep as-is | Event system |
| `src/util/logger.ts` | ✓ Keep as-is | Logging |
| `src/util/env.ts` | Update for bun | Environment setup |
| `src/db/schema.ts` | ✓ Keep as-is | Database schema |

---

## Phase 4: Challenges & Risks

### 4.1 High-Risk Areas

#### 🔴 **Bun SQLite Compatibility**
- **Challenge**: `better-sqlite3` is a native C++ module; bun might not support it directly
- **Risk**: Circular dependency on Node.js even in "bun library"
- **Mitigation**:
  - Investigate `bun:sqlite` built-in support
  - If unavailable, create abstraction layer for DB access
  - Consider publishing as "bun-compatible" but requiring Node runtime for DB layer
  - Alternative: Provide in-memory stub for testing

#### 🔴 **Tool Subprocess Calls**
- **Tools like**: BashTool, ReadFile, WriteFile use Node.js fs/child_process
- **Risk**: Not all may work with Bun subprocess APIs
- **Mitigation**:
  - Test each tool with Bun
  - Create bun-specific adapters if needed
  - Document which tools require Node.js

#### 🟡 **HTTP Context Removal**
- **Challenge**: Routes heavily depend on Fastify context (request, reply, db decoration)
- **Risk**: Complex refactoring; easy to miss dependencies
- **Mitigation**:
  - Use automated grep to find all `fastify.`, `request`, `reply` references
  - Create integration tests for each extracted service

#### 🟡 **Agent Definition Format (.mdx)**
- **Challenge**: MDX parsing is non-trivial; need to extract YAML frontmatter + markdown
- **Risk**: Poorly designed format could limit extensibility
- **Mitigation**:
  - Define clear schema for `.mdx` agent files
  - Provide examples
  - Validate against Zod schema

#### 🟡 **Database Path & Default Locations**
- **Challenge**: Cross-platform home directory handling
- **Risk**: Path issues on Windows/macOS/Linux
- **Mitigation**:
  - Use `os.homedir()` or better, let users specify
  - Provide sensible defaults
  - Auto-create directories

#### 🟡 **Circular Dependencies in Exports**
- **Challenge**: Services depend on DB, which depends on schema; easy to create circles
- **Risk**: Module load failures
- **Mitigation**:
  - Careful dependency injection design
  - Use interfaces/types, not concrete implementations
  - Test module loading in isolation

### 4.2 Medium-Risk Areas

#### 🟠 **Event Bus & Subscription Pattern**
- **Challenge**: Event bus uses internal decorators and state
- **Risk**: May not work well as library export
- **Mitigation**: Test event subscriptions thoroughly

#### 🟠 **Tool Registry Singleton**
- **Challenge**: Currently exported as singleton (`defaultToolRegistry`)
- **Risk**: Not ideal for multi-instance scenarios
- **Mitigation**: Make registry configurable per client instance

#### 🟠 **Scheduler Lifecycle**
- **Challenge**: Schedulers start/stop; need graceful cleanup
- **Risk**: Resource leaks if not properly managed
- **Mitigation**: Implement proper `shutdown()` method, test cleanup

### 4.3 Low-Risk Areas

#### 🟢 **Logger Configuration**
- **Challenge**: Pino is well-established; bun supports it
- **Risk**: Minimal
- **Mitigation**: Test with bun; update if needed

#### 🟢 **Zod Validation**
- **Challenge**: Already used; no Fastify dependency
- **Risk**: Minimal
- **Mitigation**: Keep as-is

---

## Phase 5: Testing Strategy

### 5.1 Unit Tests
- **Location**: `src/**/__tests__/` (mirror src structure)
- **Framework**: Vitest (already in use)
- **Coverage**: All service classes, utilities, helpers
- **Goal**: 80%+ coverage on core logic

### 5.2 Integration Tests
- **Location**: `src/__tests__/integration/`
- **Scenarios**:
  - End-to-end goal creation → execution → completion
  - DAG creation and execution
  - Agent resolution and activation
  - .mdx agent file loading
- **Goal**: Verify library APIs work together

### 5.3 Bun Compatibility Tests
- **Location**: `src/__tests__/bun/`
- **Scenarios**:
  - Library imports in bun environment
  - Tool execution with bun subprocess
  - Database operations with bun:sqlite
- **Goal**: Verify bun compatibility

### 5.4 Test Setup
```typescript
// vitest.config.ts
import { getVitestConfig } from '@async-agent/shared';

export default getVitestConfig({
  test: {
    environment: 'node', // or 'bun' when ready
    globals: true,
  },
});
```

---

## Phase 6: Documentation

### 6.1 README.md
- Installation (npm/bun)
- Quick start example
- Configuration guide
- API reference (link to generated docs)
- Common patterns

### 6.2 CHANGELOG.md
- Initial release notes
- Breaking changes from backend

### 6.3 API Documentation
- Generate from TSDoc comments
- Include examples
- Document error types

### 6.4 Agent Definition Format
- `.mdx` schema specification
- Example agent file
- Frontmatter properties required/optional

---

## Phase 7: Publishing & Distribution

### 7.1 Package Setup
- **Registry**: npm
- **Scope**: `@desiagent/core` (or unscoped: `desiagent`)
- **License**: Same as monorepo
- **Exports**:
  ```json
  {
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "types": "./dist/index.d.ts"
      }
    }
  }
  ```

### 7.2 Publishing Pipeline
1. Version bump in `package.json`
2. Update CHANGELOG.md
3. Build: `bun run build`
4. Test: `bun run test`
5. Publish: `bun publish` (or `npm publish`)

### 7.3 Separate Repository Structure
```
desiAgent/
├── .github/
│   └── workflows/           # CI/CD (publish on release)
├── src/                     # Source code (as above)
├── docs/                    # Documentation
├── examples/                # Usage examples
├── package.json
├── README.md
├── LICENSE
└── ...
```

---

## Phase 8: Migration Path

### 8.1 Keeping Backend Compatibility

**Option 1**: Keep both (dual maintenance)
- Backend continues to use Fastify, imports from desiAgent library

**Option 2**: Refactor backend to use desiAgent (recommended)
- Faster implementation
- Single source of truth

**Recommended**: Option 2 + thin Fastify wrapper
```typescript
// packages/backend/src/app/server.ts (NEW)
import { setupDesiAgent } from 'desiagent';
import Fastify from 'fastify';

const desiClient = await setupDesiAgent(config);
const fastify = Fastify();

// Register route adapters
fastify.post('/api/v1/goals', async (req, res) => {
  const goal = await desiClient.goals.create(req.body.objective, req.body.params);
  return goal;
});
// ... wrap other APIs
```

---

## Phase 9: Estimated Timeline & Effort

| **Phase** | **Tasks** | **Est. Time** | **Risk** |
|---|---|---|---|
| Analysis (Current) | ✓ Complete | - | - |
| Setup & Config | Create bun package, tsconfig | 2h | Low |
| Service Extraction | Extract 4-5 core services | 16h | High |
| Tool Refactoring | Adapt tools to bun/non-HTTP | 8h | High |
| Database Layer | bun sqlite adapter, migrations | 6h | High |
| Testing | Unit + integration tests | 12h | Medium |
| MDX Agent Loader | Parse .mdx files | 4h | Medium |
| Documentation | README, API docs, examples | 6h | Low |
| **TOTAL** | - | **~54h** | - |

---

## Acceptance Criteria

- [ ] Library builds and runs on bun 1.3.5+
- [ ] All 40+ API functions exported and documented
- [ ] 80%+ test coverage on core logic
- [ ] Zero breaking changes to route signatures (data contract)
- [ ] Can be imported as `import { setupDesiAgent } from 'desiagent'`
- [ ] Configuration via `DesiAgentConfig` object
- [ ] Agent definitions loadable from `.desiAgent/agents/*.mdx`
- [ ] Published to npm as `@desiagent/core` (or `desiagent`)
- [ ] Backward compatible: Backend can wrap and serve over HTTP
- [ ] Documentation: README, API reference, examples

---

## Key Decisions Required

1. **Bun vs Node.js**: Will library require Node.js runtime or pure bun?
2. **Database**: Use `bun:sqlite` or `better-sqlite3` wrapper?
3. **Repository**: Create new repo or keep in monorepo as separate package?
4. **Package Name**: `@desiagent/core` (scoped) or `desiagent` (unscoped)?
5. **MDX Schema**: What properties define an agent in `.mdx` files?
6. **Scheduler Export**: Keep built-in or export as configurable extension?
7. **Tools**: Which tools are "core" vs "optional plugins"?

---

## Next Steps

1. ✅ Validate this plan with stakeholders
2. ⏳ **Phase 1-2**: Set up new repo structure, define types/config
3. ⏳ **Phase 3-4**: Extract services, test, fix bun compatibility
4. ⏳ **Phase 5-6**: Add tests, documentation
5. ⏳ **Phase 7-8**: Publish to npm, update backend to use library
