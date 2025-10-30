import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';

const webSearchInputSchema = z.object({
  query: z.string().describe('The search query'),
  limit: z.number().int().min(1).max(20).default(5).describe('Number of results to return'),
});

type WebSearchInput = z.infer<typeof webSearchInputSchema>;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearchTool extends BaseTool<WebSearchInput, SearchResult[]> {
  name = 'webSearch';
  description = 'Search the web for information using DuckDuckGo';
  inputSchema = webSearchInputSchema;

  async execute(input: WebSearchInput, ctx: ToolContext): Promise<SearchResult[]> {
    ctx.logger.info(`Searching web for: ${input.query}`);

    try {
      // Using DuckDuckGo HTML search (no API key needed)
      const response = await this.withTimeout(
        fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`),
        10000,
        'Web search timed out'
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const html = await response.text();
      const results = this.parseSearchResults(html, input.limit);

      ctx.logger.info(`Found ${results.length} search results`);
      return results;
    } catch (error) {
      ctx.logger.error('Web search failed:', error);
      throw error;
    }
  }

  private parseSearchResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Simple regex-based parsing (in production, use a proper HTML parser)
    const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < limit) {
      const url = this.cleanUrl(match[1]);
      const title = this.cleanText(match[2]);
      const snippet = this.cleanText(match[3]);
      
      if (url && title) {
        results.push({ title, url, snippet });
      }
    }

    // Fallback: if regex parsing fails, return mock results for demo
    if (results.length === 0) {
      return [{
        title: 'Search results unavailable',
        url: 'https://duckduckgo.com',
        snippet: 'Web search completed but parsing failed. Consider using a different search method.',
      }];
    }

    return results;
  }

  private cleanUrl(url: string): string {
    // DuckDuckGo wraps URLs in a redirect
    const match = url.match(/uddg=([^&]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return url;
  }

  private cleanText(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}
