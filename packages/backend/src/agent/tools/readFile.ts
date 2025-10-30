import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { readFile as fsReadFile } from 'fs/promises';
import { join, resolve } from 'path';

const readFileInputSchema = z.object({
  path: z.string().describe('File path relative to artifacts directory'),
  maxLength: z.number().int().min(1).max(100000).default(50000).describe('Maximum bytes to read'),
});

type ReadFileInput = z.infer<typeof readFileInputSchema>;

interface ReadFileOutput {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
}

export class ReadFileTool extends BaseTool<ReadFileInput, ReadFileOutput> {
  name = 'readFile';
  description = 'Read content from a file in the artifacts directory';
  inputSchema = readFileInputSchema;

  private readonly ARTIFACTS_DIR = resolve('./artifacts');

  async execute(input: ReadFileInput, ctx: ToolContext): Promise<ReadFileOutput> {
    // Security: prevent path traversal
    const safePath = input.path.replace(/\.\./g, '');
    const fullPath = join(this.ARTIFACTS_DIR, safePath);

    // Ensure path is within artifacts directory
    if (!fullPath.startsWith(this.ARTIFACTS_DIR)) {
      throw new Error('Invalid path: must be within artifacts directory');
    }

    ctx.logger.info(`Reading file: ${safePath}`);

    try {
      const content = await fsReadFile(fullPath, 'utf-8');
      const size = Buffer.byteLength(content, 'utf-8');
      
      const truncated = size > input.maxLength;
      const finalContent = truncated ? content.slice(0, input.maxLength) : content;

      ctx.logger.info(`Read ${size} bytes from ${safePath}${truncated ? ' (truncated)' : ''}`);

      return {
        path: safePath,
        content: finalContent,
        size,
        truncated,
      };
    } catch (error) {
      ctx.logger.error('File read failed:', error);
      throw error;
    }
  }
}
