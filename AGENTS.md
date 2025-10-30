# Async Agent - Developer Guide

## Commands

### Install Dependencies
```bash
pnpm install
```

### Build
```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @async-agent/shared build
pnpm --filter @async-agent/backend build
pnpm --filter @async-agent/cli build
```

### Development

```bash
# Run backend in dev mode (with hot reload)
pnpm --filter backend dev

# Run CLI in dev mode
pnpm --filter cli dev
```

### Database

```bash
# Generate migrations (after schema changes)
pnpm --filter backend db:generate

# Run migrations
pnpm --filter backend db:migrate

# Open Drizzle Studio (DB GUI)
pnpm --filter backend db:studio
```

### Production

```bash
# Build all packages
pnpm build

# Start backend
pnpm --filter backend start

# Or with environment
NODE_ENV=production pnpm --filter backend start
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

### For OpenAI
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
```

### For OpenRouter
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### For Ollama (Local)
```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Make sure Ollama is running:
# ollama serve
# ollama pull mistral
```

## Project Structure

- `packages/shared` - Shared types, schemas, and utilities
- `packages/backend` - Fastify API, agent runtime, scheduler
- `packages/cli` - Command-line interface
- `docs/` - Documentation
- `data/` - SQLite database (created at runtime)
- `artifacts/` - Agent output files (created at runtime)

## Code Style

- TypeScript strict mode enabled
- ESM modules (not CommonJS)
- Use `logger` for all logging (never console.log)
- Validate inputs with Zod schemas
- Use proper error handling with try/catch

## Testing

```bash
# TODO: Add test commands when tests are implemented
# pnpm test
# pnpm --filter backend test
```

## Common Issues

### Port already in use
Change `PORT` in `.env` file (default: 3000)

### Database locked
Stop all running instances of the backend

### LLM provider errors
- Check API keys are valid
- For Ollama, ensure server is running: `ollama serve`
- Verify model supports tool calling

### Build errors
```bash
pnpm clean
rm -rf node_modules
pnpm install
pnpm build
```

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Goals
- `POST /goals` - Create goal
- `GET /goals` - List goals
- `GET /goals/:id` - Get goal
- `PATCH /goals/:id` - Update goal
- `DELETE /goals/:id` - Delete goal
- `POST /goals/:id/run` - Trigger run
- `POST /goals/:id/pause` - Pause goal
- `POST /goals/:id/resume` - Resume goal

### Runs
- `GET /runs` - List runs
- `GET /runs/:id` - Get run
- `GET /runs/:id/steps` - Get run steps
- `DELETE /runs/:id` - Delete run

### Health
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check with system status
