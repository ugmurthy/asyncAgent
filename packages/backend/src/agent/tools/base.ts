import type { Tool, ToolContext, ToolDefinition } from '@async-agent/shared';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export abstract class BaseTool<TInput = any, TOutput = any> implements Tool<TInput, TOutput> {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodType<TInput>;

  abstract execute(input: TInput, ctx: ToolContext): Promise<TOutput>;

  toJSONSchema(): ToolDefinition {
    const jsonSchema = zodToJsonSchema(this.inputSchema, {
      $refStrategy: 'none',
    });

    // Remove the root $schema property that zod-to-json-schema adds
    const { $schema, ...parameters } = jsonSchema as any;

    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters,
      },
    };
  }

  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      ),
    ]);
  }

  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }
}
