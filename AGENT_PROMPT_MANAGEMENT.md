# Agent System Prompt Management Implementation

## Overview

This document describes the implementation of the agent system prompt management feature, allowing dynamic prompt templates to be stored in the database and associated with goals.

## Changes Summary

### 1. Database Schema

**File:** `packages/backend/src/db/schema.ts`

Added new `agents` table with the following structure:

```typescript
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  promptTemplate: text('prompt_template').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueNameVersion: uniqueIndex('idx_name_version').on(table.name, table.version),
  uniqueActiveNameIdx: uniqueIndex('idx_active_agent').on(table.name).where(sql`${table.active} = 1`),
}));
```

**Key Features:**
- Unique constraint on (name, version) to prevent duplicates
- Partial unique index ensuring only one active agent per name
- agentId field added to goals table for association

### 2. Agent Management API

**File:** `packages/backend/src/app/routes/agents.ts`

Implemented RESTful API endpoints:

- `POST /api/v1/agents` - Create new agent
- `GET /api/v1/agents` - List agents (with optional name/active filters)
- `GET /api/v1/agents/:id` - Get agent by ID
- `POST /api/v1/agents/:id/activate` - Activate agent (deactivates others with same name)
- `DELETE /api/v1/agents/:id` - Delete agent (prevents deletion of active agents)
- `GET /api/v1/agents/resolve/:name` - Get active agent by name

### 3. Goal Creation Updates

**File:** `packages/backend/src/app/routes/goals.ts`

Modified POST /goals endpoint to:
- Accept optional `agentName` or `agentId` in request body
- Resolve active agent when `agentName` is provided
- Validate agent exists when `agentId` is provided
- Fallback to active `defaultAgent` if no agent specified
- Store resolved `agentId` in goals table

**File:** `packages/shared/src/schemas/goal.ts`

Updated schema to include:
```typescript
agentName: z.string().optional(),
agentId: z.string().optional(),
```

### 4. Planner Updates

**File:** `packages/backend/src/agent/planner.ts`

Modified `AgentPlanner` class to:
- Accept optional `promptTemplate` parameter in constructor
- Use template-based prompt building with placeholder interpolation
- Support template variables: `{{objective}}`, `{{toolsList}}`, `{{stepsRemaining}}`, `{{workingMemory}}`
- Fallback to hardcoded default prompt if no template provided

### 5. Orchestrator Updates

**File:** `packages/backend/src/agent/orchestrator.ts`

Modified `AgentOrchestrator.executeRun()` to:
- Fetch agent prompt template based on goal's agentId
- Create planner instance with resolved template for each run
- Ensure prompt template is specific to each goal execution

### 6. Database Seeding

**File:** `packages/backend/src/db/seed.ts`

Created seeding mechanism to:
- Create `defaultAgent` with version `1.0.0` on startup
- Use the standard hardcoded prompt as the template
- Mark as active by default
- Skip creation if already exists

**File:** `packages/backend/src/app/server.ts`

Added seed call during server startup.

## Template Placeholder System

Prompt templates support the following placeholders:

| Placeholder | Description | Example Value |
|------------|-------------|---------------|
| `{{objective}}` | The goal's objective | "Analyze sales data and generate report" |
| `{{toolsList}}` | Available tools formatted as list | "- webSearch: Search the web\n- fileWrite: Write to file" |
| `{{stepsRemaining}}` | Number of steps left in budget | "10" |
| `{{workingMemory}}` | JSON serialized working memory | '{"lastAction": "searched web", ...}' |

## Usage Examples

### Creating a New Agent

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "dataAnalyst",
    "version": "1.0.0",
    "promptTemplate": "You are a data analyst agent...\n\nObjective: {{objective}}\n\nTools:\n{{toolsList}}"
  }'
```

### Activating an Agent

```bash
curl -X POST http://localhost:3000/api/v1/agents/{agentId}/activate
```

### Creating Goal with Specific Agent

```bash
curl -X POST http://localhost:3000/api/v1/goals \
  -H "Content-Type: application/json" \
  -d '{
    "objective": "Analyze Q4 sales data",
    "agentName": "dataAnalyst"
  }'
```

## Migration

Run database migration to apply schema changes:

```bash
pnpm --filter backend db:push
```

Or for production, use the generated migration:

```bash
# Migration file: packages/backend/src/db/migrations/0000_wet_luckman.sql
```

## Benefits

1. **Flexibility**: System prompts can be updated without code changes
2. **Versioning**: Multiple versions of agents can coexist
3. **A/B Testing**: Different prompt strategies can be tested
4. **Specialization**: Domain-specific agents with tailored prompts
5. **Rollback**: Easy to revert by activating previous version
6. **Auditability**: Track prompt changes over time

## Future Enhancements

- Prompt template validation
- Prompt performance metrics
- Automated A/B testing framework
- Template library/marketplace
- Prompt optimization suggestions
- Version diff/comparison tools
