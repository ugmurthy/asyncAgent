# Async Agent System - Implementation Plan

## Overview

A monorepo-based async agent system that runs autonomous, persistent, background AI agents. The system includes:
- **Backend** - Fastify API + Agent Runtime + Scheduler
- **CLI** - Command-line interface for managing agents and goals
- **Web Client** (future) - Dashboard for monitoring and control

## Architecture

### High-Level Components

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

### Core Characteristics

1. **Autonomy** - LLM-based decision making with tool selection
2. **Persistence** - SQLite database maintains state across restarts
3. **Tool Use** - Web search, fetch pages, file operations, webhooks, email
4. **Asynchronous** - Background execution with scheduling
5. **Goal-oriented** - High-level objectives drive multi-step plans

## Technology Stack

### Monorepo Management
- **pnpm workspaces** - package management
- **Turborepo** (optional) - build caching and orchestration
- **tsup** - fast TypeScript bundling for packages

### Backend
- **Fastify** - HTTP API with schema validation
- **Drizzle ORM** - SQLite persistence
- **better-sqlite3** - SQLite driver
- **node-cron** - scheduling
- **p-queue** - concurrency control
- **LLM Providers**:
  - **OpenAI SDK** - OpenAI/OpenRouter function calling
  - **ollama** - Local model support
  - Provider abstraction layer with tool calling validation
- **zod** - schema validation
- **Pino** - structured logging

### CLI
- **commander** - CLI framework
- **inquirer** - interactive prompts
- **chalk** - colored output
- **ora** - spinners and progress
- **cli-table3** - formatted tables
- **date-fns** - date formatting

### Shared
- **TypeScript** - type safety across packages
- **zod** - shared schemas
- **nanoid** - ID generation

## Monorepo Structure

```
async-agent/
├── packages/
│   ├── backend/              # Fastify API + Agent Runtime
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── server.ts
│   │   │   │   └── routes/
│   │   │   │       ├── goals.ts
│   │   │   │       ├── runs.ts
│   │   │   │       └── health.ts
│   │   │   ├── agent/
│   │   │   │   ├── orchestrator.ts
│   │   │   │   ├── planner.ts
│   │   │   │   ├── memory.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── index.ts      # LLM provider factory
│   │   │   │   │   ├── openai.ts     # OpenAI provider
│   │   │   │   │   ├── openrouter.ts # OpenRouter provider
│   │   │   │   │   ├── ollama.ts     # Ollama provider
│   │   │   │   │   └── validator.ts  # Tool calling validation
│   │   │   │   └── tools/
│   │   │   │       ├── index.ts
│   │   │   │       ├── webSearch.ts
│   │   │   │       ├── fetchPage.ts
│   │   │   │       ├── writeFile.ts
│   │   │   │       ├── readFile.ts
│   │   │   │       ├── sendWebhook.ts
│   │   │   │       └── sendEmail.ts
│   │   │   ├── scheduler/
│   │   │   │   ├── cron.ts
│   │   │   │   └── queue.ts
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── client.ts
│   │   │   │   └── migrations/
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── util/
│   │   │       ├── logger.ts
│   │   │       ├── retry.ts
│   │   │       └── id.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                  # Command-line interface
│   │   ├── src/
│   │   │   ├── index.ts      # CLI entry point
│   │   │   ├── commands/
│   │   │   │   ├── init.ts         # Initialize config
│   │   │   │   ├── goal/
│   │   │   │   │   ├── create.ts   # Create goal
│   │   │   │   │   ├── list.ts     # List goals
│   │   │   │   │   ├── show.ts     # Show goal details
│   │   │   │   │   ├── delete.ts   # Delete goal
│   │   │   │   │   └── run.ts      # Trigger ad-hoc run
│   │   │   │   ├── run/
│   │   │   │   │   ├── list.ts     # List runs
│   │   │   │   │   ├── show.ts     # Show run details
│   │   │   │   │   ├── logs.ts     # Show run logs/steps
│   │   │   │   │   └── watch.ts    # Watch run in real-time
│   │   │   │   ├── server/
│   │   │   │   │   ├── start.ts    # Start backend
│   │   │   │   │   ├── stop.ts     # Stop backend
│   │   │   │   │   └── status.ts   # Server status
│   │   │   │   └── config/
│   │   │   │       ├── show.ts     # Show config
│   │   │   │       └── set.ts      # Set config values
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts   # Backend API client
│   │   │   │   ├── config.ts       # Config management
│   │   │   │   ├── formatters.ts   # Output formatting
│   │   │   │   └── validators.ts   # Input validation
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared/               # Shared types and utilities
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── goal.ts
│   │   │   │   ├── run.ts
│   │   │   │   ├── step.ts
│   │   │   │   ├── tool.ts
│   │   │   │   └── index.ts
│   │   │   ├── schemas/
│   │   │   │   ├── goal.ts        # Zod schemas
│   │   │   │   ├── run.ts
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   │       ├── id.ts
│   │   │       └── time.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                  # Future: Web dashboard
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── docs/
│   ├── getting-started.md
│   ├── cli-reference.md
│   ├── api-reference.md
│   └── examples/
│       ├── ai-news-monitor.md
│       └── daily-summary.md
│
├── scripts/
│   ├── dev.sh               # Start all services in dev mode
│   └── build.sh             # Build all packages
│
├── pnpm-workspace.yaml
├── package.json             # Root package.json
├── turbo.json              # Turborepo config (optional)
├── .env.example             # Example: PROVIDER, API keys, models
└── README.md
```

## Data Model (SQLite + Drizzle)

### Tables

```typescript
// goals table
{
  id: string (PK)
  objective: string
  params: json               // { stepBudget, allowedTools, constraints }
  webhookUrl?: string
  status: enum               // active, paused, archived
  createdAt: timestamp
  updatedAt: timestamp
}

// schedules table
{
  id: string (PK)
  goalId: string (FK)
  cronExpr: string          // "0 16 * * 5" for Fridays at 4pm
  timezone: string
  active: boolean
  createdAt: timestamp
}

// runs table
{
  id: string (PK)
  goalId: string (FK)
  status: enum              // pending, running, completed, failed
  startedAt?: timestamp
  endedAt?: timestamp
  workingMemory: json       // scratchpad for current run
  stepBudget: number
  stepsExecuted: number
  error?: string
  createdAt: timestamp
}

// steps table
{
  id: string (PK)
  runId: string (FK)
  stepNo: number
  thought: string           // LLM reasoning
  toolName?: string
  toolInput?: json
  observation?: string      // tool output
  durationMs: number
  error?: string
  createdAt: timestamp
}

// outputs table
{
  id: string (PK)
  runId: string (FK)
  kind: enum                // summary, file, webhook, email
  pathOrPayload: string     // file path or JSON payload
  createdAt: timestamp
}

// memories table (long-term knowledge)
{
  id: string (PK)
  goalId: string (FK)
  type: enum                // note, fact, artifact
  content: text
  metadata?: json
  createdAt: timestamp
}
```

### Indexes

- `goals(status, createdAt)`
- `schedules(active, goalId)`
- `runs(status, scheduledAt, goalId)`
- `steps(runId, stepNo)`
- `outputs(runId, kind)`
- `memories(goalId, type, createdAt)`

## CLI Design

### Command Structure

```bash
# Initialize configuration
async-agent init

# Goal management
async-agent goal create <objective> [--schedule <cron>] [--webhook <url>]
async-agent goal list [--status active|paused|archived]
async-agent goal show <goal-id>
async-agent goal delete <goal-id>
async-agent goal pause <goal-id>
async-agent goal resume <goal-id>
async-agent goal run <goal-id>                    # Ad-hoc trigger

# Run management
async-agent run list [--goal <goal-id>] [--status pending|running|completed|failed]
async-agent run show <run-id>
async-agent run logs <run-id> [--follow]          # Stream steps
async-agent run watch <run-id>                    # Real-time updates

# Server management
async-agent server start [--port <port>] [--daemon]
async-agent server stop
async-agent server status

# Configuration
async-agent config show
async-agent config set <key> <value>
```

### CLI Features

**Interactive Mode**
```bash
async-agent goal create
# Prompts:
# ? What is the goal? (text input)
# ? Schedule? (cron expression or "none")
# ? Webhook URL? (optional)
# ? Step budget? (default: 20)
```

**Output Formatting**
- **Tables** - List views with cli-table3
- **JSON** - `--json` flag for programmatic use
- **Markdown** - `--format md` for reports
- **Streaming** - Real-time logs with ora spinners

**Configuration Management**
```bash
~/.async-agent/config.json
{
  "apiUrl": "http://localhost:3000",
  "apiKey": "...",
  "defaultStepBudget": 20,
  "outputFormat": "table"
}
```

## API Routes (Backend)

### Goals

```
POST   /api/v1/goals
GET    /api/v1/goals
GET    /api/v1/goals/:id
PATCH  /api/v1/goals/:id
DELETE /api/v1/goals/:id
POST   /api/v1/goals/:id/run
POST   /api/v1/goals/:id/pause
POST   /api/v1/goals/:id/resume
```

### Runs

```
GET    /api/v1/runs
GET    /api/v1/runs/:id
GET    /api/v1/runs/:id/steps
GET    /api/v1/runs/:id/outputs
GET    /api/v1/runs/:id/stream        # SSE for real-time updates
DELETE /api/v1/runs/:id
```

### Health & Metrics

```
GET    /health
GET    /health/ready
GET    /metrics                        # Prometheus format (optional)
```

## Agent Execution Flow

```
1. Goal Created
   ↓
2. Schedule Registered (if cron provided)
   ↓
3. Cron Tick / Manual Trigger
   ↓
4. Run Created (status: pending)
   ↓
5. Worker Claims Run
   - UPDATE runs SET status='running' WHERE id=? AND status='pending'
   ↓
6. Agent Loop (max steps: stepBudget)
   ├─ Load context (objective + working memory + recent steps)
   ├─ Call LLM with tools
   ├─ If tool call:
   │  ├─ Validate input (zod)
   │  ├─ Execute tool with timeout
   │  ├─ Record step (thought + tool + observation)
   │  └─ Update working memory
   ├─ If finish signal:
   │  └─ Break loop
   └─ Continue
   ↓
7. Finalize
   - Summarize outcome
   - Save outputs (files, summaries)
   - Send notifications (webhook/email)
   - Mark run completed/failed
   ↓
8. Next scheduled run (if applicable)
```

## Tool Registry

Each tool implements:

```typescript
interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
  toJSONSchema(): any;  // For LLM function calling (OpenAI/OpenRouter/Ollama format)
}

interface ToolContext {
  logger: Logger;
  db: DrizzleClient;
  runId: string;
  abortSignal: AbortSignal;
}
```

### Built-in Tools

1. **webSearch** - Search the web (DuckDuckGo API or RSS)
2. **fetchPage** - Fetch and extract text from URL (cheerio + html-to-text)
3. **readFile** - Read file from artifacts directory
4. **writeFile** - Write file to artifacts directory
5. **sendWebhook** - POST JSON to webhook URL
6. **sendEmail** - Send email via SMTP (nodemailer)

### Tool Security

- Whitelist allowed domains for fetch
- Sandbox file operations to `./artifacts` directory
- Timeout enforcement (default: 60s)
- Retry with exponential backoff
- Input validation with zod

## LLM Provider Configuration

### Provider Factory

```typescript
interface LLMProvider {
  name: string;
  callWithTools(params: LLMCallParams): Promise<LLMResponse>;
  validateToolCallSupport(model: string): Promise<{ supported: boolean; message?: string }>;
}

// Factory pattern
function createLLMProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model);
    case 'openrouter':
      return new OpenRouterProvider(config.apiKey, config.model);
    case 'ollama':
      return new OllamaProvider(config.baseUrl, config.model);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
```

### Model Validation

**OpenAI**:
- Supported models: gpt-4, gpt-4-turbo, gpt-4o, gpt-3.5-turbo (1106+)
- Validation: Check against known compatible models list
- Tool format: Native OpenAI function calling

**OpenRouter**:
- Supported models: Check via OpenRouter API model capabilities
- Validation: Query `/api/v1/models` endpoint for tool calling support
- Tool format: OpenAI-compatible function calling

**Ollama (Local)**:
- Supported models: mistral, mixtral, llama2 (with tool support variants)
- Validation: Test with sample tool call at startup
- Tool format: OpenAI-compatible function calling
- Health check: Verify Ollama server is running at base URL

### Startup Validation

```typescript
async function validateLLMSetup(provider: LLMProvider, model: string): Promise<void> {
  const result = await provider.validateToolCallSupport(model);
  if (!result.supported) {
    throw new Error(
      `Model ${model} does not support tool calling. ${result.message || ''}\n` +
      `Please use a compatible model or switch providers.`
    );
  }
  logger.info(`LLM provider validated: ${provider.name} with model ${model}`);
}
```

### Environment Variables

```bash
# .env.example

# LLM Provider (required): openai | openrouter | ollama
LLM_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# OpenRouter Configuration  
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Ollama Configuration (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Fallback model if provider-specific not set
LLM_MODEL=gpt-4o
```

## Example Use Cases

### 1. AI News Monitor

**Goal**: "Every Friday at 4pm UTC, collect top AI news, summarize by categories (research, product, policy), and email me"

**Schedule**: `0 16 * * 5`

**Execution Steps**:
1. webSearch({ query: "AI news this week", limit: 10 })
2. fetchPage(url) for each result
3. Aggregate and categorize in working memory
4. writeFile({ path: "summaries/2025-W43.md", content: summary })
5. sendEmail({ to: "user@example.com", subject: "Weekly AI News", body: summary })

### 2. Daily Code Metrics

**Goal**: "Every day at 9am, check GitHub repo stars/issues, write metrics to file"

**Schedule**: `0 9 * * *`

**Execution Steps**:
1. webSearch({ query: "github api fetch repo stats" })
2. fetchPage(githubApiUrl)
3. writeFile({ path: "metrics/2025-10-29.json", content: metrics })
4. sendWebhook({ url: "https://...", payload: metrics })

## Development Workflow

### Initial Setup

```bash
# Clone and install
git clone <repo>
cd async-agent
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with LLM_PROVIDER, API keys, model names, etc.
# Example for OpenAI: LLM_PROVIDER=openai, OPENAI_API_KEY=sk-..., LLM_MODEL=gpt-4o
# Example for Ollama: LLM_PROVIDER=ollama, OLLAMA_BASE_URL=http://localhost:11434, LLM_MODEL=mistral

# Run migrations
pnpm --filter backend db:migrate

# Start backend in dev mode
pnpm --filter backend dev

# In another terminal, use CLI
pnpm --filter cli dev goal create "Test goal"
```

### Scripts (package.json)

**Root**
```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
```

**Backend**
```json
{
  "scripts": {
    "dev": "tsx watch src/app/server.ts",
    "build": "tsup src/app/server.ts --format esm --dts",
    "start": "node dist/server.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

**CLI**
```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "start": "node dist/index.js"
  },
  "bin": {
    "async-agent": "./dist/index.js"
  }
}
```

## Security & Guardrails

### Rate Limiting
- Per-goal step budget (default: 20)
- Per-tool timeout (default: 60s)
- API rate limiting via @fastify/rate-limit

### Prompt Injection Mitigations
- Strict system prompts
- HTML sanitization (strip scripts/iframes)
- Use html-to-text for readable extraction
- Domain whitelist for fetch operations

### Secrets Management
- Environment variables (.env):
  - `LLM_PROVIDER` - openai | openrouter | ollama
  - `OPENAI_API_KEY` - for OpenAI provider
  - `OPENROUTER_API_KEY` - for OpenRouter provider
  - `OLLAMA_BASE_URL` - for Ollama (default: http://localhost:11434)
  - `LLM_MODEL` - model name (validated for tool calling support)
- Never log sensitive data
- Webhook signature verification (HMAC)

### Error Handling
- Retry with exponential backoff
- Circuit breaker for flaky tools
- Max retry attempts per run
- Graceful degradation

## Observability

### Logging
- Structured JSON logs (Pino)
- Request IDs for correlation
- Log levels: trace, debug, info, warn, error
- Per-run log aggregation

### Metrics (optional)
- Run duration histogram
- Tool execution counts
- Success/failure rates
- Queue depth

### Health Checks
- `/health` - basic liveness
- `/health/ready` - DB connection + scheduler status
- Event loop lag monitoring (@fastify/under-pressure)

## Deployment

### Single Server (Simple)
```bash
# Build all packages
pnpm build

# Start backend
cd packages/backend
node dist/server.js

# Use CLI to interact
async-agent goal list
```

### Docker Compose
```yaml
services:
  backend:
    build: ./packages/backend
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./artifacts:/app/artifacts
    environment:
      - LLM_PROVIDER=${LLM_PROVIDER}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
      - LLM_MODEL=${LLM_MODEL}
```

### Process Manager (PM2)
```json
{
  "apps": [{
    "name": "async-agent",
    "script": "./packages/backend/dist/server.js",
    "instances": 1,
    "autorestart": true,
    "watch": false,
    "env": {
      "NODE_ENV": "production"
    }
  }]
}
```

## Implementation Checklist

### Phase 1: Core Backend (3-5 days)
- [ ] Set up monorepo with pnpm workspaces
- [ ] Create shared package with types and schemas
- [ ] Backend: DB schema + Drizzle setup + migrations
- [ ] Backend: LLM provider abstraction layer
  - [ ] Provider factory (OpenAI, OpenRouter, Ollama)
  - [ ] Tool calling capability validator
  - [ ] Model compatibility checks
- [ ] Backend: Tool registry with 4 core tools (search, fetch, writeFile, webhook)
- [ ] Backend: Planner with multi-provider function calling support
- [ ] Backend: Orchestrator with step loop
- [ ] Backend: Scheduler (node-cron + queue)
- [ ] Backend: Fastify routes for goals and runs
- [ ] Backend: Logging, error handling, graceful shutdown

### Phase 2: CLI (2-3 days)
- [ ] CLI: Project setup with Commander
- [ ] CLI: API client library
- [ ] CLI: Config management (~/.async-agent/config.json)
- [ ] CLI: Goal commands (create, list, show, delete, run)
- [ ] CLI: Run commands (list, show, logs, watch)
- [ ] CLI: Server commands (start, stop, status)
- [ ] CLI: Interactive prompts with Inquirer
- [ ] CLI: Output formatting (table, JSON, markdown)
- [ ] CLI: Real-time log streaming

### Phase 3: Polish & Examples (1-2 days)
- [ ] Documentation (getting started, CLI reference, API reference)
- [ ] Example use cases (AI news monitor, daily metrics)
- [ ] Integration tests
- [ ] Docker setup
- [ ] Demo video/screencast

### Phase 4: Future - Web Dashboard
- [ ] SvelteKit or Next.js app
- [ ] Goal management UI
- [ ] Run visualization
- [ ] Real-time step streaming
- [ ] Configuration UI

## Estimated Total Effort

- **Minimal viable demo**: 3-5 days
- **Production-ready with CLI**: 6-10 days
- **With web dashboard**: +3-5 days

## Success Criteria

1. ✅ Create goal via CLI with schedule
2. ✅ Goal executes in background on schedule
3. ✅ Agent autonomously selects and uses tools
4. ✅ State persists across backend restarts
5. ✅ CLI shows real-time run progress
6. ✅ Outputs saved as markdown files
7. ✅ Webhook notifications sent on completion
8. ✅ Example "AI news monitor" working end-to-end

## Next Steps

1. Initialize monorepo structure
2. Set up shared package with core types
3. Implement backend database schema
4. Build tool registry and first 2-3 tools
5. Implement agent orchestrator
6. Create basic CLI commands
7. Test end-to-end with example goal
