import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';

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
}

export class FetchPageTool extends BaseTool<FetchPageInput, FetchPageOutput> {
  name = 'fetchPage';
  description = 'Fetch and extract text content from a web page';
  inputSchema = fetchPageInputSchema;

  private readonly ALLOWED_DOMAINS: string[] = [
    // Allow most domains, but could be restricted for security
  ];

  private readonly BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ];

  async execute(input: FetchPageInput, ctx: ToolContext): Promise<FetchPageOutput> {
    const url = new URL(input.url);

    // Security check: block internal/private URLs
    if (this.BLOCKED_DOMAINS.some(d => url.hostname.includes(d))) {
      throw new Error(`Blocked domain: ${url.hostname}`);
    }

    ctx.logger.info(`Fetching page: ${input.url}`);

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
      if (!contentType.includes('text/html')) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const html = await response.text();
      const { title, content } = this.extractTextContent(html);

      const fullContent = content.slice(0, input.maxLength);
      const truncated = content.length > input.maxLength;

      ctx.logger.info(`Fetched ${fullContent.length} chars from ${input.url}`);

      return {
        url: input.url,
        title,
        content: fullContent,
        contentLength: content.length,
        truncated,
      };
    } catch (error) {
      ctx.logger.error('Page fetch failed:', error);
      throw error;
    }
  }

  private extractTextContent(html: string): { title: string; content: string } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    // Remove scripts, styles, and other non-content tags
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');

    // Remove all HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // Clean up whitespace
    const content = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    return { title, content };
  }
}
