# Async Agent - Monorepo Developer Guide

A monorepo containing an autonomous async agent system with multi-provider LLM support.

## Project Structure

```
asyncAgent/
├── packages/
│   ├── backend/       # Fastify API server, agent runtime, scheduler
│   ├── webApp/        # SvelteKit web interface
│   ├── cli/           # Command-line interface
│   ├── repl/          # Interactive REPL
│   └── shared/        # Shared types, schemas, utilities, API clients
├── data/              # SQLite database (runtime)
├── artifacts/         # Agent output files (runtime)
└── scripts/           # Build and utility scripts
```

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## Quick Start

### Installation

```bash
pnpm install
```

### Environment Setup

Copy `.env.example` to `.env` in the root directory and configure your LLM provider:

#### OpenAI
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
```

#### OpenRouter
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

#### Ollama (Local)
```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Ensure Ollama is running:
# ollama serve
# ollama pull mistral
```

## Development Commands

### Build All Packages

```bash
# Build all packages in dependency order
pnpm build

# Run tests across all packages
pnpm test

# Run linting across all packages
pnpm lint

# Clean all build artifacts
pnpm clean
```

### Development Workflow

```bash
# Start backend in development mode (hot reload)
pnpm dev
# Or explicitly:
pnpm --filter backend dev

# Start web application in development mode
pnpm --filter @async-agent/webapp dev

# Access the web UI at http://localhost:5173
# Backend API runs at http://localhost:3000
```

### Generate API Clients

```bash
# Generate both JS and Python API clients from OpenAPI spec
pnpm generate

# Verify generated clients match spec
pnpm test:check-generate
```

## Package-Specific Commands

### Backend

```bash
# Development
pnpm --filter backend dev

# Build
pnpm --filter backend build

# Start (production)
pnpm --filter backend start

# Testing
pnpm --filter backend test
pnpm --filter backend test:ui
pnpm --filter backend test:coverage

# Database
pnpm --filter backend db:generate   # Generate migrations
pnpm --filter backend db:push       # Push schema changes
pnpm --filter backend db:studio     # Open Drizzle Studio
```

See [packages/backend/AGENTS.md](packages/backend/AGENTS.md) for backend-specific details.

### WebApp

```bash
# Development
pnpm --filter @async-agent/webapp dev

# Build
pnpm --filter @async-agent/webapp build

# Preview production build
pnpm --filter @async-agent/webapp preview

# Type checking
pnpm --filter @async-agent/webapp check
pnpm --filter @async-agent/webapp check:watch
```

See [packages/webApp/AGENTS.md](packages/webApp/AGENTS.md) for webapp-specific details.

## API Documentation

Base URL: `http://localhost:3000/api/v1`

For complete endpoint documentation including Goals, Runs, Agents, Tools, and DAG Operations, see [packages/backend/AGENTS.md](packages/backend/AGENTS.md).

See [openapi.yaml](openapi.yaml) for complete API specification.

## Code Style & Conventions

- **TypeScript**: Strict mode enabled
- **Modules**: ESM only (not CommonJS)
- **Logging**: Use `logger` (never `console.log`)
- **Validation**: Use Zod schemas for all inputs
- **Error Handling**: Proper try/catch blocks required

## Common Issues

### Port Already in Use
Change `PORT` in `.env` (default: 3000)

### Database Locked
Stop all running backend instances

### LLM Provider Errors
- Verify API keys are valid
- For Ollama: ensure server is running (`ollama serve`)
- Check model supports tool calling

### Build Errors
```bash
pnpm clean
rm -rf node_modules
pnpm install
pnpm build
```

## Technology Stack

- **Backend**: Fastify, Drizzle ORM, SQLite, Node-cron
- **WebApp**: SvelteKit 5, TailwindCSS, Vite
- **Shared**: Zod, TypeScript, OpenAI SDK
- **Testing**: Vitest
- **Tooling**: pnpm workspaces, tsx, tsup
