# desiAgent Library - Implementation Checklist

## Pre-Implementation (Week 1)

### Planning & Setup
- [ ] **Review & Approve** the full refactoring plan with team
- [ ] **Clarify Key Decisions** (see summary doc):
  - Monorepo vs separate repository?
  - Bun 1.3.5+ hard requirement?
  - Which APIs are P0 (must-have) vs P1/P2 (nice-to-have)?
- [ ] **Create New Repository** (if separate repo path chosen)
  - Clone template or initialize from scratch
  - Set up CI/CD pipeline (GitHub Actions)
  - Configure npm publishing
- [ ] **Set Up Development Environment**
  - Install bun 1.3.5+
  - Verify vitest works with bun
  - Test TypeScript compilation for bun target

### Dependency Analysis
- [ ] **Test better-sqlite3 with bun**
  - Can we use existing `better-sqlite3`?
  - Or must we use `bun:sqlite`?
  - Document findings and create DB abstraction if needed
- [ ] **Verify Tool Compatibility** with bun
  - Test `BashTool` with bun's subprocess API
  - Test `ReadFile`/`WriteFile` with bun's fs API
  - Test web tools (fetch, cheerio)
- [ ] **Create Compatibility Matrix**
  - Document which dependencies work natively with bun
  - Identify replacements needed

---

## Phase 1: Foundation & Structure (Week 1-2)

### Project Scaffolding
- [ ] **Create Package Structure**
  ```
  src/
  ├── index.ts              # Main entry point
  ├── types/
  │   ├── index.ts
  │   └── config.ts
  ├── errors/
  │   └── index.ts
  ├── core/
  │   ├── agent/
  │   ├── execution/
  │   ├── tools/
  │   └── scheduler/
  ├── db/
  │   ├── schema.ts
  │   ├── client.ts
  │   └── migrations/
  └── util/
      ├── logger.ts
      ├── env.ts
      └── mdx-loader.ts
  ```

- [ ] **Create Configuration Files**
  - [ ] `package.json` - Update with bun config, new deps
  - [ ] `tsconfig.json` - ESM, strict mode, bun target
  - [ ] `bunfig.toml` - Bun-specific settings
  - [ ] `vitest.config.ts` - Testing configuration
  - [ ] `.npmrc` - npm publishing config

### Type Definitions
- [ ] **Create `src/types/config.ts`** - DesiAgentConfig interface
- [ ] **Create `src/types/index.ts`** - Export all types:
  - Goal, Schedule, Run, Step, Agent, DAG, DAGExecution, SubStep
  - Tool, ToolDefinition, ExecutionEvent
  - Filter types (GoalFilter, DAGFilter, etc.)
- [ ] **Ensure Zod schemas** for all input validation
- [ ] **Document type hierarchy** in comments

### Error Handling
- [ ] **Create `src/errors/index.ts`** - Custom error classes:
  - `DesiAgentError` (base)
  - `ConfigurationError`
  - `NotFoundError`
  - `ValidationError`
  - `ExecutionError`
  - `DatabaseError`

### Build Configuration
- [ ] **Update `package.json`**
  ```json
  {
    "name": "desiagent",
    "version": "0.1.0",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "types": "./dist/index.d.ts"
      }
    },
    "scripts": {
      "build": "tsup",
      "dev": "tsup --watch",
      "test": "vitest",
      "test:ui": "vitest --ui",
      "test:coverage": "vitest --coverage",
      "type-check": "tsc --noEmit",
      "lint": "eslint src",
      "prepare": "npm run build"
    }
  }
  ```

- [ ] **Create `tsup.config.ts`** (if not using default)
- [ ] **Verify builds**:
  - `bun run build` produces valid ES modules
  - Type declarations are generated
  - No Fastify imports in dist/

---

## Phase 2: Database & Utilities (Week 2-3)

### Database Abstraction
- [ ] **Copy & Update `src/db/schema.ts`**
  - Verify all table definitions intact
  - Add comments explaining each table
  - Ensure no HTTP-specific columns

- [ ] **Create Bun-Compatible Database Client** (`src/db/client.ts`)
  - [ ] Detect bun environment
  - [ ] Try bun:sqlite first
  - [ ] Fallback to better-sqlite3
  - [ ] Create abstraction layer if needed
  - [ ] Handle database initialization
  - [ ] Auto-create `~/.desiAgent/data/` directory
  - [ ] Run migrations on init

  ```typescript
  export async function initializeDatabase(dbPath: string): Promise<Database> {
    // 1. Ensure directory exists
    // 2. Try to connect using bun or fallback
    // 3. Run migrations
    // 4. Return database instance
  }
  ```

- [ ] **Create Database Query Utilities**
  - Helper functions for common queries
  - Type-safe query builders

### Utilities & Logging
- [ ] **Copy `src/util/logger.ts`**
  - Verify Pino works with bun
  - Update if needed for bun's logger preference
  - Add log level from config

- [ ] **Update `src/util/env.ts`**
  - Remove Fastify env handling
  - Use Zod for environment validation
  - Load from:
    1. Environment variables
    2. `.env` file (if exists)
    3. Config passed to setupDesiAgent()

  ```typescript
  export const envSchema = z.object({
    LLM_PROVIDER: z.enum(['openai', 'openrouter', 'ollama']),
    OPENAI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.string().optional(),
    LLM_MODEL: z.string(),
    DATABASE_PATH: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  });
  ```

- [ ] **Create `src/util/mdx-loader.ts`** - MDX Agent Loader
  - [ ] Define MDX frontmatter schema (Zod)
  - [ ] Implement YAML frontmatter parser
  - [ ] Load single .mdx file → AgentDefinition
  - [ ] Load all .mdx files from directory
  - [ ] Validate against schema
  - [ ] Handle errors gracefully

  ```typescript
  export interface AgentDefinition {
    name: string;
    version: string;
    description: string;
    promptTemplate: string;
    provider?: string;
    model?: string;
    tags?: string[];
  }
  
  export class MDXAgentLoader {
    async loadFromFile(filePath: string): Promise<AgentDefinition>;
    async loadAllFromDirectory(dirPath: string): Promise<AgentDefinition[]>;
  }
  ```

### Seed Data
- [ ] **Copy & Update `src/db/seed.ts`**
  - Create default agent on first run
  - Load .mdx agents from `agentDefinitionsPath`
  - Only insert if not already exists

---

## Phase 3: Core Services - Part 1 (Week 3-4)

### Main Entry Point
- [ ] **Create `src/index.ts`** - setupDesiAgent() function
  ```typescript
  export async function setupDesiAgent(config: DesiAgentConfig): Promise<DesiAgentClient> {
    // 1. Validate config
    // 2. Initialize database
    // 3. Initialize LLM provider
    // 4. Initialize tool registry
    // 5. Load agents from .mdx files
    // 6. Create service instances
    // 7. Return client object with all APIs
  }
  ```

### Goal Service
- [ ] **Create `src/core/execution/goals.ts`**
  - Extract from `src/app/routes/goals.ts`
  - Implement:
    ```typescript
    class GoalService {
      create(objective, params?): Promise<Goal>
      list(filter?): Promise<Goal[]>
      get(id): Promise<Goal | null>
      update(id, updates): Promise<Goal>
      delete(id): Promise<void>
      run(id): Promise<Run>
      pause(id): Promise<void>
      resume(id): Promise<void>
    }
    ```
  - **Tests**: Unit test all methods with mocked DB

### Agent Service
- [ ] **Create `src/core/execution/agents.ts`**
  - Extract from `src/app/routes/agents.ts`
  - Implement:
    ```typescript
    class AgentService {
      create(name, version, prompt): Promise<Agent>
      list(filter?): Promise<Agent[]>
      get(id): Promise<Agent | null>
      update(id, updates): Promise<Agent>
      delete(id): Promise<void>
      activate(id): Promise<void>
      resolve(name): Promise<Agent | null>
    }
    ```
  - **Tests**: Unit test all methods

### Run Service
- [ ] **Create `src/core/execution/runs.ts`**
  - Extract from `src/app/routes/runs.ts`
  - Implement:
    ```typescript
    class RunService {
      list(filter?): Promise<Run[]>
      get(id): Promise<Run | null>
      getSteps(id): Promise<Step[]>
      delete(id): Promise<void>
    }
    ```
  - **Tests**: Unit test all methods

---

## Phase 4: Core Services - Part 2 (Week 4-5)

### DAG Service
- [ ] **Create `src/core/execution/dags.ts`**
  - Extract from `src/app/routes/dag/*.ts`
  - Implement:
    ```typescript
    class DAGService {
      create(objective, params?): Promise<DAG>
      createAndExecute(objective, params?): Promise<DAGExecution>
      execute(dagId, params?): Promise<DAGExecution>
      list(filter?): Promise<DAG[]>
      listScheduled(): Promise<DAG[]>
      get(id): Promise<DAG | null>
      update(id, updates): Promise<DAG>
      delete(id): Promise<void>
      getExecutions(dagId): Promise<DAGExecution[]>
      getExecution(id): Promise<DAGExecution | null>
      getSubSteps(executionId): Promise<SubStep[]>
      deleteExecution(id): Promise<void>
      resumeExecution(executionId): Promise<DAGExecution>
      streamExecutionEvents(executionId): AsyncIterable<ExecutionEvent>
    }
    ```
  - Handle SSE-like event streaming as AsyncIterable
  - **Tests**: Integration test DAG execution flow

### Agent Core Logic (Copy as-is)
- [ ] **Copy `src/agent/orchestrator.ts`**
  - Remove Fastify context
  - Ensure it works with injected dependencies
  - Verify no HTTP response code handling
  - **Tests**: Ensure unit tests still pass

- [ ] **Copy `src/agent/planner.ts`**
  - No changes needed
  - Verify tests pass

- [ ] **Copy `src/agent/dagExecutor.ts`**
  - No changes needed
  - Verify tests pass

### LLM Providers
- [ ] **Copy `src/agent/providers/index.ts`**
  - Remove Fastify env handling
  - Use config passed to setupDesiAgent()

- [ ] **Copy `src/agent/providers/openai.ts`**
  - Verify works with bun
  - **Tests**: Mock API calls

- [ ] **Copy `src/agent/providers/openrouter.ts`**
  - Verify works with bun
  - **Tests**: Mock API calls

- [ ] **Copy `src/agent/providers/ollama.ts`**
  - Verify works with bun
  - **Tests**: Mock API calls

---

## Phase 5: Tools & Schedulers (Week 5-6)

### Tool Registry
- [ ] **Copy & Verify `src/agent/tools/index.ts`**
  - Update imports/paths
  - Ensure registry is exported properly
  - No Fastify dependencies

### Individual Tools
- [ ] **Copy `src/agent/tools/bash.ts`**
  - Test with bun subprocess API
  - Update if bun has different exec API
  - **Tests**: Mock subprocess calls

- [ ] **Copy `src/agent/tools/readFile.ts`**
  - Test with bun fs API
  - Update if needed
  - **Tests**: Mock file reads

- [ ] **Copy `src/agent/tools/writeFile.ts`**
  - Test with bun fs API
  - Update if needed
  - **Tests**: Mock file writes

- [ ] **Copy remaining tools** (all in `src/agent/tools/`)
  - webSearch.ts, fetchPage.ts, glob.ts, grep.ts, edit.ts, sendEmail.ts, sendWebhook.ts
  - Update imports/paths
  - Verify no HTTP context dependencies
  - **Tests**: Each tool has unit tests

### Schedulers
- [ ] **Copy `src/scheduler/cron.ts`**
  - Verify node-cron works with bun
  - Update imports/paths
  - Make start/stop explicit (not auto)

- [ ] **Copy `src/scheduler/dag-scheduler.ts`**
  - Update imports/paths
  - Make start/stop explicit

- [ ] **Copy `src/scheduler/queue.ts`**
  - Verify p-queue works with bun
  - Update imports/paths

### Events
- [ ] **Copy `src/events/bus.ts`**
  - No changes needed
  - Verify event emitter works with bun
  - **Tests**: Event subscription pattern

---

## Phase 6: Tool Refactoring for Bun (Week 6)

### Compatibility Testing
- [ ] **Test each tool with bun runtime**
  ```bash
  bun test src/agent/tools/__tests__/*.test.ts
  ```

- [ ] **Fix subprocess API differences**
  - BashTool: Update if `child_process` API differs in bun
  - ReadFile/WriteFile: Update if fs API differs
  - Document any bun-specific APIs used

- [ ] **Test tool registry**
  - Can tools be instantiated?
  - Can tools be called?
  - Do they return expected results?

### Database Compatibility
- [ ] **Test database operations with bun**
  ```bash
  bun run test:integration
  ```

- [ ] **Verify migrations run correctly**
- [ ] **Test CRUD operations** on each table
- [ ] **Test complex queries** (joins, filters, relationships)

---

## Phase 7: Assembly & Integration (Week 6-7)

### Service Composition
- [ ] **Wire up DesiAgentClient** in setupDesiAgent()
  ```typescript
  const client: DesiAgentClient = {
    goals: new GoalService(db, llmProvider),
    agents: new AgentService(db),
    dags: new DAGService(db, llmProvider, toolRegistry),
    executions: new ExecutionService(db),
    runs: new RunService(db),
    tools: new ToolService(toolRegistry),
    artifacts: new ArtifactService(),
    executeTask: (agent, task, files) => executeTask(agent, task, files),
    shutdown: () => shutdown(),
  };
  ```

- [ ] **Test setupDesiAgent() full flow**
  - Can be called with valid config
  - Returns client with all methods
  - Database is initialized
  - Agents are loaded from .mdx files
  - LLM provider is validated

### Configuration Validation
- [ ] **Validate all required fields** in DesiAgentConfig
- [ ] **Provide sensible defaults** for optional fields
- [ ] **Test invalid configurations**
  - Should throw DesiAgentError
  - Error message should be helpful

### Graceful Shutdown
- [ ] **Implement `client.shutdown()`**
  - Stop all active schedulers
  - Close database connection
  - Clean up any resources
- [ ] **Test shutdown** doesn't hang or leak
- [ ] **Test can call shutdown** multiple times safely

---

## Phase 8: Testing - Unit & Integration (Week 7-8)

### Unit Tests Setup
- [ ] **Create test utilities** in `src/__tests__/setup.ts`
  ```typescript
  export async function createTestDatabase(): Promise<Database>
  export async function createTestClient(overrides?: Partial<DesiAgentConfig>): Promise<DesiAgentClient>
  export async function cleanupTest(): Promise<void>
  ```

### Goal Service Tests
- [ ] **`src/core/execution/__tests__/goals.test.ts`**
  - Test create with valid/invalid params
  - Test list with filters
  - Test get existing/non-existing
  - Test update
  - Test delete cascade
  - Test run execution
  - Test pause/resume

### Agent Service Tests
- [ ] **`src/core/execution/__tests__/agents.test.ts`**
  - Test create, list, get, update, delete
  - Test activate
  - Test resolve by name

### DAG Service Tests
- [ ] **`src/core/execution/__tests__/dags.test.ts`**
  - Test create from text
  - Test execute
  - Test list with filters
  - Test get execution
  - Test sub-steps
  - Test resume
  - Test event streaming

### Tool Registry Tests
- [ ] **`src/agent/tools/__tests__/registry.test.ts`**
  - Test all tools can be registered
  - Test tool lookup
  - Test get all tools
  - Test filter by names

### MDX Loader Tests
- [ ] **`src/util/__tests__/mdx-loader.test.ts`**
  - Test load single .mdx file
  - Test load directory
  - Test validation
  - Test error handling

### Database Tests
- [ ] **`src/db/__tests__/client.test.ts`**
  - Test initialization
  - Test migrations
  - Test CRUD on each table
  - Test relationships (cascades)

### Integration Tests
- [ ] **`src/__tests__/integration/setup.test.ts`**
  - Test full setupDesiAgent() flow
  - Test with different LLM providers
  - Test with real agent .mdx files

- [ ] **`src/__tests__/integration/goal-workflow.test.ts`**
  - Create goal → Get goal → Run goal → Check execution
  - Verify complete workflow

- [ ] **`src/__tests__/integration/dag-workflow.test.ts`**
  - Create DAG → Execute → Stream events → Check results

### Coverage
- [ ] **Achieve 80%+ coverage** on core logic
  ```bash
  bun run test:coverage
  ```
- [ ] **Document coverage gaps** and why (e.g., external API calls)

---

## Phase 9: Bun Compatibility Tests (Week 8)

### Bun-Specific Tests
- [ ] **`src/__tests__/bun/imports.test.ts`**
  - Import library in bun environment
  - Verify no Node.js-only APIs are used

- [ ] **`src/__tests__/bun/subprocess.test.ts`**
  - Test BashTool with bun subprocess
  - Document any API differences

- [ ] **`src/__tests__/bun/sqlite.test.ts`**
  - Test database operations with bun's sqlite
  - Verify migrations work

### Cross-Runtime Tests
- [ ] **Test with Node.js 18+**
- [ ] **Test with bun 1.3.5+**
- [ ] **Test with Deno** (optional)
- [ ] **Document compatibility matrix**

---

## Phase 10: Documentation (Week 8-9)

### README.md
- [ ] **Installation instructions** (npm, bun, yarn)
- [ ] **Quick start example** (copy-paste-able)
- [ ] **Configuration guide** (all options explained)
- [ ] **API reference** (link to generated docs)
- [ ] **Agent definition guide** (.mdx format)
- [ ] **Common patterns** (examples)
- [ ] **Troubleshooting** (common issues)
- [ ] **Contributing** (how to contribute)

### API Documentation
- [ ] **JSDoc comments** on all public APIs
- [ ] **Generate TypeScript docs** from comments
- [ ] **Example code** for each major API
- [ ] **Error types documentation**

### Agent Definition Guide
- [ ] **Document .mdx format** (frontmatter schema)
- [ ] **Provide templates** (starting points)
- [ ] **Show examples** (3-5 realistic agents)
- [ ] **Explain each property** (name, version, provider, etc.)

### Examples
- [ ] **example-basic.ts** - Simple goal creation
- [ ] **example-dag.ts** - DAG creation and execution
- [ ] **example-streaming.ts** - Stream execution events
- [ ] **example-cli.ts** - CLI-based usage
- [ ] **example-http-wrapper.ts** - HTTP API wrapper (for backend)

### CHANGELOG.md
- [ ] **0.1.0** Initial release notes
  - What was extracted from backend
  - Breaking changes (if any)
  - New features

### Type Documentation
- [ ] **src/types/index.ts** - Document all exported types
- [ ] **Create types.md** - Type reference guide

---

## Phase 11: Quality Assurance (Week 9)

### Code Quality
- [ ] **ESLint** checks pass
  ```bash
  bun run lint
  ```
- [ ] **TypeScript** strict mode passes
  ```bash
  bun run type-check
  ```
- [ ] **No console.log()** usage (use logger)
- [ ] **No commented-out code** (delete or document)

### Performance
- [ ] **Profile** setupDesiAgent() initialization time
- [ ] **Optimize** if > 1 second for average config
- [ ] **Test** with large agent definitions

### Security
- [ ] **Validate all inputs** with Zod
- [ ] **Sanitize filenames** for artifacts
- [ ] **No hardcoded secrets** in code
- [ ] **Review** any `eval()` or dynamic code execution

### Accessibility
- [ ] **Error messages** are helpful and actionable
- [ ] **Logging** provides debugging context
- [ ] **Documentation** is clear for new users

---

## Phase 12: Publishing (Week 9-10)

### Pre-Publish Checklist
- [ ] **Final build passes**
  ```bash
  bun run build
  bun run test
  ```
- [ ] **dist/ contains only ES modules**
- [ ] **package.json** exports are correct
- [ ] **All dependencies** are listed (no missing)
- [ ] **LICENSE** file included
- [ ] **README.md** is complete

### npm Publishing
- [ ] **Publish to npm**
  ```bash
  npm publish
  ```
  OR
  ```bash
  bun publish
  ```
- [ ] **Verify on npm registry** (npmjs.com)
- [ ] **Test installation** from npm
  ```bash
  npm install desiagent
  ```

### GitHub Release
- [ ] **Create GitHub release** with tag `v0.1.0`
- [ ] **Include CHANGELOG** in release notes
- [ ] **Link to npm package**

### Community
- [ ] **Announce** in relevant channels
- [ ] **Create discussion** threads for feedback
- [ ] **Monitor issues** for early adoption bugs

---

## Phase 13: Backend Integration (Week 10-11)

### Refactor Backend to Use Library
- [ ] **Update `packages/backend/package.json`**
  - Add `desiagent` as dependency

- [ ] **Create `packages/backend/src/app/client.ts`**
  - Initialize desiAgent client with backend config
  - Export as singleton or provide via DI

- [ ] **Refactor routes** one at a time
  - Replace route handler logic with `desiClient.apiCall()`
  - Thin HTTP wrapper around library functions

- [ ] **Remove old route logic** as refactoring completes
- [ ] **Update tests** to use desiClient directly
- [ ] **Verify all routes still work** (backward compatible)

### Documentation Update
- [ ] **Update backend README** - mention desiAgent
- [ ] **Update API docs** - reference desiAgent types
- [ ] **Update contribution guide** - note library is separate

---

## Final Acceptance Criteria

- [ ] **Functionality**
  - [ ] All 40+ API functions exported
  - [ ] All functions have matching signatures to original routes
  - [ ] No breaking changes to data contracts

- [ ] **Code Quality**
  - [ ] 80%+ test coverage on core logic
  - [ ] ESLint passes
  - [ ] TypeScript strict mode passes
  - [ ] No console.log, only logger
  - [ ] All public APIs have JSDoc

- [ ] **Compatibility**
  - [ ] Builds and runs on bun 1.3.5+
  - [ ] Works on Node.js 18+ (if bun fallbacks used)
  - [ ] No Fastify dependencies in dist/

- [ ] **Configuration**
  - [ ] setupDesiAgent() takes config object
  - [ ] All required fields validated with Zod
  - [ ] Sensible defaults for optional fields
  - [ ] Agent definitions load from .mdx files

- [ ] **Documentation**
  - [ ] README.md complete with examples
  - [ ] API reference generated
  - [ ] Agent definition guide with examples
  - [ ] Type definitions exported and documented
  - [ ] Troubleshooting guide

- [ ] **Publishing**
  - [ ] Published to npm
  - [ ] Can be installed via `npm install desiagent`
  - [ ] GitHub release created

- [ ] **Integration**
  - [ ] Backend successfully refactored to use library
  - [ ] All routes converted to thin HTTP wrappers
  - [ ] Backend tests pass with new library

---

## Risk Mitigation Checklist

### High-Risk Items
- [ ] **bun:sqlite vs better-sqlite3**
  - [ ] Test both approaches ASAP in Phase 1
  - [ ] Have fallback plan ready
  - [ ] Document which approach taken and why

- [ ] **Tool subprocess compatibility**
  - [ ] Test BashTool in Phase 3
  - [ ] Have bun subprocess API reference
  - [ ] Create adapter if needed

- [ ] **HTTP context removal**
  - [ ] Use grep to find all fastify/request/reply refs
  - [ ] Test each extracted service independently
  - [ ] Don't integrate until service tests pass

### Medium-Risk Items
- [ ] **Circular dependencies**
  - [ ] Design with dependency injection in mind
  - [ ] Test module loading in isolation
  - [ ] Use barrel exports carefully

- [ ] **Event streaming**
  - [ ] Test AsyncIterable pattern with bun
  - [ ] Have fallback (polling) if not supported

- [ ] **Database migrations**
  - [ ] Ensure migrations work with bun:sqlite
  - [ ] Test on fresh database
  - [ ] Test on existing database with upgrades

---

## Weekly Milestones

- **Week 1**: ✅ Pre-implementation complete, Phase 1 foundation done
- **Week 2**: ✅ Database layer, utilities ready
- **Week 3**: ✅ Services part 1 (Goals, Agents, Runs)
- **Week 4**: ✅ Services part 2 (DAGs), Core logic copied
- **Week 5**: ✅ Tools & Schedulers, providers ready
- **Week 6**: ✅ Bun compatibility testing, service wiring
- **Week 7**: ✅ Unit & integration tests (80%+ coverage)
- **Week 8**: ✅ Documentation, bun-specific tests
- **Week 9**: ✅ QA & npm publishing
- **Week 10-11**: ✅ Backend integration, final validation

---

## Sign-Off

- [ ] **Project Lead** approves plan: _______________ Date: _______
- [ ] **Tech Lead** validates architecture: _______________ Date: _______
- [ ] **QA Lead** confirms test strategy: _______________ Date: _______
- [ ] **Product Owner** agrees on scope: _______________ Date: _______
