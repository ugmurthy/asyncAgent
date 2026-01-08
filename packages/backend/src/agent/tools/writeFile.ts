import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const writeFileInputSchema = z.object({
  path: z.string().describe('File path relative to artifacts directory'),
  content: z.string().describe('Content to write to the file'),
  mode: z.enum(['overwrite', 'append']).default('overwrite').describe('Write mode'),
});

type WriteFileInput = z.infer<typeof writeFileInputSchema>;

interface WriteFileOutput {
  path: string;
  fullPath: string;
  bytesWritten: number;
  mode: 'overwrite' | 'append';
}

export class WriteFileTool extends BaseTool<WriteFileInput, WriteFileOutput> {
  name = 'writeFile';
  description = 'Write content to a file in the artifacts directory';
  inputSchema = writeFileInputSchema;

  private readonly ARTIFACTS_DIR = resolve('./artifacts');

  private  stripOutermostFences(markdown:string):string {
  if (typeof markdown !== 'string') {
    return markdown;
  }

  // Trim leading/trailing whitespace to avoid issues with empty lines
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    return '';
  }

  // Regex to match a fence line: 3+ backticks or tildes, optional language, whitespace
  const fenceRegex = /^([ \t]*)([`~]{3,})[^`\n~]*$/;

  const lines = trimmed.split('\n');

  // Check the first line for opening fence
  const firstLineMatch = lines[0].match(fenceRegex);
  if (!firstLineMatch) {
    // No opening fence found → return as-is
    return markdown;
  }

  const openingFenceChar = firstLineMatch[2][0]; // ` or ~
  const openingFenceLength = firstLineMatch[2].length;

  // Find the closing fence: same character, at least same length
  let closingIndex = -1;
  for (let i = lines.length - 1; i > 0; i--) {
    const match = lines[i].match(fenceRegex);
    if (
      match &&
      match[2][0] === openingFenceChar &&
      match[2].length >= openingFenceLength
    ) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    // No matching closing fence → return original
    return markdown;
  }

  // Extract content between the fences (exclude opening and closing lines)
  const contentLines = lines.slice(1, closingIndex);

  // Join and restore original leading whitespace if needed
  // (optional: preserve indentation of the first content line)
  return contentLines.join('\n');
  }

  async execute(input: WriteFileInput, ctx: ToolContext): Promise<WriteFileOutput> {
    // Security: prevent path traversal
    const fullPath = resolve(this.ARTIFACTS_DIR, input.path);

    // Ensure path is within artifacts directory
    if (!fullPath.startsWith(this.ARTIFACTS_DIR)) {
      throw new Error('Invalid path: must be within artifacts directory');
    }

    const safePath = fullPath.substring(this.ARTIFACTS_DIR.length + 1);

    ctx.logger.info(`Writing file: ${safePath}`);

    try {
      // Ensure directory exists
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Write or append content
      if (input.mode === 'append' && existsSync(fullPath)) {
        const { readFile } = await import('fs/promises');
        const existing = await readFile(fullPath, 'utf-8');
        const newContent = existing + input.content;
        await writeFile(fullPath, newContent, 'utf-8');
      } else {
        await writeFile(fullPath, this.stripOutermostFences(input.content), 'utf-8');
      }

      const bytesWritten = Buffer.byteLength(input.content, 'utf-8');

      ctx.logger.info(`Wrote ${bytesWritten} bytes to ${safePath}`);
      ctx.emitEvent?.completed(`✏️ Wrote ${bytesWritten} bytes to ${safePath}`);
      return {
        path: safePath,
        fullPath,
        bytesWritten,
        mode: input.mode,
      };
    } catch (error) {
      ctx.logger.error({ err: error }, 'File write failed');
      throw error;
    }
  }
}
