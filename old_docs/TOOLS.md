# Tools

## Overview

Tools are the building blocks that give agents the ability to interact with the external world. Each tool is a self-contained class that implements a specific capability, such as searching the web, reading/writing files, sending emails, or making HTTP requests.

Tools are located in `packages/backend/src/agent/tools/` and are automatically registered with the agent runtime through the `ToolRegistry`.

## How Tools Work

### Architecture

- **BaseTool**: All tools extend the `BaseTool<TInput, TOutput>` abstract class
- **ToolRegistry**: Manages tool registration and provides access to tool definitions
- **ToolContext**: Provides logging (`ctx.logger`), cancellation support (`ctx.abortSignal`), and other runtime context
- **Input Validation**: Uses Zod schemas for type-safe input validation
- **JSON Schema Generation**: Tools automatically generate OpenAPI-compatible JSON schemas for LLM function calling

### Execution Flow

1. Agent receives a request that requires tool use
2. LLM determines which tool to call and generates parameters
3. Tool input is validated against Zod schema
4. `execute()` method runs with validated input and ToolContext
5. Tool returns structured output or throws an error
6. Agent processes the result and continues execution

### Built-in Helpers

Tools inherit several helper methods:
- `withTimeout(promise, timeoutMs, message)`: Wraps async operations with timeout
- `retry(fn, maxAttempts, delayMs)`: Retries failed operations with exponential backoff

## Existing Tools

The backend includes these default tools:

- **webSearch**: Search the web for information using DuckDuckGo
- **fetchPage**: Fetch and extract text content from a web page
- **writeFile**: Write content to a file in the artifacts directory
- **sendWebhook**: Send a POST request with JSON payload to a webhook URL
- **readFile**: Read content from a file in the artifacts directory
- **sendEmail**: Send an email via SMTP. Requires SMTP configuration in environment variables.

## Creating a New Tool

### Step 1: Create Tool File

Create a new file in `packages/backend/src/agent/tools/` (e.g., `myTool.ts`).

### Step 2: Implement the Tool Class

```typescript
import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';

// Define input schema with Zod validation
const myToolInputSchema = z.object({
  // Define your input parameters here
  param1: z.string().describe('Description of param1'),
  param2: z.number().optional().describe('Optional number parameter'),
});

type MyToolInput = z.infer<typeof myToolInputSchema>;

// Define output interface
interface MyToolOutput {
  result: string;
  success: boolean;
  // Add other output fields as needed
}

export class MyTool extends BaseTool<MyToolInput, MyToolOutput> {
  name = 'myTool';
  description = 'Brief description of what this tool does';
  inputSchema = myToolInputSchema;

  async execute(input: MyToolInput, ctx: ToolContext): Promise<MyToolOutput> {
    ctx.logger.info(`Executing myTool with input: ${JSON.stringify(input)}`);

    try {
      // Implement your tool logic here
      // Use ctx.logger for logging
      // Use ctx.abortSignal for cancellation support
      // Use this.withTimeout() for operations that might hang
      // Use this.retry() for operations that might fail temporarily

      const result = {
        result: 'Tool execution successful',
        success: true,
      };

      ctx.logger.info('MyTool completed successfully');
      return result;
    } catch (error) {
      ctx.logger.error({ err: error }, 'MyTool failed');
      throw error;
    }
  }
}
```

### Step 3: Register the Tool

Update `packages/backend/src/agent/tools/index.ts`:

```typescript
// Add import
import { MyTool } from './myTool.js';

// In registerDefaultTools()
this.register(new MyTool());

// Add export
export * from './myTool.js';
```

### Step 4: Build and Test

```bash
pnpm --filter @async-agent/backend build
```

### Key Guidelines

- **Input Validation**: Always use Zod schemas with `.describe()` for parameter documentation
- **Error Handling**: Wrap operations in try/catch and use `ctx.logger` for debugging
- **Cancellation**: Respect `ctx.abortSignal` for long-running operations
- **Timeouts**: Use `this.withTimeout()` for network calls and external APIs
- **Retries**: Use `this.retry()` for operations that might need retries
- **Logging**: Log important events and errors consistently
- **Descriptions**: Keep tool and parameter descriptions clear and concise
- **Testing**: Test your tool thoroughly with various inputs and edge cases

### Example Tools to Reference

- `sendWebhook.ts` - HTTP requests with retries and response handling
- `webSearch.ts` - External API integration with HTML parsing
- `readFile.ts` / `writeFile.ts` - File system operations with path validation

### Tool Context Interface

```typescript
interface ToolContext {
  logger: Logger;           // Pino logger instance
  abortSignal: AbortSignal; // For cancellation support
}
```

This framework ensures your tool integrates seamlessly with the agent runtime and follows established patterns for reliability and maintainability.</content>
</xai:function_call">TOOL_REGISTRY.md
