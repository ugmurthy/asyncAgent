# Custom Tools Architecture

This document describes the architecture for implementing user-defined custom tools that can be dynamically registered without server restart. Custom tools are external executables that communicate via stdin/stdout/stderr, following a protocol similar to MCP (Model Context Protocol).

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Async Agent Backend                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Unified Tool Registry                         │   │
│  │  ┌─────────────────────┐      ┌─────────────────────────────────┐   │   │
│  │  │   Built-in Tools    │      │      Custom Tool Manager        │   │   │
│  │  │  - webSearch        │      │  - Registration API             │   │   │
│  │  │  - fetchPage        │      │  - Process Spawning             │   │   │
│  │  │  - writeFile        │      │  - Protocol Handler             │   │   │
│  │  │  - readFile         │      │  - Health Monitoring            │   │   │
│  │  │  - sendWebhook      │      │                                 │   │   │
│  │  │  - sendEmail        │      └─────────────────────────────────┘   │   │
│  │  └─────────────────────┘                    │                       │   │
│  │                                             │                       │   │
│  │                                             ▼                       │   │
│  │                              ┌──────────────────────────┐           │   │
│  │                              │   Custom Tools Storage   │           │   │
│  │                              │      (SQLite Table)      │           │   │
│  │                              └──────────────────────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                             │                               │
└─────────────────────────────────────────────┼───────────────────────────────┘
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     │                                                 │
                     ▼                                                 ▼
          ┌─────────────────────┐                        ┌─────────────────────┐
          │  Custom Tool (Exec) │                        │  Custom Tool (Exec) │
          │                     │                        │                     │
          │  stdin  ─────────►  │                        │  stdin  ─────────►  │
          │  stdout ◄─────────  │                        │  stdout ◄─────────  │
          │  stderr ◄─────────  │                        │  stderr ◄─────────  │
          │                     │                        │                     │
          │  Python/Node/Binary │                        │  Python/Node/Binary │
          └─────────────────────┘                        └─────────────────────┘
```

## Communication Protocol

Custom tools communicate with the backend using JSON-RPC 2.0 over stdin/stdout, similar to MCP.

### Message Format

```typescript
// Request (Backend → Tool)
interface ToolRequest {
  jsonrpc: '2.0';
  id: string;
  method: 'execute';
  params: {
    input: Record<string, any>;  // Tool input parameters
    context: {
      runId: string;
      executionId?: string;
      workingDir: string;
      timeout: number;
    };
  };
}

// Response (Tool → Backend)
interface ToolResponse {
  jsonrpc: '2.0';
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Initialization Request (Backend → Tool)
interface InitRequest {
  jsonrpc: '2.0';
  id: string;
  method: 'initialize';
  params: {
    protocolVersion: '1.0';
  };
}

// Initialization Response (Tool → Backend)
interface InitResponse {
  jsonrpc: '2.0';
  id: string;
  result: {
    name: string;
    description: string;
    version: string;
    inputSchema: JSONSchema;  // JSON Schema for input validation
  };
}

// Health Check (Backend → Tool)
interface HealthRequest {
  jsonrpc: '2.0';
  id: string;
  method: 'health';
  params: {};
}

interface HealthResponse {
  jsonrpc: '2.0';
  id: string;
  result: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  };
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 | Execution timeout |
| -32001 | Tool-specific error |

## Database Schema

Add a new table for custom tool registrations:

```typescript
// packages/backend/src/db/schema.ts

export const customTools = sqliteTable('custom_tools', {
  id: text('id').primaryKey(),
  
  // Tool identity
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  version: text('version').notNull(),
  
  // Executable configuration
  command: text('command').notNull(),           // e.g., "python", "node", "/path/to/binary"
  args: text('args', { mode: 'json' }).$type<string[]>().notNull(), // e.g., ["./tools/my-tool.py"]
  workingDir: text('working_dir'),              // Optional working directory
  env: text('env', { mode: 'json' }).$type<Record<string, string>>(), // Environment variables
  
  // Schema & validation
  inputSchema: text('input_schema', { mode: 'json' }).notNull().$type<JSONSchema>(),
  
  // Configuration
  timeoutMs: integer('timeout_ms').notNull().default(30000),
  maxRetries: integer('max_retries').notNull().default(0),
  retryDelayMs: integer('retry_delay_ms').notNull().default(1000),
  
  // Pool configuration (for long-running tools)
  poolSize: integer('pool_size').notNull().default(1),
  keepAlive: integer('keep_alive', { mode: 'boolean' }).notNull().default(false),
  
  // Status & health
  status: text('status', { 
    enum: ['active', 'inactive', 'error'] 
  }).notNull().default('inactive'),
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  healthStatus: text('health_status', { 
    enum: ['healthy', 'degraded', 'unhealthy', 'unknown'] 
  }).notNull().default('unknown'),
  errorMessage: text('error_message'),
  
  // Metadata
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
```

## Core Components

### 1. CustomToolManager

Manages lifecycle of custom tools:

```typescript
// packages/backend/src/agent/tools/customToolManager.ts

export class CustomToolManager {
  private processPool: Map<string, ChildProcess[]>;
  private healthCheckInterval: NodeJS.Timeout;

  constructor(
    private db: Database,
    private logger: Logger
  ) {
    this.processPool = new Map();
  }

  // Load all active custom tools from database
  async initialize(): Promise<void>;
  
  // Register a new custom tool
  async register(config: CustomToolConfig): Promise<CustomTool>;
  
  // Unregister and cleanup
  async unregister(name: string): Promise<void>;
  
  // Get wrapper tool for registry
  getToolWrapper(name: string): CustomToolWrapper | undefined;
  
  // Get all custom tool wrappers
  getAllToolWrappers(): CustomToolWrapper[];
  
  // Validate tool executable exists and responds
  async validateTool(config: CustomToolConfig): Promise<ValidationResult>;
  
  // Health monitoring
  startHealthChecks(intervalMs: number): void;
  stopHealthChecks(): void;
  
  // Graceful shutdown
  async shutdown(): Promise<void>;
}
```

### 2. CustomToolWrapper

Wraps external executables as Tool interface:

```typescript
// packages/backend/src/agent/tools/customToolWrapper.ts

export class CustomToolWrapper implements Tool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  
  constructor(
    private config: CustomToolRecord,
    private processManager: ProcessManager,
    private logger: Logger
  ) {}
  
  async execute(input: any, ctx: ToolContext): Promise<any> {
    // 1. Validate input against schema
    // 2. Get or spawn process
    // 3. Send JSON-RPC request via stdin
    // 4. Wait for response on stdout with timeout
    // 5. Handle errors from stderr
    // 6. Return result or throw
  }
  
  toJSONSchema(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.config.inputSchema,
      },
    };
  }
}
```

### 3. ProcessManager

Handles process spawning and communication:

```typescript
// packages/backend/src/agent/tools/processManager.ts

export class ProcessManager {
  // Spawn a new process for a tool
  async spawn(config: SpawnConfig): Promise<ManagedProcess>;
  
  // Get available process from pool
  async acquire(toolName: string): Promise<ManagedProcess>;
  
  // Return process to pool
  release(toolName: string, process: ManagedProcess): void;
  
  // Send request and wait for response
  async sendRequest(
    process: ManagedProcess,
    request: ToolRequest,
    timeoutMs: number
  ): Promise<any>;
  
  // Terminate all processes
  async terminateAll(): Promise<void>;
}

interface ManagedProcess {
  process: ChildProcess;
  toolName: string;
  inUse: boolean;
  lastUsed: Date;
  requestCount: number;
}
```

### 4. Extended ToolRegistry

Modify existing registry to include custom tools:

```typescript
// packages/backend/src/agent/tools/index.ts

export class ToolRegistry {
  private builtInTools = new Map<string, Tool>();
  private customToolManager: CustomToolManager;

  constructor(db: Database, logger: Logger) {
    this.customToolManager = new CustomToolManager(db, logger);
    this.registerDefaultTools();
  }

  async initialize(): Promise<void> {
    await this.customToolManager.initialize();
  }

  get(name: string): Tool | undefined {
    return this.builtInTools.get(name) 
      ?? this.customToolManager.getToolWrapper(name);
  }

  getAll(): Tool[] {
    return [
      ...this.builtInTools.values(),
      ...this.customToolManager.getAllToolWrappers(),
    ];
  }

  // Check if a tool is built-in or custom
  isBuiltIn(name: string): boolean {
    return this.builtInTools.has(name);
  }

  isCustom(name: string): boolean {
    return this.customToolManager.getToolWrapper(name) !== undefined;
  }
}
```

## API Endpoints

### Custom Tools Management

```yaml
# Add to openapi.yaml

/api/v1/custom-tools:
  get:
    summary: List all custom tools
    parameters:
      - name: status
        in: query
        schema:
          type: string
          enum: [active, inactive, error]
    responses:
      200:
        description: List of custom tools
        
  post:
    summary: Register a new custom tool
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CustomToolCreate'
    responses:
      201:
        description: Tool registered successfully
      400:
        description: Validation failed
      409:
        description: Tool name already exists

/api/v1/custom-tools/{name}:
  get:
    summary: Get custom tool details
    responses:
      200:
        description: Tool details
      404:
        description: Tool not found
        
  patch:
    summary: Update custom tool
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CustomToolUpdate'
    responses:
      200:
        description: Tool updated
        
  delete:
    summary: Unregister custom tool
    responses:
      204:
        description: Tool removed
      404:
        description: Tool not found

/api/v1/custom-tools/{name}/validate:
  post:
    summary: Validate tool executable and schema
    responses:
      200:
        description: Validation result
        content:
          application/json:
            schema:
              type: object
              properties:
                valid: boolean
                errors: string[]

/api/v1/custom-tools/{name}/health:
  get:
    summary: Get tool health status
    responses:
      200:
        description: Health status

/api/v1/custom-tools/{name}/test:
  post:
    summary: Execute tool with test input
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              input:
                type: object
    responses:
      200:
        description: Test execution result
```

## Custom Tool Templates

### Python Template

```python
#!/usr/bin/env python3
"""
Custom Tool Template for Async Agent
Protocol: JSON-RPC 2.0 over stdin/stdout
"""

import sys
import json
from typing import Any

# Tool metadata
TOOL_NAME = "my_custom_tool"
TOOL_DESCRIPTION = "Description of what this tool does"
TOOL_VERSION = "1.0.0"

# JSON Schema for input validation
INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "The search query"
        },
        "limit": {
            "type": "integer",
            "description": "Maximum results to return",
            "default": 10
        }
    },
    "required": ["query"]
}


def send_response(id: str, result: Any = None, error: dict = None):
    """Send JSON-RPC response to stdout."""
    response = {"jsonrpc": "2.0", "id": id}
    if error:
        response["error"] = error
    else:
        response["result"] = result
    print(json.dumps(response), flush=True)


def send_error(id: str, code: int, message: str, data: Any = None):
    """Send JSON-RPC error response."""
    error = {"code": code, "message": message}
    if data:
        error["data"] = data
    send_response(id, error=error)


def log(message: str):
    """Log to stderr (visible to backend for debugging)."""
    print(f"[{TOOL_NAME}] {message}", file=sys.stderr, flush=True)


def handle_initialize(id: str, params: dict):
    """Handle initialization request."""
    send_response(id, {
        "name": TOOL_NAME,
        "description": TOOL_DESCRIPTION,
        "version": TOOL_VERSION,
        "inputSchema": INPUT_SCHEMA
    })


def handle_health(id: str, params: dict):
    """Handle health check request."""
    # Add custom health checks here
    send_response(id, {
        "status": "healthy",
        "message": "Tool is operational"
    })


def handle_execute(id: str, params: dict):
    """Handle tool execution request."""
    try:
        input_data = params.get("input", {})
        context = params.get("context", {})
        
        # Validate required inputs
        if "query" not in input_data:
            send_error(id, -32602, "Missing required parameter: query")
            return
        
        # ============================================
        # YOUR TOOL LOGIC HERE
        # ============================================
        query = input_data["query"]
        limit = input_data.get("limit", 10)
        
        log(f"Executing with query='{query}', limit={limit}")
        
        # Example result
        result = {
            "success": True,
            "data": [
                {"id": 1, "title": f"Result for {query}"},
            ],
            "count": 1
        }
        # ============================================
        
        send_response(id, result)
        
    except Exception as e:
        log(f"Error during execution: {e}")
        send_error(id, -32001, str(e))


def main():
    """Main message loop."""
    log("Starting tool...")
    
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            
            if request.get("jsonrpc") != "2.0":
                send_error(request.get("id"), -32600, "Invalid JSON-RPC version")
                continue
            
            id = request.get("id")
            method = request.get("method")
            params = request.get("params", {})
            
            if method == "initialize":
                handle_initialize(id, params)
            elif method == "health":
                handle_health(id, params)
            elif method == "execute":
                handle_execute(id, params)
            else:
                send_error(id, -32601, f"Method not found: {method}")
                
        except json.JSONDecodeError as e:
            send_error(None, -32700, f"Parse error: {e}")
        except Exception as e:
            log(f"Unexpected error: {e}")
            send_error(None, -32603, f"Internal error: {e}")


if __name__ == "__main__":
    main()
```

### Node.js Template

```javascript
#!/usr/bin/env node
/**
 * Custom Tool Template for Async Agent
 * Protocol: JSON-RPC 2.0 over stdin/stdout
 */

const readline = require('readline');

// Tool metadata
const TOOL_NAME = 'my_custom_tool';
const TOOL_DESCRIPTION = 'Description of what this tool does';
const TOOL_VERSION = '1.0.0';

// JSON Schema for input validation
const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'The search query',
    },
    limit: {
      type: 'integer',
      description: 'Maximum results to return',
      default: 10,
    },
  },
  required: ['query'],
};

function sendResponse(id, result = null, error = null) {
  const response = { jsonrpc: '2.0', id };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  console.log(JSON.stringify(response));
}

function sendError(id, code, message, data = null) {
  const error = { code, message };
  if (data) error.data = data;
  sendResponse(id, null, error);
}

function log(message) {
  console.error(`[${TOOL_NAME}] ${message}`);
}

function handleInitialize(id, params) {
  sendResponse(id, {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    version: TOOL_VERSION,
    inputSchema: INPUT_SCHEMA,
  });
}

function handleHealth(id, params) {
  sendResponse(id, {
    status: 'healthy',
    message: 'Tool is operational',
  });
}

async function handleExecute(id, params) {
  try {
    const input = params.input || {};
    const context = params.context || {};

    if (!input.query) {
      sendError(id, -32602, 'Missing required parameter: query');
      return;
    }

    // ============================================
    // YOUR TOOL LOGIC HERE
    // ============================================
    const { query, limit = 10 } = input;
    
    log(`Executing with query='${query}', limit=${limit}`);

    const result = {
      success: true,
      data: [{ id: 1, title: `Result for ${query}` }],
      count: 1,
    };
    // ============================================

    sendResponse(id, result);
  } catch (error) {
    log(`Error during execution: ${error.message}`);
    sendError(id, -32001, error.message);
  }
}

function main() {
  log('Starting tool...');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);

      if (request.jsonrpc !== '2.0') {
        sendError(request.id, -32600, 'Invalid JSON-RPC version');
        return;
      }

      const { id, method, params = {} } = request;

      switch (method) {
        case 'initialize':
          handleInitialize(id, params);
          break;
        case 'health':
          handleHealth(id, params);
          break;
        case 'execute':
          await handleExecute(id, params);
          break;
        default:
          sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendError(null, -32700, `Parse error: ${error.message}`);
      } else {
        log(`Unexpected error: ${error.message}`);
        sendError(null, -32603, `Internal error: ${error.message}`);
      }
    }
  });
}

main();
```

### Bash Template

```bash
#!/usr/bin/env bash
# Custom Tool Template for Async Agent
# Protocol: JSON-RPC 2.0 over stdin/stdout

TOOL_NAME="my_custom_tool"
TOOL_VERSION="1.0.0"

log() {
    echo "[$TOOL_NAME] $1" >&2
}

send_response() {
    local id="$1"
    local result="$2"
    echo "{\"jsonrpc\":\"2.0\",\"id\":\"$id\",\"result\":$result}"
}

send_error() {
    local id="$1"
    local code="$2"
    local message="$3"
    echo "{\"jsonrpc\":\"2.0\",\"id\":\"$id\",\"error\":{\"code\":$code,\"message\":\"$message\"}}"
}

handle_initialize() {
    local id="$1"
    send_response "$id" '{
        "name":"'"$TOOL_NAME"'",
        "description":"A bash custom tool",
        "version":"'"$TOOL_VERSION"'",
        "inputSchema":{
            "type":"object",
            "properties":{
                "command":{"type":"string","description":"Command to execute"}
            },
            "required":["command"]
        }
    }'
}

handle_health() {
    local id="$1"
    send_response "$id" '{"status":"healthy"}'
}

handle_execute() {
    local id="$1"
    local params="$2"
    
    # Extract input using jq
    local command=$(echo "$params" | jq -r '.input.command // empty')
    
    if [ -z "$command" ]; then
        send_error "$id" -32602 "Missing required parameter: command"
        return
    fi
    
    log "Executing command: $command"
    
    # ============================================
    # YOUR TOOL LOGIC HERE
    # ============================================
    local output
    output=$(eval "$command" 2>&1)
    local exit_code=$?
    # ============================================
    
    if [ $exit_code -eq 0 ]; then
        # Escape output for JSON
        local escaped=$(echo "$output" | jq -Rs .)
        send_response "$id" "{\"success\":true,\"output\":$escaped}"
    else
        send_error "$id" -32001 "Command failed with exit code $exit_code"
    fi
}

main() {
    log "Starting tool..."
    
    while IFS= read -r line; do
        method=$(echo "$line" | jq -r '.method // empty')
        id=$(echo "$line" | jq -r '.id // empty')
        params=$(echo "$line" | jq -r '.params // {}')
        
        case "$method" in
            initialize)
                handle_initialize "$id"
                ;;
            health)
                handle_health "$id"
                ;;
            execute)
                handle_execute "$id" "$params"
                ;;
            *)
                send_error "$id" -32601 "Method not found: $method"
                ;;
        esac
    done
}

main
```

## Directory Structure

```
asyncAgent/
├── packages/
│   ├── backend/
│   │   └── src/
│   │       └── agent/
│   │           └── tools/
│   │               ├── index.ts              # Extended registry
│   │               ├── base.ts               # Existing BaseTool
│   │               ├── customToolManager.ts  # NEW: Manager class
│   │               ├── customToolWrapper.ts  # NEW: Tool wrapper
│   │               ├── processManager.ts     # NEW: Process handling
│   │               ├── protocol.ts           # NEW: JSON-RPC types
│   │               └── ... (existing tools)
│   │       └── app/
│   │           └── routes/
│   │               └── customTools.ts        # NEW: API routes
│   │       └── db/
│   │           └── schema.ts                 # Add customTools table
├── tools/                                    # NEW: Custom tools directory
│   ├── templates/
│   │   ├── python/
│   │   │   └── template.py
│   │   ├── node/
│   │   │   └── template.js
│   │   └── bash/
│   │       └── template.sh
│   └── installed/                           # User's custom tools
│       └── my-tool/
│           ├── tool.py
│           └── requirements.txt
```

## Security Considerations

### 1. Execution Sandboxing

```typescript
interface SandboxConfig {
  // Restrict file system access
  allowedPaths: string[];
  
  // Network restrictions
  allowNetwork: boolean;
  allowedHosts?: string[];
  
  // Resource limits
  maxMemoryMB: number;
  maxCpuPercent: number;
  
  // Timeout
  maxExecutionMs: number;
}
```

### 2. Input Validation

- All inputs validated against JSON Schema before execution
- Path traversal prevention for file-related operations
- Size limits on input/output data

### 3. Process Isolation

- Each tool runs in its own process
- Environment variables sanitized
- No access to parent process memory

### 4. Permissions Model

```typescript
interface ToolPermissions {
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canNetwork: boolean;
  canExecuteCommands: boolean;
  allowedEnvironmentVars: string[];
}
```

## Configuration

### Environment Variables

```bash
# Custom tools configuration
CUSTOM_TOOLS_DIR=./tools/installed
CUSTOM_TOOLS_ENABLED=true
CUSTOM_TOOLS_MAX_POOL_SIZE=10
CUSTOM_TOOLS_HEALTH_CHECK_INTERVAL=60000
CUSTOM_TOOLS_DEFAULT_TIMEOUT=30000
CUSTOM_TOOLS_SANDBOX_ENABLED=true
```

### Registration Example

```bash
# Register via API
curl -X POST http://localhost:3000/api/v1/custom-tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "weather_lookup",
    "description": "Get current weather for a location",
    "command": "python",
    "args": ["./tools/installed/weather/tool.py"],
    "inputSchema": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "City name or coordinates"
        }
      },
      "required": ["location"]
    },
    "timeoutMs": 10000,
    "tags": ["weather", "external-api"]
  }'
```

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Add `customTools` table to database schema
- [ ] Implement `ProcessManager` for spawning/communication
- [ ] Implement JSON-RPC protocol types and handlers
- [ ] Create `CustomToolWrapper` class

### Phase 2: Management Layer
- [ ] Implement `CustomToolManager` class
- [ ] Add health monitoring and recovery
- [ ] Extend `ToolRegistry` to include custom tools
- [ ] Add hot-reload capability

### Phase 3: API & Storage
- [ ] Create custom tools API routes
- [ ] Add validation endpoint
- [ ] Add test execution endpoint
- [ ] Implement tool persistence

### Phase 4: Templates & DX
- [ ] Create Python/Node.js/Bash templates
- [ ] Add CLI commands for tool scaffolding
- [ ] Create documentation and examples
- [ ] Add WebApp UI for tool management

### Phase 5: Security & Production
- [ ] Implement sandboxing options
- [ ] Add resource limits and quotas
- [ ] Security audit and hardening
- [ ] Performance optimization

## WebApp Integration

Add a new section in the WebApp for custom tool management:

- **Tools List**: View all registered tools with status
- **Register Tool**: Form to register new tools
- **Tool Editor**: Edit tool configuration
- **Test Runner**: Execute tool with sample input
- **Logs Viewer**: View tool execution logs
- **Health Dashboard**: Monitor tool health status

## CLI Commands

```bash
# List all tools (built-in and custom)
pnpm --filter cli run tool list

# Register a new custom tool
pnpm --filter cli run tool register ./path/to/tool.py

# Scaffold a new tool from template
pnpm --filter cli run tool create my-tool --template python

# Test a tool
pnpm --filter cli run tool test weather_lookup '{"location": "London"}'

# Check tool health
pnpm --filter cli run tool health weather_lookup

# Unregister a tool
pnpm --filter cli run tool unregister weather_lookup
```

## Error Handling & Recovery

### Tool Crash Recovery

1. Detect process crash via exit event
2. Log error and update health status
3. Attempt restart (up to maxRetries)
4. Mark tool as `error` status if recovery fails
5. Emit event for monitoring

### Communication Timeout

1. Cancel pending request
2. Kill unresponsive process
3. Return timeout error to caller
4. Spawn fresh process for next request

### Graceful Shutdown

1. Stop accepting new requests
2. Wait for in-flight requests (with timeout)
3. Send shutdown signal to all processes
4. Force kill remaining processes
5. Clean up resources

## Monitoring & Observability

### Metrics to Track

- Tool invocation count
- Average execution time per tool
- Error rate per tool
- Process spawn/termination count
- Memory usage per tool process
- Active process count

### Logging

```typescript
// Structured log format
{
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  tool: string;
  event: 'spawn' | 'execute' | 'response' | 'error' | 'health' | 'terminate';
  requestId?: string;
  durationMs?: number;
  error?: string;
}
```
