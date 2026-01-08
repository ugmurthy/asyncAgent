import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { readFile as fsReadFile } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { PDFParse } from 'pdf-parse';

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
  isPdf?: boolean;
  pdfPages?: number;
}

export class ReadFileTool extends BaseTool<ReadFileInput, ReadFileOutput> {
  name = 'readFile';
  description = 'Read content from a file in the artifacts directory. Supports text files and PDFs (extracts text from PDFs).';
  inputSchema = readFileInputSchema;

  private readonly ARTIFACTS_DIR = resolve('./artifacts');

  private isPdfFile(filePath: string): boolean {
    return extname(filePath).toLowerCase() === '.pdf';
  }

  private async extractPdfText(fullPath: string): Promise<{ text: string; numPages: number }> {
    const buffer = await fsReadFile(fullPath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return {
      text: result.text,
      numPages: result.total,
    };
  }

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
      let content: string;
      let isPdf = false;
      let pdfPages: number | undefined;

      if (this.isPdfFile(safePath)) {
        isPdf = true;
        ctx.logger.info(`Extracting text from PDF: ${safePath}`);
        const pdfResult = await this.extractPdfText(fullPath);
        content = pdfResult.text;
        pdfPages = pdfResult.numPages;
      } else {
        content = await fsReadFile(fullPath, 'utf-8');
      }

      const size = Buffer.byteLength(content, 'utf-8');
      const truncated = size > input.maxLength;
      const finalContent = truncated ? content.slice(0, input.maxLength) : content;

      const pdfInfo = isPdf ? ` (${pdfPages} pages)` : '';
      ctx.logger.info(`Read ${size} bytes from ${safePath}${pdfInfo}${truncated ? ' (truncated)' : ''}`);
      ctx.emitEvent?.completed(`📄 Read ${size} bytes from ${safePath}${pdfInfo}`);

      return {
        path: safePath,
        content: finalContent,
        size,
        truncated,
        ...(isPdf && { isPdf, pdfPages }),
      };
    } catch (error) {
      ctx.logger.error({ err: error }, 'File read failed');
      throw error;
    }
  }
}
