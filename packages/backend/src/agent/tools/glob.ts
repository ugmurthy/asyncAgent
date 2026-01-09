import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { glob } from 'glob';
import { resolve, relative } from 'path';

const globInputSchema = z.object({
  pattern: z.string().describe('Glob pattern (e.g., "**/*.ts", "src/**/*.py")'),
  ignore: z
    .array(z.string())
    .default(['node_modules/**', '.git/**'])
    .describe('Patterns to ignore'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(100)
    .describe('Maximum number of files to return'),
});

type GlobInput = z.infer<typeof globInputSchema>;

interface GlobOutput {
  pattern: string;
  files: string[];
  count: number;
  truncated: boolean;
}

export class GlobTool extends BaseTool<GlobInput, GlobOutput> {
  name = 'glob';
  description =
    'Find files matching a glob pattern in the artifacts directory. Returns file paths relative to artifacts directory.';
  inputSchema = globInputSchema;

  private readonly ARTIFACTS_DIR = resolve('./artifacts');

  async execute(input: GlobInput, ctx: ToolContext): Promise<GlobOutput> {
    const { pattern, ignore, limit } = input;

    if (pattern.includes('..')) {
      throw new Error('Invalid pattern: cannot contain ".."');
    }

    ctx.logger.info(`Searching for files matching: ${pattern}`);

    try {
      const matches = await glob(pattern, {
        cwd: this.ARTIFACTS_DIR,
        nodir: true,
        ignore,
        absolute: false,
      });

      const allFiles = matches.map((file) => {
        const absolutePath = resolve(this.ARTIFACTS_DIR, file);
        if (!absolutePath.startsWith(this.ARTIFACTS_DIR)) {
          throw new Error('Invalid match: path escapes artifacts directory');
        }
        return relative(this.ARTIFACTS_DIR, absolutePath);
      });

      const truncated = allFiles.length > limit;
      const files = allFiles.slice(0, limit);

      ctx.logger.info(`Found ${allFiles.length} files matching "${pattern}"${truncated ? ` (limited to ${limit})` : ''}`);
      ctx.emitEvent?.completed(`🔍 Found ${allFiles.length} files matching "${pattern}"${truncated ? ` (showing ${limit})` : ''}`);

      return {
        pattern,
        files,
        count: allFiles.length,
        truncated,
      };
    } catch (error) {
      ctx.logger.error({ err: error }, 'Glob search failed');
      throw error;
    }
  }
}
