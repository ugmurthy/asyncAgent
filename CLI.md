# CLI Implementation Plan

## Current State
- **Status**: ~10% complete - scaffold only
- **Completed**: Package structure, dependencies, placeholder commands, table utilities
- **Missing**: All actual command implementations, API client, error handling

## Architecture Overview

```
packages/cli/
├── src/
│   ├── index.ts                    # Main CLI entry point (✅ done)
│   ├── commands/
│   │   ├── config/                 # Configuration commands
│   │   │   └── init.ts            # Initialize config file
│   │   ├── server/                # Backend server management
│   │   │   ├── start.ts           # Start server
│   │   │   ├── stop.ts            # Stop server
│   │   │   └── status.ts          # Server status
│   │   ├── goal/                  # Goal management
│   │   │   ├── create.ts          # Create new goal
│   │   │   ├── list.ts            # List all goals
│   │   │   ├── show.ts            # Show goal details
│   │   │   ├── delete.ts          # Delete goal
│   │   │   ├── pause.ts           # Pause goal
│   │   │   └── resume.ts          # Resume goal
│   │   └── run/                   # Run management
│   │       ├── list.ts            # List runs
│   │       ├── show.ts            # Show run details
│   │       └── logs.ts            # View run logs/steps
│   ├── lib/
│   │   ├── api-client.ts          # HTTP client for backend API
│   │   ├── config.ts              # Config file management
│   │   ├── display.ts             # Output formatting helpers
│   │   ├── spinner.ts             # Loading indicators (ora)
│   │   └── table.ts               # Table formatter (✅ done)
│   └── types/
│       └── cli-types.ts           # CLI-specific types
```

## Implementation Tasks

### Phase 1: Foundation (Priority: HIGH)

#### 1.1 API Client (`lib/api-client.ts`)
- [ ] Create HTTP client class using fetch/axios
- [ ] Methods for all backend endpoints:
  - Goals: create, list, get, update, delete, run, pause, resume
  - Runs: list, get, getSteps, delete
  - Health: check, ready
- [ ] Error handling and retries
- [ ] Base URL configuration (from env or config file)
- [ ] Request/response logging (debug mode)

#### 1.2 Configuration Management (`lib/config.ts`)
- [ ] Config file schema (.async-agent.json or similar)
- [ ] Load/save config from home directory or project root
- [ ] Config properties:
  - `apiUrl` (default: http://localhost:3000)
  - `apiKey` (if auth is added later)
  - `defaultFormat` (json, table, compact)
  - `debugMode` (boolean)
- [ ] Validation with Zod
- [ ] Migration/version handling

#### 1.3 Display Utilities (`lib/display.ts`)
- [ ] Success/error/warning/info message helpers
- [ ] JSON output formatter
- [ ] Compact vs verbose modes
- [ ] Color-coded status indicators
- [ ] Date/time formatting helpers (using date-fns)

#### 1.4 Spinner Utilities (`lib/spinner.ts`)
- [ ] Wrapper around ora
- [ ] Context-aware messages (creating, loading, etc.)
- [ ] Success/fail states
- [ ] Conditional spinner (off in CI/non-TTY)

### Phase 2: Config Commands (Priority: HIGH)

#### 2.1 Init Command (`commands/config/init.ts`)
- [ ] Interactive prompts for API URL
- [ ] Test connection to backend
- [ ] Create config file
- [ ] Display success message with next steps

### Phase 3: Goal Commands (Priority: HIGH)

#### 3.1 Create Goal (`commands/goal/create.ts`)
- [ ] Interactive mode: prompt for description, schedule, enabled
- [ ] CLI args mode: `--description --schedule --enabled`
- [ ] Validate inputs
- [ ] Call API to create goal
- [ ] Display created goal details

#### 3.2 List Goals (`commands/goal/list.ts`)
- [ ] Fetch all goals from API
- [ ] Table format with columns: ID, Description, Schedule, Enabled, Status
- [ ] Optional filters: `--enabled`, `--status`
- [ ] Optional format: `--format json|table`

#### 3.3 Show Goal (`commands/goal/show.ts`)
- [ ] Fetch single goal by ID
- [ ] Display detailed view (key-value format)
- [ ] Show recent runs summary
- [ ] Handle goal not found

#### 3.4 Delete Goal (`commands/goal/delete.ts`)
- [ ] Confirmation prompt (unless `--force`)
- [ ] Delete via API
- [ ] Success message

#### 3.5 Pause Goal (`commands/goal/pause.ts`)
- [ ] Pause goal via API
- [ ] Display updated status

#### 3.6 Resume Goal (`commands/goal/resume.ts`)
- [ ] Resume goal via API
- [ ] Display updated status

### Phase 4: Run Commands (Priority: MEDIUM)

#### 4.1 List Runs (`commands/run/list.ts`)
- [ ] Fetch runs from API
- [ ] Table with: ID, Goal ID, Status, Started, Duration
- [ ] Filter by: `--goal-id`, `--status`
- [ ] Pagination support (if API supports it)

#### 4.2 Show Run (`commands/run/show.ts`)
- [ ] Fetch run details by ID
- [ ] Display run metadata
- [ ] Show steps summary (count by type)
- [ ] Option to show full steps: `--steps`

#### 4.3 Run Logs (`commands/run/logs.ts`)
- [ ] Fetch run steps from API
- [ ] Display steps in chronological order
- [ ] Color-code by step type (thinking, tool, result)
- [ ] Format tool inputs/outputs nicely
- [ ] Optional: `--follow` for live updates (polling)

### Phase 5: Server Commands (Priority: LOW)

#### 5.1 Start Server (`commands/server/start.ts`)
- [ ] Spawn backend process (using child_process)
- [ ] Handle env variables from config
- [ ] Daemonize or keep in foreground with `--foreground`
- [ ] PID file management
- [ ] Health check after startup

#### 5.2 Stop Server (`commands/server/stop.ts`)
- [ ] Read PID file
- [ ] Send SIGTERM to process
- [ ] Wait for graceful shutdown
- [ ] Clean up PID file

#### 5.3 Server Status (`commands/server/status.ts`)
- [ ] Check if PID file exists
- [ ] Check if process is running
- [ ] Call /health/ready endpoint
- [ ] Display system status info

### Phase 6: Main CLI Integration

#### 6.1 Update index.ts
- [ ] Import all command modules
- [ ] Wire up commands with proper options/arguments
- [ ] Global options: `--config`, `--format`, `--debug`
- [ ] Error handling wrapper
- [ ] Version from package.json

### Phase 7: Polish & Quality (Priority: MEDIUM)

#### 7.1 Error Handling
- [ ] Graceful API error handling
- [ ] Network timeout handling
- [ ] User-friendly error messages
- [ ] Exit codes (0 = success, 1 = error)

#### 7.2 Validation
- [ ] Input validation for all commands
- [ ] Helpful error messages for invalid inputs
- [ ] Zod schemas for validation

#### 7.3 Help Text
- [ ] Detailed help for each command
- [ ] Examples in help text
- [ ] Quick start guide

#### 7.4 Testing
- [ ] Unit tests for utilities
- [ ] Integration tests with mock API
- [ ] Manual testing checklist

## Dependencies

### Internal
- `@async-agent/shared` - Shared types and schemas

### External (already installed)
- `commander` - CLI framework
- `chalk` - Terminal colors
- `inquirer` - Interactive prompts
- `ora` - Loading spinners
- `date-fns` - Date formatting
- `zod` - Schema validation

### May Need
- Process management library for server commands (or use built-in child_process)

## Implementation Order

1. **Week 1**: Foundation (API client, config, display utils)
2. **Week 2**: Goal commands (create, list, show, delete)
3. **Week 3**: Run commands (list, show, logs)
4. **Week 4**: Server commands + polish + testing

## Success Criteria

- [ ] Can initialize config with `async-agent init`
- [ ] Can create/list/show/delete goals
- [ ] Can view runs and their steps
- [ ] All commands handle errors gracefully
- [ ] Help text is clear and useful
- [ ] Works in CI environments (non-interactive fallbacks)
- [ ] Build produces working executable
- [ ] Can install globally and run from anywhere

## Future Enhancements (Post-MVP)

- [ ] `async-agent goal trigger <id>` - Manually trigger goal run
- [ ] `async-agent run cancel <id>` - Cancel running execution
- [ ] `async-agent logs --tail -f` - Follow logs in real-time
- [ ] Shell completions (bash, zsh, fish)
- [ ] Config profiles (dev, prod, staging)
- [ ] Export runs to file
- [ ] Interactive TUI mode (using ink or blessed)

## Notes

- Keep commands focused and single-purpose
- Provide both interactive and non-interactive modes where applicable
- Default to user-friendly table output, allow JSON for scripting
- Graceful degradation in non-TTY environments
- Follow Unix philosophy: do one thing well
