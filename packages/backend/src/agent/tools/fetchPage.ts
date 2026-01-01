import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import {PDFParse} from 'pdf-parse';

const fetchPageInputSchema = z.object({
  url: z.string().url().describe('The URL to fetch'),
  maxLength: z.number().int().min(100).max(50000).default(10000).describe('Maximum content length to return'),
});

type FetchPageInput = z.infer<typeof fetchPageInputSchema>;

interface FetchPageOutput {
  url: string;
  title: string;
  content: string;
  contentLength: number;
  truncated: boolean;
  contentType: string;
}

export class FetchPageTool extends BaseTool<FetchPageInput, FetchPageOutput> {
  name = 'fetchPage';
  description = 'Fetch and extract text content from a web page or PDF document';
  inputSchema = fetchPageInputSchema;

  private readonly ALLOWED_DOMAINS: string[] = [
    // Allow most domains, but could be restricted for security
  ];

  private readonly BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ];

  private readonly SUPPORTED_CONTENT_TYPES = [
    'text/html',
    'application/pdf',
  ];

  async execute(input: FetchPageInput, ctx: ToolContext): Promise<FetchPageOutput> {
    const url = new URL(input.url);

    if (this.BLOCKED_DOMAINS.some(d => url.hostname.includes(d))) {
      throw new Error(`Blocked domain: ${url.hostname}`);
    }

    ctx.logger.info(`🌐 fetching : ${input.url}`);
    ctx.emitEvent?.progress(`Fetching URL: ${input.url}`);

    try {
      const response = await this.withTimeout(
        fetch(input.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AsyncAgent/1.0)',
          },
          signal: ctx.abortSignal,
        }),
        15000,
        'Page fetch timed out'
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html');
      const isPdf = contentType.includes('application/pdf');

      if (!isHtml && !isPdf) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      let title: string;
      let content: string;

      if (isPdf) {
        //const arrayBuffer = await response.arrayBuffer();
        //const buffer = Buffer.from(arrayBuffer);
        //const pdfData = await pdfParse(buffer);
        //title = this.extractPdfTitle(pdfData, input.url);
        //content = this.cleanPdfText(pdfData.text);
        const parser = new PDFParse({url:input.url});
        content = (await parser.getText()).text;
        const result  = await parser.getInfo();
        title = result.info.Title || 'Untitled';
      } else {
        const html = await response.text();
        const extracted = this.extractTextContent(html);
        title = extracted.title;
        content = extracted.content;
      }

      const fullContent = content.slice(0, input.maxLength);
      const truncated = content.length > input.maxLength;

      ctx.logger.info(`╰─Fetched ${fullContent.length} chars`);
      ctx.emitEvent?.completed(`Fetched ${fullContent.length} chars from ${input.url}`);

      return {
        url: input.url,
        title,
        content: fullContent,
        contentLength: content.length,
        truncated,
        contentType: isPdf ? 'application/pdf' : 'text/html',
      };
    } catch (error) {
      ctx.logger.error({ err: (error as Error)?.message }, 'Page fetch failed');
      throw error;
    }
  }

  private extractPdfTitle(pdfData: Awaited<ReturnType<typeof pdfParse>>, url: string): string {
    if (pdfData.info?.Title) {
      return pdfData.info.Title;
    }
    const urlPath = new URL(url).pathname;
    const filename = urlPath.split('/').pop() || 'document.pdf';
    return filename.replace('.pdf', '');
  }

  private cleanPdfText(text: string): string {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  private extractTextContent(html: string): { title: string; content: string } {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');

    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const content = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    return { title, content };
  }
}
