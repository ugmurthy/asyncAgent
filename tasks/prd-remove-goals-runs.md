# PRD: Remove Goals and Runs Management

## Introduction

Refactor the backend package to remove Goal Management and Runs Management functionality, including their associated database tables (`goals`, `runs`, `steps`, `memories`, `outputs`). The `schedules` table will be repurposed for DAG scheduling only. The `CronScheduler` and `AgentOrchestrator` classes will be retained but refactored to remove goal/run dependencies for potential future use.

## Goals

- Remove all Goal Management API routes (`/api/v1/goals/*`)
- Remove all Runs Management API routes (`/api/v1/runs/*`)
- Remove database tables: `goals`, `runs`, `steps`, `memories`, `outputs`
- Repurpose `schedules` table for DAG scheduling (remove `goalId` foreign key)
- Refactor `CronScheduler` to remove goal/run dependencies
- Retain `AgentOrchestrator` refactored for future use
- Ensure no breaking changes to remaining functionality (DAG, Agents, Tools, Artifacts, Task)
- All tests pass and build succeeds

## User Stories

### US-001: Remove Goals Routes
**Description:** As a developer, I want to remove the goals route file and its registration so that the Goals API is no longer exposed.

**Acceptance Criteria:**
- [ ] Delete `packages/backend/src/app/routes/goals.ts`
- [ ] Remove `goalsRoutes` import and registration from `server.ts`
- [ ] Remove `scheduler` parameter from route registration (no longer needed for goals)
- [ ] Typecheck passes (`pnpm --filter backend build`)

### US-002: Remove Runs Routes
**Description:** As a developer, I want to remove the runs route file and its registration so that the Runs API is no longer exposed.

**Acceptance Criteria:**
- [ ] Delete `packages/backend/src/app/routes/runs.ts`
- [ ] Remove `runsRoutes` import and registration from `server.ts`
- [ ] Typecheck passes (`pnpm --filter backend build`)

### US-003: Remove Goals-Related Database Tables
**Description:** As a developer, I want to remove the `goals`, `runs`, `steps`, `memories`, and `outputs` tables from the schema so that the database no longer contains unused tables.

**Acceptance Criteria:**
- [ ] Remove `goals` table definition from `schema.ts`
- [ ] Remove `runs` table definition from `schema.ts`
- [ ] Remove `steps` table definition from `schema.ts`
- [ ] Remove `memories` table definition from `schema.ts`
- [ ] Remove `outputs` table definition from `schema.ts`
- [ ] Remove all associated type exports (`Goal`, `NewGoal`, `Run`, `NewRun`, `Step`, `NewStep`, `Memory`, `NewMemory`, `Output`, `NewOutput`)
- [ ] Remove all associated relations (`goalsRelations`, `runsRelations`, `stepsRelations`, `memoriesRelations`, `outputsRelations`)
- [ ] Typecheck passes (`pnpm --filter backend build`)

### US-004: Repurpose Schedules Table for DAG
**Description:** As a developer, I want to modify the schedules table to support DAG scheduling instead of goal scheduling.

**Acceptance Criteria:**
- [ ] Remove `goalId` foreign key from `schedules` table
- [ ] Add `dagId` foreign key referencing `dags.id` (with `onDelete: 'cascade'`)
- [ ] Update `schedulesRelations` to reference `dags` instead of `goals`
- [ ] Generate new migration: `pnpm --filter backend db:generate`
- [ ] Apply migration: `pnpm --filter backend db:push`
- [ ] Typecheck passes (`pnpm --filter backend build`)

### US-005: Merge CronScheduler into DAGScheduler
**Description:** As a developer, I want to merge useful scheduling functionality from `CronScheduler` into `DAGScheduler` and then remove `CronScheduler` entirely.

**Acceptance Criteria:**
- [ ] Review `CronScheduler` for any scheduling features not in `DAGScheduler` (missed schedule detection, etc.)
- [ ] Migrate any useful functionality to `DAGScheduler`
- [ ] Delete `packages/backend/src/scheduler/cron.ts`
- [ ] Update any imports of `CronScheduler` to use `DAGScheduler`
- [ ] Typecheck passes (`pnpm --filter backend build`)

### US-006: Remove AgentOrchestrator
**Description:** As a developer, I want to remove the `AgentOrchestrator` class entirely since it's no longer needed.

**Acceptance Criteria:**
- [ ] Delete `packages/backend/src/agent/orchestrator.ts`
- [ ] Remove any imports of `AgentOrchestrator` from other files
- [ ] Typecheck passes (`pnpm --filter backend build`)

### US-007: Update Server Startup
**Description:** As a developer, I want to update the server startup to remove CronScheduler and related references.

**Acceptance Criteria:**
- [ ] Remove `CronScheduler` import from `server.ts`
- [ ] Remove `scheduler` instantiation from `server.ts`
- [ ] Remove `scheduler` from `/health/ready` endpoint stats
- [ ] Remove `scheduler.start()` and `scheduler.stop()` calls
- [ ] Remove scheduler logging from startup
- [ ] Keep `DAGScheduler` as the sole scheduler
- [ ] Typecheck passes (`pnpm --filter backend build`)

### US-008: Clean Up Shared Package References
**Description:** As a developer, I want to remove goal/run-related schemas and utilities from the shared package if they exist.

**Acceptance Criteria:**
- [ ] Search shared package for goal/run schemas (`createGoalSchema`, `updateGoalSchema`, `goalParamsSchema`, etc.)
- [ ] Remove or deprecate unused schemas
- [ ] Remove `generateGoalId`, `generateRunId` if no longer used elsewhere
- [ ] Typecheck passes (`pnpm build`)

### US-009: Update OpenAPI Specification
**Description:** As a developer, I want to update the OpenAPI spec to remove goals and runs endpoints.

**Acceptance Criteria:**
- [ ] Remove all `/api/v1/goals` endpoints from `openapi.yaml`
- [ ] Remove all `/api/v1/runs` endpoints from `openapi.yaml`
- [ ] Remove associated request/response schemas for goals and runs
- [ ] Regenerate API clients: `pnpm generate`
- [ ] Verify generated clients: `pnpm test:check-generate`

### US-010: Update Documentation
**Description:** As a developer, I want to update AGENTS.md and README files to reflect the removed functionality.

**Acceptance Criteria:**
- [ ] Update `packages/backend/AGENTS.md` to remove Goals Management section
- [ ] Update `packages/backend/AGENTS.md` to remove Runs Management section
- [ ] Update database schema documentation to reflect removed tables
- [ ] Update root `AGENTS.md` if it references goals/runs

### US-011: Remove or Update Tests
**Description:** As a developer, I want to remove or update tests related to goals and runs.

**Acceptance Criteria:**
- [ ] Delete `packages/backend/src/__tests__/integration/goal-workflow.test.ts`
- [ ] Search for and remove any other goal/run related tests
- [ ] Ensure remaining tests pass: `pnpm --filter backend test`

### US-012: Final Verification
**Description:** As a developer, I want to verify the refactoring is complete with no regressions.

**Acceptance Criteria:**
- [ ] Full build passes: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] Lint passes: `pnpm lint`
- [ ] Backend starts successfully: `pnpm --filter backend dev`
- [ ] Health endpoints respond correctly
- [ ] DAG operations still work (create, execute, list)
- [ ] Agent operations still work (create, list, activate)
- [ ] Tools endpoint still works
- [ ] Task endpoint still works
- [ ] Artifacts endpoints still work

## Functional Requirements

- FR-1: Remove `POST /api/v1/goals` endpoint
- FR-2: Remove `GET /api/v1/goals` endpoint
- FR-3: Remove `GET /api/v1/goals/:id` endpoint
- FR-4: Remove `PATCH /api/v1/goals/:id` endpoint
- FR-5: Remove `DELETE /api/v1/goals/:id` endpoint
- FR-6: Remove `POST /api/v1/goals/:id/run` endpoint
- FR-7: Remove `POST /api/v1/goals/:id/pause` endpoint
- FR-8: Remove `POST /api/v1/goals/:id/resume` endpoint
- FR-9: Remove `GET /api/v1/runs` endpoint
- FR-10: Remove `GET /api/v1/runs/:id` endpoint
- FR-11: Remove `GET /api/v1/runs/:id/steps` endpoint
- FR-12: Remove `DELETE /api/v1/runs/:id` endpoint
- FR-13: Remove `goals` database table
- FR-14: Remove `runs` database table
- FR-15: Remove `steps` database table
- FR-16: Remove `memories` database table
- FR-17: Remove `outputs` database table
- FR-18: Modify `schedules` table to reference `dags` instead of `goals`
- FR-19: All existing DAG, Agent, Tool, Task, and Artifact endpoints must continue to function

## Non-Goals

- No changes to DAG execution logic
- No changes to Agent management functionality
- No changes to Tool definitions or registry
- No changes to Task execution endpoint
- No changes to Artifact storage/retrieval
- No new features or capabilities added
- No database data migration (assumes clean database or manual cleanup)

## Technical Considerations

- **Database Migration:** This is a destructive change. Assumes clean database or manual cleanup (no migration planning needed)
- **Foreign Key Dependencies:** The `schedules` table FK change requires careful migration ordering
- **Shared Package:** Changes may be needed in `@async-agent/shared` for schema removal
- **API Client Regeneration:** OpenAPI changes require regenerating JS/Python clients
- **Scheduler Consolidation:** `CronScheduler` will be merged into `DAGScheduler`, ensuring all scheduling features are preserved

## Success Metrics

- Zero references to removed tables (`goals`, `runs`, `steps`, `memories`, `outputs`) in codebase
- Zero references to removed classes (`CronScheduler`, `AgentOrchestrator`)
- All API endpoints except goals/runs return expected responses
- Build, lint, and test commands pass without errors
- No TypeScript type errors related to removed entities
- OpenAPI spec validates and clients generate successfully
- DAG scheduling continues to work correctly
