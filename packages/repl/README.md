# Async Agent REPL

Interactive Read-Eval-Print Loop for the Async Agent API.

## Installation

```bash
# From project root
pnpm install
pnpm --filter @async-agent/repl build
```

## Usage

### Start the REPL

```bash
# Using pnpm
pnpm --filter @async-agent/repl dev

# Or after building
pnpm --filter @async-agent/repl start

# Or directly via the built binary
node packages/repl/dist/index.js
```

### Configuration

The REPL connects to `http://localhost:3000` by default. Override with:

```bash
ASYNC_AGENT_API_URL=http://localhost:3000 pnpm --filter @async-agent/repl dev
```

## Available Commands

### Output Formatting

Add `--markdown` to any command for formatted table output:
```
async-agent> list goals --markdown
async-agent> show run run_abc123 --markdown
```

Add `--horizontal` to render each array item as a separate key/value table:
```
async-agent> list goals --horizontal
async-agent> list runs --horizontal
```

By default, output is shown in raw JSON format.

### Goals

- `create goal` - Create a new goal (interactive prompts)
- `list goals` - List all goals
- `list goals status <status>` - List goals by status (active, paused, completed)
- `get goal <id>` - Get goal details
- `show goal <id>` - Same as get goal
- `delete goal <id>` - Delete a goal
- `pause goal <id>` - Pause a goal
- `resume goal <id>` - Resume a paused goal
- `run goal <id>` - Trigger a run for a goal

### Runs

- `list runs` - List all runs
- `list runs status <status>` - List runs by status (pending, running, completed, failed, cancelled)
- `list runs goal <goalId>` - List runs for a specific goal
- `get run <id>` - Get run details
- `show run <id>` - Same as get run
- `show steps <runId>` - Show steps for a run
- `show steps run <runId>` - Same as show steps
- `list steps <runId>` - Same as show steps
- `delete run <id>` - Delete a run

### Health

- `health` - Check API health
- `ready` - Check API readiness

### General

- `help` - Show help with all commands
- `exit` or `quit` - Exit the REPL

## Examples

```
async-agent> help
async-agent> health
async-agent> create goal
async-agent> list goals
async-agent> list goals status active
async-agent> get goal 1
async-agent> run goal 1
async-agent> list runs goal 1
async-agent> show steps 1
async-agent> exit
```

## Features

- 🎨 Colorized output with syntax highlighting
- 📋 Multiple command aliases (get/show, list goal/list goals)
- 🔍 Filter by status for goals and runs
- 💬 Interactive goal creation
- ✅ Health checks before starting
- 🚀 Direct integration with JS/TS SDK
