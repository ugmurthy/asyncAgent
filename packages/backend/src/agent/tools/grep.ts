import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { readFile } from 'fs/promises';
import { stat } from 'fs/promises';
import { join, resolve } from 'path';
import { glob } from 'glob';

const grepInputSchema = z.object({
  pattern: z.string().describe('Regex pattern to search for'),
  path: z
    .string()
    .default('.')
    .describe('Directory or file path to search in (relative to artifacts, defaults to ".")'),
  glob: z
    .string()
    .optional()
    .describe('File glob pattern to filter files (e.g., "**/*.ts")'),
  caseSensitive: z.boolean().default(true).describe('Whether search is case sensitive'),
  maxResults: z.number().int().min(1).max(1000).default(50).describe('Maximum number of matches to return'),
});

type GrepInput = z.infer<typeof grepInputSchema>;

interface GrepMatch {
  file: string;
  line: number;
  content: string;
  match: string;
}

interface GrepOutput {
  pattern: string;
  matches: GrepMatch[];
  totalMatches: number;
  filesSearched: number;
  truncated: boolean;
}

export class GrepTool extends BaseTool<GrepInput, GrepOutput> {
  name = 'grep';
  description =
    'Search file contents with regex patterns in the artifacts directory. Returns matching lines with file paths and line numbers.';
  inputSchema = grepInputSchema;

  private readonly ARTIFACTS_DIR = resolve('./artifacts');

  private isBinaryFile(buffer: Buffer): boolean {
    const sampleSize = Math.min(buffer.length, 8000);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  }

  private sanitizePath(inputPath: string): string {
    return inputPath.replace(/\.\./g, '');
  }

  async execute(input: GrepInput, ctx: ToolContext): Promise<GrepOutput> {
    const safePath = this.sanitizePath(input.path);
    const fullPath = join(this.ARTIFACTS_DIR, safePath);

    if (!fullPath.startsWith(this.ARTIFACTS_DIR)) {
      throw new Error('Invalid path: must be within artifacts directory');
    }

    ctx.logger.info(`Grep search: pattern="${input.pattern}" path="${safePath}"`);
    ctx.emitEvent?.started(`🔍 Searching for "${input.pattern}" in ${safePath}`);

    const flags = input.caseSensitive ? 'g' : 'gi';
    let regex: RegExp;
    try {
      regex = new RegExp(input.pattern, flags);
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${input.pattern}`);
    }

    const matches: GrepMatch[] = [];
    let totalMatches = 0;
    let filesSearched = 0;
    let truncated = false;

    const filesToSearch: string[] = [];

    try {
      const pathStat = await stat(fullPath);

      if (pathStat.isFile()) {
        filesToSearch.push(fullPath);
      } else if (pathStat.isDirectory()) {
        const globPattern = input.glob || '**/*';
        const foundFiles = await glob(globPattern, {
          cwd: fullPath,
          nodir: true,
          absolute: true,
        });
        filesToSearch.push(...foundFiles);
      }
    } catch (error) {
      throw new Error(`Path not found: ${safePath}`);
    }

    for (const filePath of filesToSearch) {
      if (truncated) break;

      try {
        const buffer = await readFile(filePath);

        if (this.isBinaryFile(buffer)) {
          ctx.logger.debug(`Skipping binary file: ${filePath}`);
          continue;
        }

        filesSearched++;
        const content = buffer.toString('utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          regex.lastIndex = 0;
          const matchResult = regex.exec(line);

          if (matchResult) {
            totalMatches++;

            if (matches.length < input.maxResults) {
              const relativePath = filePath.startsWith(this.ARTIFACTS_DIR)
                ? filePath.slice(this.ARTIFACTS_DIR.length + 1)
                : filePath;

              matches.push({
                file: relativePath,
                line: i + 1,
                content: line.slice(0, 200),
                match: matchResult[0],
              });
            } else {
              truncated = true;
            }
          }
        }
      } catch (error) {
        ctx.logger.debug(`Could not read file: ${filePath}`);
      }
    }

    ctx.logger.info(
      `Grep complete: ${totalMatches} matches in ${filesSearched} files${truncated ? ' (truncated)' : ''}`
    );
    ctx.emitEvent?.completed(
      `🔍 Found ${totalMatches} matches in ${filesSearched} files${truncated ? ' (results truncated)' : ''}`
    );

    return {
      pattern: input.pattern,
      matches,
      totalMatches,
      filesSearched,
      truncated,
    };
  }
}
