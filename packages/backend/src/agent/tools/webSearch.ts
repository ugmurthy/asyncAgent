import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import * as cheerio from 'cheerio';

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
    ctx.logger.info({query:input.query},`  ╰─Searching web...`);

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

      ctx.logger.info(`   ╰─Found ${results.length} search results`);
      return results;
    } catch (error) {
      ctx.logger.error({ err: error }, '   ╰─Web search failed');
      throw error;
    }
  }

  private parseSearchResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    
    try {
      const $ = cheerio.load(html);
      
      // Parse DuckDuckGo search results
      $('.result').each((_, element) => {
        if (results.length >= limit) return false;
        
        const titleLink = $(element).find('.result__a');
        const snippetElem = $(element).find('.result__snippet');
        
        const href = titleLink.attr('href');
        const title = titleLink.text().trim();
        const snippet = snippetElem.text().trim();
        
        if (href && title) {
          const url = this.cleanUrl(href);
          if (url) {
            results.push({ title, url, snippet });
          }
        }
      });
    } catch (error) {
      // If parsing fails, return fallback
    }

    // Fallback: if parsing fails, return mock results for demo
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
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return '';
      }
    }
    return url;
  }
}
