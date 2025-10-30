# Async Agent System

A monorepo-based autonomous agent system that runs persistent, background AI agents with multi-provider LLM support (OpenAI, OpenRouter, Ollama).

## Features

- 🤖 **Autonomous Agents** - LLM-powered decision making with tool selection
- 🔄 **Asynchronous Execution** - Background processing with cron scheduling
- 💾 **Persistent State** - SQLite database maintains state across restarts
- 🛠️ **Tool System** - Extensible tool registry (web search, fetch, file ops, webhooks, email)
- 🎯 **Goal-Oriented** - High-level objectives drive multi-step autonomous plans
- 🔌 **Multi-Provider LLM** - Support for OpenAI, OpenRouter, and Ollama (local models)
- ✅ **Tool Calling Validation** - Startup checks ensure model compatibility

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Clients                            │
├──────────────┬──────────────┬──────────────────────┤
│     CLI      │  Web Client  │   API (programmatic) │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       └──────────────┴──────────────────┘
                      │
              ┌───────▼────────┐
              │  Backend API   │
              │   (Fastify)    │
              └───────┬────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼───┐   ┌───▼────┐  ┌───▼─────┐
    │Scheduler│   │ Agent  │  │ Tools   │
    │(cron)   │   │Runtime │  │Registry │
    └────┬───┘   └───┬────┘  └─────────┘
         │           │
         └─────┬─────┘
               │
        ┌──────▼──────┐
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
git clone <repo-url>
cd async-agent

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

### Start the Backend

```bash
# Development mode
pnpm --filter backend dev

# Production mode
pnpm --filter backend start
```

The server will start on `http://localhost:3000` (configurable via `PORT` in `.env`).

### Use the CLI

```bash
# Install CLI globally (optional)
cd packages/cli
pnpm build
npm link

# Or use directly
pnpm --filter cli dev

# Available commands
async-agent init              # Initialize configuration
async-agent goal create       # Create a new goal
async-agent goal list         # List all goals
async-agent run list          # List all runs
async-agent server status     # Check server status
```

## Project Structure

```
async-agent/
├── packages/
│   ├── shared/              # Shared types, schemas, utilities
│   │   ├── src/
│   │   │   ├── types/       # TypeScript types
│   │   │   ├── schemas/     # Zod validation schemas
│   │   │   └── utils/       # Utility functions
│   │   └── package.json
│   │
│   ├── backend/             # Fastify API + Agent Runtime
│   │   ├── src/
│   │   │   ├── app/         # Server and routes
│   │   │   ├── agent/       # Agent orchestrator, planner, providers
│   │   │   ├── scheduler/   # Cron scheduling
│   │   │   ├── db/          # Database schema and client
│   │   │   └── util/        # Logger, env validation
│   │   └── package.json
│   │
│   └── cli/                 # Command-line interface
│       ├── src/
│       │   ├── commands/    # CLI commands
│       │   └── lib/         # API client, config
│       └── package.json
│
├── .env.example             # Environment template
├── pnpm-workspace.yaml      # Workspace configuration
└── package.json             # Root package
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

Create a goal that runs every Friday at 4pm:

```bash
async-agent goal create \
  --objective "Collect top AI news, summarize by category, and email me" \
  --schedule "0 16 * * 5" \
  --webhook "https://my-webhook.com/notify"
```

The agent will autonomously:
1. Search the web for recent AI news
2. Fetch and extract content from articles
3. Categorize and summarize findings
4. Save results to a markdown file
5. Send webhook notification on completion

## Development

```bash
# Install dependencies
pnpm install

# Run backend in dev mode
pnpm --filter backend dev

# Run CLI in dev mode
pnpm --filter cli dev

# Build all packages
pnpm build

# Clean all build outputs
pnpm clean
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

## Technology Stack

### Backend
- **Fastify** - Fast HTTP server with schema validation
- **Drizzle ORM** - Type-safe SQLite ORM
- **node-cron** - Job scheduling
- **OpenAI SDK** - OpenAI/OpenRouter integration
- **ollama** - Local model support
- **Pino** - Structured logging

### CLI
- **Commander** - CLI framework
- **Inquirer** - Interactive prompts
- **Chalk** - Colored output
- **Ora** - Spinners and progress indicators

### Shared
- **TypeScript** - Type safety across packages
- **Zod** - Runtime validation
- **pnpm workspaces** - Monorepo management

## Roadmap

- [x] Monorepo setup with pnpm workspaces
- [x] Multi-provider LLM abstraction layer
- [x] Shared types and schemas
- [x] Basic backend structure
- [x] Basic CLI structure
- [ ] Database schema and migrations
- [ ] Agent orchestrator and planner
- [ ] Tool registry and core tools
- [ ] Scheduler implementation
- [ ] Complete CLI commands
- [ ] Web dashboard (future)

## License

MIT

## Contributing

Contributions welcome! Please read the implementation plan in [ASYNC_AGENT_PLAN.md](./ASYNC_AGENT_PLAN.md) for architecture details.
