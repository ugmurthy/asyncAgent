# Async Agent System

A monorepo-based autonomous agent system that runs persistent, background AI agents with multi-provider LLM support (OpenAI, OpenRouter, Ollama), featuring DAG-based task execution and a modern web interface.

## Features

- 🤖 **Autonomous Agents** - LLM-powered decision making with tool selection
- 🔄 **DAG Execution** - Directed Acyclic Graph task decomposition and parallel execution
- ⏰ **Scheduled Tasks** - Cron-based scheduling with timezone support
- 💾 **Persistent State** - SQLite database maintains state across restarts
- 🛠️ **Tool System** - Extensible tool registry (web search, fetch, file ops, webhooks, email)
- 🎯 **Goal-Oriented** - High-level objectives drive multi-step autonomous plans
- 🔌 **Multi-Provider LLM** - Support for OpenAI, OpenRouter, and Ollama (local models)
- 🌐 **Web Dashboard** - Modern SvelteKit interface for monitoring and management
- 📡 **Real-time Events** - Server-Sent Events (SSE) for live execution updates
- ✅ **Tool Calling Validation** - Startup checks ensure model compatibility

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Clients                             │
├──────────┬──────────────┬──────────────┬───────────────┤
│   CLI    │   Web App    │     REPL     │  API Client   │
│          │  (SvelteKit) │              │   (JS/Python) │
└────┬─────┴──────┬───────┴──────┬───────┴───────┬───────┘
     │            │              │               │
     └────────────┴──────────────┴───────────────┘
                          │
                  ┌───────▼────────┐
                  │  Backend API   │
                  │   (Fastify)    │
                  └───────┬────────┘
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
  ┌────▼────┐      ┌─────▼─────┐      ┌─────▼─────┐
  │   DAG   │      │   Agent   │      │   Tool    │
  │Scheduler│      │  Runtime  │      │ Registry  │
  └────┬────┘      └─────┬─────┘      └───────────┘
       │                 │
       │    ┌────────────┘
       │    │
  ┌────▼────▼───┐
  │  SQLite DB  │
  │  (Drizzle)  │
  └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- One of:
  - OpenAI API key
  - OpenRouter API key
  - Ollama running locally

### Installation

```bash
# Clone the repository
git clone https://github.com/ugmurthy/asyncAgent.git
cd asyncAgent

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your LLM provider settings

# Build all packages
pnpm build
```

### Configuration

Edit `.env` with your preferred LLM provider:

**For OpenAI:**
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
```

**For OpenRouter:**
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

**For Ollama (Local):**
```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

### Start the System

```bash
# Start backend in development mode
pnpm dev

# Start web application (in another terminal)
pnpm --filter @async-agent/webapp dev
```

- Backend API: `http://localhost:3000`
- Web Dashboard: `http://localhost:5173`

## Project Structure

```
asyncAgent/
├── packages/
│   ├── backend/              # Fastify API + Agent Runtime
│   │   ├── src/
│   │   │   ├── app/          # Server and routes
│   │   │   ├── agent/        # DAG executor, planner, providers
│   │   │   ├── scheduler/    # DAG scheduling
│   │   │   ├── db/           # Database schema and migrations
│   │   │   └── events/       # Event bus for SSE
│   │   └── package.json
│   │
│   ├── webApp/               # SvelteKit Web Interface
│   │   ├── src/
│   │   │   ├── routes/       # File-based routing
│   │   │   └── lib/          # Components, stores, utilities
│   │   └── package.json
│   │
│   ├── shared/               # Shared types, schemas, utilities
│   │   ├── src/
│   │   ├── js-client/        # Auto-generated JS API client
│   │   └── python-client/    # Auto-generated Python API client
│   │
│   ├── cli/                  # Command-line interface
│   ├── repl/                 # Interactive REPL
│   └── tui/                  # Terminal UI
│
├── openapi.yaml              # API specification
├── .env.example              # Environment template
├── pnpm-workspace.yaml       # Workspace configuration
└── package.json              # Root package
```

## Available Tools

The agent runtime includes these built-in tools:

| Tool | Description |
|------|-------------|
| `web_search` | Search the web using DuckDuckGo |
| `fetch_page` | Fetch and extract content from a URL |
| `fetch_urls` | Fetch multiple URLs in parallel |
| `write_file` | Write content to a file |
| `read_file` | Read content from a file |
| `send_webhook` | Send HTTP webhook requests |
| `send_email` | Send emails (requires SMTP configuration) |

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Core Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /health/ready` | Readiness with LLM and scheduler status |

### Goals & Runs

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/goals` | Create a new goal |
| `GET /api/v1/goals` | List all goals |
| `POST /api/v1/goals/:id/run` | Trigger goal execution |
| `GET /api/v1/runs` | List all runs |
| `GET /api/v1/runs/:id/steps` | Get execution steps |

### DAG Operations

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/create-dag` | Create a DAG from goal text |
| `POST /api/v1/execute-dag` | Execute a DAG |
| `POST /api/v1/resume-dag/:id` | Resume a suspended DAG |
| `GET /api/v1/dags` | List all DAGs |
| `GET /api/v1/dag-executions` | List DAG executions |
| `GET /api/v1/dag-executions/:id/events` | Stream execution events (SSE) |

### Task Execution

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/task` | Execute a task with an agent |
| `GET /api/v1/tools` | List available tools |
| `GET /api/v1/agents` | List agents |

See [openapi.yaml](./openapi.yaml) for complete API specification.

## Development

```bash
# Install dependencies
pnpm install

# Run backend in dev mode (hot reload)
pnpm dev

# Run web app in dev mode
pnpm --filter @async-agent/webapp dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Clean all build outputs
pnpm clean

# Generate API clients from OpenAPI spec
pnpm generate
```

### Database

```bash
# Generate migrations (after schema changes)
pnpm --filter backend db:generate

# Push schema changes to database
pnpm --filter backend db:push

# Open Drizzle Studio (DB GUI)
pnpm --filter backend db:studio
```

## LLM Provider Support

### OpenAI
- **Models**: gpt-4, gpt-4-turbo, gpt-4o, gpt-3.5-turbo (1106+)
- **Validation**: Whitelist check for tool calling support
- **Setup**: Requires `OPENAI_API_KEY`

### OpenRouter
- **Models**: All models with function calling support
- **Validation**: Runtime API check for capabilities
- **Setup**: Requires `OPENROUTER_API_KEY`

### Ollama (Local)
- **Models**: mistral, mixtral, llama2 (tool support variants)
- **Validation**: Sample tool call test at startup
- **Setup**: Requires Ollama server running at `OLLAMA_BASE_URL`

The system validates tool calling support at startup and fails fast if the selected model is incompatible.

## Example Use Case: AI News Monitor

Create a DAG that searches and summarizes AI news:

```bash
curl -X POST http://localhost:3000/api/v1/create-dag \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Search for the latest AI news, summarize the top 5 articles, and save to a markdown file",
    "schedule": "0 9 * * *",
    "timezone": "America/New_York"
  }'
```

The agent will autonomously:
1. Decompose the goal into a DAG of tasks
2. Search the web for recent AI news
3. Fetch and extract content from articles
4. Summarize findings using the LLM
5. Save results to a markdown file
6. Execute on schedule (daily at 9 AM ET)

## Technology Stack

### Backend
- **Fastify** - Fast HTTP server with schema validation
- **Drizzle ORM** - Type-safe SQLite ORM
- **node-cron** - Job scheduling
- **OpenAI SDK** - LLM integration
- **Pino** - Structured logging

### Web App
- **SvelteKit 5** - Full-stack framework
- **TailwindCSS** - Utility-first CSS
- **bits-ui** - Accessible UI components
- **Lucide Svelte** - Icons

### Shared
- **TypeScript** - Type safety across packages
- **Zod** - Runtime validation
- **pnpm workspaces** - Monorepo management

## Roadmap

- [x] Monorepo setup with pnpm workspaces
- [x] Multi-provider LLM abstraction layer
- [x] Shared types and schemas
- [x] Backend API structure
- [x] Database schema and migrations
- [x] DAG executor and planner
- [x] Tool registry and core tools
- [x] DAG scheduler with cron support
- [x] Auto-generated API clients (JS/Python)
- [x] Web dashboard (SvelteKit)
- [x] Real-time events (SSE)
- [x] Suspended state and resume functionality
- [ ] CLI improvements
- [ ] WebSocket support for bidirectional communication
- [ ] Agent memory and learning
- [ ] Plugin system for custom tools

## License

MIT

## Contributing

Contributions welcome! See [AGENTS.md](./AGENTS.md) for development guidelines.
