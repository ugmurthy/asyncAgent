import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const editInputSchema = z.object({
  path: z.string().describe('File path relative to artifacts directory'),
  oldText: z.string().describe('The exact text to find and replace'),
  newText: z.string().describe('The text to replace with'),
  replaceAll: z.boolean().default(false).describe('Whether to replace all occurrences'),
});

type EditInput = z.infer<typeof editInputSchema>;

interface EditOutput {
  path: string;
  fullPath: string;
  replacements: number;
  success: boolean;
}

export class EditTool extends BaseTool<EditInput, EditOutput> {
  name = 'edit';
  description = 'Edit an existing file by replacing specific text with new text';
  inputSchema = editInputSchema;

  private readonly ARTIFACTS_DIR = resolve('./artifacts');

  async execute(input: EditInput, ctx: ToolContext): Promise<EditOutput> {
    const fullPath = resolve(this.ARTIFACTS_DIR, input.path);

    if (!fullPath.startsWith(this.ARTIFACTS_DIR)) {
      throw new Error('Invalid path: must be within artifacts directory');
    }

    const safePath = fullPath.substring(this.ARTIFACTS_DIR.length + 1);

    ctx.logger.info(`Editing file: ${safePath}`);

    try {
      const content = await readFile(fullPath, 'utf-8');

      if (!content.includes(input.oldText)) {
        throw new Error(`Text not found in file: "${input.oldText.slice(0, 50)}${input.oldText.length > 50 ? '...' : ''}"`);
      }

      let newContent: string;
      let replacements: number;

      if (input.replaceAll) {
        const parts = content.split(input.oldText);
        replacements = parts.length - 1;
        newContent = parts.join(input.newText);
      } else {
        replacements = 1;
        newContent = content.replace(input.oldText, input.newText);
      }

      await writeFile(fullPath, newContent, 'utf-8');

      ctx.logger.info(`Made ${replacements} replacement(s) in ${safePath}`);
      ctx.emitEvent?.completed(`✏️ Made ${replacements} replacement(s) in ${safePath}`);

      return {
        path: safePath,
        fullPath,
        replacements,
        success: true,
      };
    } catch (error) {
      ctx.logger.error({ err: error }, 'File edit failed');
      throw error;
    }
  }
}
