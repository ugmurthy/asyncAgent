# OpenRouter Fetch Provider Implementation Plan

## Overview
Create a new LLM provider `openrouter-fetch.ts` that implements the `LLMProvider` interface using the native Fetch API instead of the OpenAI SDK. This provider will maintain behavioral parity with the existing `openrouter.ts` while giving direct HTTP control.

## Goals
- Eliminate OpenAI SDK dependency for OpenRouter calls
- Use native Fetch API for full HTTP control
- Maintain identical behavior and interface compatibility
- Enable future streaming support with Server-Sent Events
- Keep code simple and maintainable

## Architecture

### File Location
`packages/backend/src/agent/providers/openrouter-fetch.ts`

### Class Structure
```typescript
export class OpenRouterFetchProvider implements LLMProvider {
  name = 'openrouter-fetch';
  private apiKey: string;
  private model: string;
  private defaultMaxTokens: number;
  
  constructor(apiKey: string, model: string, defaultMaxTokens: number)
  async validateToolCallSupport(model: string): Promise<{supported: boolean; message?: string}>
  async chat(params: ChatParams): Promise<ChatResponse>
  async callWithTools(params: LLMCallParams): Promise<LLMResponse>
}
```

## Key Differences from Current Implementation

| Aspect | Current (openrouter.ts) | New (openrouter-fetch.ts) |
|--------|------------------------|---------------------------|
| HTTP Client | OpenAI SDK | Native Fetch API |
| Dependencies | OpenAI package | None (built-in) |
| Request Building | SDK methods | Manual JSON construction |
| Error Handling | SDK errors | Manual HTTP error parsing |
| Type Safety | SDK types | Custom minimal types |
| Streaming | SDK streaming | SSE parsing (future) |
| Control | Abstracted | Full HTTP control |

## Implementation Details

### 1. Constants and Types

```typescript
const BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60000;

// Minimal OpenAI-compatible types
type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAIChoice = {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string | null;
};

type OpenAIChatCompletionResponse = {
  id: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

type OpenAIErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
    param?: string;
  };
};
```

### 2. Helper Functions

#### buildHeaders()
```typescript
function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'HTTP-Referer': 'https://github.com/async-agent',
    'X-Title': 'Async Agent',
  };
}
```

**Purpose:** Construct required headers for OpenRouter API
**Headers:**
- Authorization: API key bearer token
- Content-Type/Accept: JSON
- HTTP-Referer: App identification (for rankings)
- X-Title: App name (for rankings)

#### handleApiError()
```typescript
async function handleApiError(res: Response): Promise<never> {
  try {
    const body = await res.json() as OpenAIErrorResponse;
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).code = body?.error?.code;
    (err as any).type = body?.error?.type;
    throw err;
  } catch {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    (err as any).status = res.status;
    throw err;
  }
}
```

**Purpose:** Parse API errors and throw enriched Error objects
**Strategy:**
1. Try to parse JSON error response
2. Extract error message, code, type
3. Fallback to text response if JSON parsing fails
4. Attach status code to error for debugging

#### mapFinishReason()
```typescript
function mapFinishReason(reason?: string | null): LLMResponse['finishReason'] {
  switch (reason) {
    case 'stop': return 'stop';
    case 'tool_calls': return 'tool_calls';
    case 'length': return 'length';
    case 'content_filter': return 'content_filter';
    default: return 'stop';
  }
}
```

**Purpose:** Map OpenRouter finish reasons to internal types
**Mapping:** Direct 1:1 mapping with safe default to 'stop'

#### jsonParseSafe()
```typescript
function jsonParseSafe(s: string): any {
  try {
    return JSON.parse(s);
  } catch (e) {
    logger.warn({ err: e, args: s }, 'Failed to parse tool call arguments; returning raw string');
    return s;
  }
}
```

**Purpose:** Safely parse tool call arguments with fallback
**Strategy:**
- Try to parse JSON arguments
- Log warning on failure
- Return raw string instead of throwing (graceful degradation)

#### extractUsage()
```typescript
function extractUsage(data: OpenAIChatCompletionResponse): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | undefined {
  if (!data.usage) return undefined;
  
  return {
    promptTokens: data.usage.prompt_tokens,
    completionTokens: data.usage.completion_tokens,
    totalTokens: data.usage.total_tokens,
  };
}
```

**Purpose:** Extract and normalize usage statistics from API response
**Returns:** Undefined if usage not present, otherwise object with camelCase fields
**Note:** OpenRouter returns usage for non-streaming calls; streaming calls include usage in final chunk

#### extractGenerationId()
```typescript
async function extractGenerationId(
  data: OpenAIChatCompletionResponse, 
  apiKey: string
): Promise<any> {
  const generationId = data.id;
  
  try {
    const res = await fetch(
      `${BASE_URL}/generation?id=${generationId}`,
      { headers: buildHeaders(apiKey) }
    );
    
    if (!res.ok) {
      logger.warn({ status: res.status, generationId }, 'Failed to fetch generation details');
      return { id: generationId, error: 'Failed to fetch details' };
    }
    
    const details = await res.json();
    return details;
  } catch (error) {
    logger.warn({ err: error, generationId }, 'Error fetching generation details');
    return { id: generationId, error: String(error) };
  }
}
```

**Purpose:** Fetch detailed generation statistics from OpenRouter API
**Parameters:** 
- `data`: The chat completion response containing the generation ID
- `apiKey`: API key for authentication
**Returns:** Promise resolving to generation details object with native token counts, precise cost information, and model metadata
**Error Handling:** Logs warnings and returns error object on failure, never throws
**Use Case:** Get accurate billing information, native token counts (without OpenAI wrapper overhead), model routing details, and generation metadata

### 3. Constructor

```typescript
constructor(apiKey: string, model: string, defaultMaxTokens: number) {
  this.apiKey = apiKey;
  this.model = model;
  this.defaultMaxTokens = defaultMaxTokens;
}
```

**Implementation:**
- Store configuration in private fields
- No network calls or validation
- Lightweight initialization

### 4. validateToolCallSupport()

```typescript
async validateToolCallSupport(model: string): Promise<{supported: boolean; message?: string}> {
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` }
    });
    
    if (!res.ok) {
      return {
        supported: false,
        message: 'Unable to verify model capabilities with OpenRouter API'
      };
    }
    
    const data = await res.json() as { data?: Array<{ id: string }> };
    const modelExists = data.data?.some(m => m.id === model);
    
    if (!modelExists) {
      return {
        supported: false,
        message: `Model "${model}" not found in OpenRouter. Check available models at https://openrouter.ai/models`
      };
    }
    
    return { supported: true };
  } catch (error) {
    logger.warn({ err: error }, 'OpenRouter validation check failed, proceeding anyway');
    return {
      supported: true,
      message: 'Could not verify model, proceeding with assumption of tool support'
    };
  }
}
```

**Purpose:** Check if model exists and supports tool calling
**Steps:**
1. Fetch model list from OpenRouter API
2. Check if requested model exists in list
3. Return appropriate support status
4. On error, log warning but proceed optimistically

**Error Handling:** Graceful degradation - assume support on network errors

### 5. chat()

```typescript
async chat(params: ChatParams): Promise<ChatResponse> {
  try {
    const body = {
      model: this.model,
      messages: params.messages as any,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      reasoning_effort: params.reasoning_effort ?? 'medium',
    };
    
    logger.debug(`call_chat : ${JSON.stringify(body, null, 2)}`);
    
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(body),
    });
    
    if (!res.ok) await handleApiError(res);
    
    const data = await res.json() as OpenAIChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    const generationId = extractGenerationId(data);
    const usage = extractUsage(data);
    
    logger.debug(`Generation ID: ${generationId}`);
    if (usage) {
      logger.debug(`Usage: ${usage.promptTokens} prompt + ${usage.completionTokens} completion = ${usage.totalTokens} total tokens`);
    }
    
    return { content };
  } catch (error) {
    logger.error({ err: error }, 'OpenRouter chat call failed');
    throw error;
  }
}
```

**Purpose:** Simple chat completion without tools
**Request Body:**
- model: From constructor
- messages: User-provided messages
- temperature: Default 0.7
- max_tokens: From constructor default
- reasoning_effort: Default 'medium' (for reasoning models)

**Response Handling:**
1. Check HTTP status, handle errors
2. Parse JSON response
3. Extract content from first choice
4. Default to empty string if missing

**Logging:** Debug request, error on failure

### 6. callWithTools()

```typescript
async callWithTools(params: LLMCallParams): Promise<LLMResponse> {
  try {
    const body = {
      model: this.model,
      messages: params.messages as any,
      tools: params.tools as any,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      reasoning_effort: params.reasoning_effort ?? 'medium',
    };
    
    logger.debug(`call_with_tools : ${JSON.stringify(body, null, 2)}`);
    
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(body),
    });
    
    if (!res.ok) await handleApiError(res);
    
    const data = await res.json() as OpenAIChatCompletionResponse;
    const choice = data.choices?.[0];
    const message = choice?.message ?? { content: '' };
    
    const toolCalls = message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: jsonParseSafe(tc.function.arguments),
    }));
    
    const ret = {
      thought: message.content ?? '',
      toolCalls,
      finishReason: mapFinishReason(choice?.finish_reason),
    };
    
    const generationId = extractGenerationId(data);
    const usage = extractUsage(data);
    
    logger.debug(`Generation ID: ${generationId}`);
    if (usage) {
      logger.debug(`Usage: ${usage.promptTokens} prompt + ${usage.completionTokens} completion = ${usage.totalTokens} total tokens`);
    }
    
    logger.debug(`call_with_tools : ${JSON.stringify(ret, null, 2)}`);
    return ret;
  } catch (error) {
    logger.error({ err: error }, 'OpenRouter API call failed');
    throw error;
  }
}
```

**Purpose:** Chat completion with function/tool calling support
**Request Body:** Same as chat() plus tools array
**Response Handling:**
1. Check HTTP status, handle errors
2. Parse JSON response
3. Extract message from first choice
4. Parse tool_calls if present:
   - Map to internal format
   - Parse arguments JSON safely
5. Map finish_reason
6. Return thought, toolCalls, finishReason

**Tool Call Parsing:**
- Extract id, name from tool call
- Safely parse arguments string to object
- Handle malformed JSON gracefully

## Error Handling Strategy

### HTTP Errors
1. Check `res.ok` after each fetch
2. Parse JSON error response if available
3. Fallback to text response
4. Attach status code and error details to Error object
5. Log and re-throw

### Timeout Handling
**Phase 1 (Initial):** Rely on default fetch timeout
**Phase 2 (Optional):** Add AbortController wrapper
```typescript
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
```

### Validation Errors
- Network failures in validateToolCallSupport(): Warn and proceed
- Missing model: Return supported: false with message
- Malformed responses: Use safe defaults (empty strings, empty arrays)

### Tool Call Parsing
- Use jsonParseSafe() to handle malformed arguments
- Log warnings but don't fail the entire request
- Return raw string if JSON parsing fails

## Streaming Support Considerations

**Phase 1:** Not implemented
**Reason:** Current LLMProvider interface returns complete responses

**Phase 2 (Future):** Server-Sent Events (SSE)
**Implementation approach:**
1. Add `stream: true` to request body
2. Parse `res.body` as ReadableStream
3. Split by lines starting with `data: `
4. Parse each delta chunk
5. Accumulate content and tool calls
6. Stop on `[DONE]` sentinel
7. Emit via callback (requires interface change)

**Example SSE parsing:**
```typescript
const reader = res.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      const chunk = JSON.parse(data);
      // Process delta...
    }
  }
}
```

## Type Safety Best Practices

1. **Minimal Type Definitions:** Define only what's needed, avoid importing entire SDK
2. **Safe Chaining:** Use optional chaining (`?.`) and nullish coalescing (`??`)
3. **Explicit Defaults:** Provide defaults for all optional fields
4. **Narrow Any Usage:** Only use `any` for messages/tools where shared types require it
5. **Error Enrichment:** Attach status/code/type to errors for caller inspection
6. **Type Guards:** Validate response structure before accessing nested properties

## Testing & Verification Checklist

### Unit Tests
- [ ] Constructor initializes fields correctly
- [ ] buildHeaders() returns all required headers
- [ ] mapFinishReason() handles all cases including unknown
- [ ] jsonParseSafe() handles valid JSON
- [ ] jsonParseSafe() handles invalid JSON and logs warning
- [ ] handleApiError() parses JSON errors
- [ ] handleApiError() handles text fallback

### Integration Tests
- [ ] validateToolCallSupport() succeeds for valid model
- [ ] validateToolCallSupport() fails for invalid model
- [ ] validateToolCallSupport() handles network errors gracefully
- [ ] chat() completes successfully
- [ ] chat() returns content from response
- [ ] callWithTools() completes successfully
- [ ] callWithTools() parses tool_calls correctly
- [ ] callWithTools() handles no tool_calls
- [ ] Error handling for 401 Unauthorized
- [ ] Error handling for 404 Not Found
- [ ] Error handling for 429 Rate Limit
- [ ] Error handling for 500 Server Error

### Manual Testing
- [ ] Test with various models (GPT-4, Claude, etc.)
- [ ] Test with reasoning models (reasoning_effort parameter)
- [ ] Test complex tool calling scenarios
- [ ] Verify logging output
- [ ] Check error messages are helpful

## Implementation Steps

### Step 1: Create File Structure
1. Create `packages/backend/src/agent/providers/openrouter-fetch.ts`
2. Add imports for shared types and logger
3. Define constants (BASE_URL, DEFAULT_TIMEOUT_MS)

### Step 2: Define Types
1. Add OpenAI-compatible type definitions
2. Keep minimal - only what's needed for parsing

### Step 3: Implement Helper Functions
1. `buildHeaders()` - request headers
2. `handleApiError()` - error parsing
3. `mapFinishReason()` - finish reason mapping
4. `jsonParseSafe()` - safe JSON parsing
5. `extractUsage()` - extract usage statistics
6. `extractGenerationId()` - extract generation ID

### Step 4: Implement Class
1. Constructor - store configuration
2. `validateToolCallSupport()` - model validation
3. `chat()` - simple completion
4. `callWithTools()` - completion with tools

### Step 5: Export Provider
Update `packages/backend/src/agent/providers/index.ts`:
```typescript
export { OpenRouterFetchProvider } from './openrouter-fetch.js';
```

### Step 6: Configuration Integration
Add provider selection logic in factory/initialization code:
```typescript
case 'openrouter-fetch':
  return new OpenRouterFetchProvider(apiKey, model, maxTokens);
```

### Step 7: Testing
1. Write unit tests for helpers
2. Write integration tests for API calls
3. Manual testing with real API

### Step 8: Documentation
1. Update README with new provider option
2. Add example configuration
3. Document differences from SDK-based provider

## Configuration Examples

### Environment Variables
```bash
LLM_PROVIDER=openrouter-fetch
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Code Usage
```typescript
const provider = new OpenRouterFetchProvider(
  process.env.OPENROUTER_API_KEY,
  'anthropic/claude-3.5-sonnet',
  4096
);

const response = await provider.callWithTools({
  messages: [{ role: 'user', content: 'Hello' }],
  tools: [...],
});
```

## Performance Considerations

1. **Network Efficiency:** Same as SDK-based (single HTTP call)
2. **Memory:** Slightly lower (no SDK overhead)
3. **Bundle Size:** Smaller (no OpenAI SDK dependency)
4. **Latency:** Identical (same API endpoint)

## Security Considerations

1. **API Key Handling:** Never log API keys
2. **Header Validation:** Use buildHeaders() consistently
3. **Error Sanitization:** Don't expose sensitive info in error messages
4. **Input Validation:** Sanitize messages before sending
5. **HTTPS Only:** Use BASE_URL with https://

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Node version < 18 (no global fetch) | High | Document requirement, consider undici polyfill |
| Malformed tool arguments | Medium | Use jsonParseSafe() with logging |
| Network timeouts | Medium | Add AbortController in Phase 2 |
| API changes | Low | OpenRouter follows OpenAI spec (stable) |
| Model capability variance | Low | Validate with validateToolCallSupport() |

## Advanced Features (Future)

### Retries with Backoff
```typescript
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || res.status < 500) return res;
      await sleep(Math.pow(2, i) * 1000 + Math.random() * 1000);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
  }
}
```

### Custom Headers Per Request
Add headers field to ChatParams/LLMCallParams:
```typescript
headers?: Record<string, string>
```

### Request/Response Logging
Add interceptor option:
```typescript
onRequest?: (req: RequestInit) => void;
onResponse?: (res: Response) => void;
```

## Success Criteria

1. ✅ Implements LLMProvider interface completely
2. ✅ Passes all existing provider tests
3. ✅ Behaves identically to openrouter.ts
4. ✅ No OpenAI SDK dependency
5. ✅ All error cases handled gracefully
6. ✅ Comprehensive logging
7. ✅ Type-safe implementation
8. ✅ Documentation complete

## Effort Estimates

- **Core Implementation:** 1-2 hours
- **Testing:** 1-2 hours
- **Documentation:** 30 minutes
- **Integration:** 30 minutes
- **Total:** 3-5 hours

## References

- [OpenRouter API Docs](https://openrouter.ai/docs/api-reference/overview)
- [OpenRouter Models](https://openrouter.ai/models)
- [Fetch API Spec](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- Existing implementation: `packages/backend/src/agent/providers/openrouter.ts`
