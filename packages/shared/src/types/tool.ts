import type { z } from 'zod';

export interface ToolContext {
  logger: any;
  db: any;
  runId: string;
  abortSignal: AbortSignal;
}

export interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
  toJSONSchema(): any;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}
