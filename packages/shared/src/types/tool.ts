import type { z } from 'zod';

export interface ToolEventEmitter {
  progress(message: string): void;
  completed(message: string): void;
}

export interface ToolContext {
  logger: any;
  db: any;
  runId: string;
  abortSignal: AbortSignal;
  executionId?: string;
  subStepId?: string;
  emitEvent?: ToolEventEmitter;
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
