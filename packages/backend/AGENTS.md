# Backend - Developer Guide

Fastify-based API server with agent runtime, scheduler, and SQLite persistence.

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Configured `.env` file in project root (see [Environment Setup](#environment-setup))

### Development

```bash
# From monorepo root
pnpm --filter backend dev

# Or from this directory
pnpm dev
```

Server runs on `http://localhost:3000` (configurable via `PORT` in `.env`)

## Commands

### Development & Build

```bash
# Development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### Database Management

```bash
# Generate migration files after schema changes
pnpm db:generate

# Push schema changes to database
pnpm db:push

# Open Drizzle Studio (visual database explorer)
pnpm db:studio
```

### Cleanup

```bash
# Remove build artifacts
pnpm clean
```

## Environment Setup

Create a `.env` file in the **project root** directory (not in packages/backend):

### OpenAI Configuration
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# Optional
PORT=3000
LOG_LEVEL=info
```

### OpenRouter Configuration
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Optional
PORT=3000
LOG_LEVEL=info
```

### Ollama Configuration
```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Optional
PORT=3000
LOG_LEVEL=info
```

**Important**: Ensure Ollama is running:
```bash
ollama serve
ollama pull mistral
```

## Project Structure

```
backend/
├── src/
│   ├── app/
│   │   ├── server.ts          # Main server entry point
│   │   └── routes/            # API route handlers
│   ├── agent/
│   │   ├── orchestrator.ts    # Agent orchestration
│   │   ├── planner.ts         # Task planning
│   │   ├── dagExecutor.ts     # DAG execution engine
│   │   ├── tools/             # Tool definitions
│   │   └── providers/         # LLM providers
│   ├── db/
│   │   ├── schema.ts          # Database schema
│   │   └── queries.ts         # Database queries
│   ├── events/
│   │   └── bus.ts             # Event bus
│   ├── scheduler/
│   │   └── cron-scheduler.ts  # Cron job scheduler
│   └── util/
│       ├── env.ts             # Environment variables
│       └── logger.ts          # Logger configuration
├── dist/                      # Build output
├── data/                      # SQLite database files
├── scripts/                   # Utility scripts
├── drizzle.config.ts          # Drizzle ORM config
├── tsup.config.ts             # Build config
└── vitest.config.ts           # Test config
```

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Health & Status

- `GET /health` - Basic health check
- `GET /health/ready` - Detailed readiness with LLM and scheduler status

### Goals Management

- `POST /api/v1/goals` - Create a new goal
- `GET /api/v1/goals` - List all goals (optional `?status=` filter)
- `GET /api/v1/goals/:id` - Get goal details with schedules
- `PATCH /api/v1/goals/:id` - Update goal properties
- `DELETE /api/v1/goals/:id` - Delete goal and associated data
- `POST /api/v1/goals/:id/run` - Manually trigger goal execution
- `POST /api/v1/goals/:id/pause` - Pause a goal and deactivate its schedules
- `POST /api/v1/goals/:id/resume` - Resume a paused goal

### Runs Management

- `GET /api/v1/runs` - List all runs (optional `?status=` and `?goalId=` filters)
- `GET /api/v1/runs/:id` - Get run details
- `GET /api/v1/runs/:id/steps` - Get execution steps for a run
- `DELETE /api/v1/runs/:id` - Delete a run

### Agents

- `GET /api/v1/agents` - List all agents (optional `?name=` and `?active=` filters)
- `POST /api/v1/agents` - Create a new agent
- `GET /api/v1/agents/:id` - Get agent details
- `PATCH /api/v1/agents/:id` - Update agent
- `DELETE /api/v1/agents/:id` - Delete agent (cannot delete active agents)
- `POST /api/v1/agents/:id/activate` - Activate an agent version
- `GET /api/v1/agents/resolve/:name` - Get the active agent for a given name

### Tools

- `GET /api/v1/tools` - List all available tools (optional `?name=` to get specific tool)

### DAG Operations

- `POST /api/v1/create-dag` - Create a DAG from goal text
- `POST /api/v1/execute-dag` - Execute a previously created DAG
- `POST /api/v1/create-and-execute-dag` - Create and immediately execute a DAG
- `POST /api/v1/resume-dag/:executionId` - Resume a suspended or failed DAG execution
- `POST /api/v1/dag-run` - Run a previously created DAG by dagId
- `POST /api/v1/dag-experiments` - Run DAG experiments across multiple models/temperatures
- `GET /api/v1/dags` - List all DAGs with optional status filtering and pagination
- `GET /api/v1/dags/scheduled` - List all DAGs with cron schedules
- `GET /api/v1/dags/:id` - Get DAG by ID
- `GET /api/v1/dags/:id/executions` - Get all executions for a specific DAG
- `PATCH /api/v1/dags/:id` - Update DAG (status, result, params, schedule)
- `DELETE /api/v1/dags/:id` - Delete a DAG (only if no executions exist)
- `GET /api/v1/dag-executions` - List DAG executions with optional filtering
- `GET /api/v1/dag-executions/:id` - Get DAG execution details with sub-steps
- `DELETE /api/v1/dag-executions/:id` - Delete DAG execution and all its sub-steps
- `GET /api/v1/dag-executions/:id/sub-steps` - Get all sub-steps for a DAG execution
- `GET /api/v1/dag-executions/:id/events` - Stream DAG execution events (SSE)

### Task Execution

- `POST /api/v1/task` - Execute a task with an agent and optional file attachments (multipart)

### Artifacts

- `GET /api/v1/artifacts` - List all artifact filenames
- `GET /api/v1/artifacts/:filename` - Retrieve a specific artifact file

See [../../openapi.yaml](../../openapi.yaml) for complete API specification.

## Database Schema

Uses Drizzle ORM with SQLite for persistence:

- **goals** - Goal definitions and configurations
- **schedules** - Cron schedules for goals
- **runs** - Execution runs and their status
- **steps** - Individual execution steps within runs
- **agents** - Agent configurations
- **memories** - Agent memory entries
- **outputs** - Run output artifacts

## Development Workflow

### Making Schema Changes

1. Edit `src/db/schema.ts`
2. Generate migration: `pnpm db:generate`
3. Apply changes: `pnpm db:push`
4. Review in Drizzle Studio: `pnpm db:studio`

### Adding New Routes

1. Create route handler in `src/app/routes/`
2. Register route in `src/app/server.ts`
3. Add validation schemas (Zod)
4. Update `openapi.yaml` in project root

### Adding New Tools

1. Define tool in `src/agent/tools/`
2. Register in tool registry
3. Add Zod schema for parameters
4. Test with agent runtime

## Logging

Uses Pino for structured logging:

```typescript
import { logger } from './util/logger.js';

logger.info('Message');
logger.error({ err, context }, 'Error occurred');
logger.debug({ data }, 'Debug info');
```

**Never use `console.log()`** - always use the logger.

## Error Handling

All routes should use proper error handling:

```typescript
try {
  // Route logic
} catch (error) {
  logger.error({ error }, 'Operation failed');
  return reply.code(500).send({ error: 'Internal server error' });
}
```

## Testing

Tests use Vitest. Run tests before committing:

```bash
pnpm test
```

View coverage:

```bash
pnpm test:coverage
```

## Common Issues

### Port Already in Use
Change `PORT` in `.env` file

### Database Locked
- Stop all running backend instances
- Delete `data/*.db-wal` and `data/*.db-shm` files if needed

### LLM Provider Errors
- Verify API key is valid and has sufficient credits
- For Ollama: ensure `ollama serve` is running
- Check model name matches available models

### Hot Reload Not Working
- Ensure using `pnpm dev` not `pnpm start`
- Check for TypeScript compilation errors

## Dependencies

### Core
- **fastify** - Web framework
- **drizzle-orm** - Database ORM
- **better-sqlite3** - SQLite driver
- **zod** - Schema validation
- **openai** - OpenAI SDK (used for all providers)
- **node-cron** - Cron scheduler

### Tools
- **tsx** - TypeScript execution
- **tsup** - Build tool
- **vitest** - Testing framework
- **drizzle-kit** - Database migrations

## Production Deployment

1. Build the application:
   ```bash
   pnpm build
   ```

2. Set environment variables in production

3. Start the server:
   ```bash
   NODE_ENV=production pnpm start
   ```

4. Consider using a process manager like PM2:
   ```bash
   pm2 start dist/server.js --name async-agent-backend
   ```
