import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import * as cheerio from 'cheerio';

const webSearchInputSchema = z.object({
  query: z.string().describe('The search query - could be list of bulleted queries '),
  limit: z.number().int().min(1).max(20).default(10).describe('Number of results to return per query'),
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
    ctx.logger.info(` ╰─Searching web...input for ${input.query.slice(50)+'...'}`);
    const queries = this.extractSearchQueries(input.query);
    //ctx.logger.info({queries},` ╰─Searching web...input as list`);
    const allResults: SearchResult[][] = [];

    for (const query of queries) {
      try {
        // Using DuckDuckGo HTML search (no API key needed)
        const response = await this.withTimeout(
          fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`),
          10000,
          'Web search timed out'
        );

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const html = await response.text();
        const results = this.parseSearchResults(html, input.limit);

        ctx.logger.info(` ╰─Found ${results.length} search results for query: ${query.slice(0, 50)+'...'}`);
        allResults.push(results);
      } catch (error) {
        ctx.logger.error({ err: error, query }, ' ╰─Web search failed');
        throw error;
      }
    }

    return allResults.flat();
  }
  /**
 * Extracts search queries from a block of text containing an ordered or unordered list.
 * Each list item is expected to contain a string in double quotes (e.g., "query here").
 * The function returns only the content inside the quotes.
 *
 * Supports:
 * - Ordered lists: 1., 2., etc.
 * - Unordered lists: *, -, •, etc.
 *
 * @param text The input text containing the list
 * @returns An array of extracted query strings
 */
private extractSearchQueries(text: string): string[] {
  // Split the input into lines and remove leading/trailing whitespace
  const lines: string[] = text.trim().split('\n');

  const queries: string[] = lines
    .map((line: string) => {
      // Remove leading list markers (numbers with dot, bullets, etc.) and trim
      let cleaned: string = line
        .trim()
        .replace(/^(\d+\.|\*\s*|\-\s*|•\s*)/, '')
        .trim();

      // Extract text inside double quotes
      const match: RegExpMatchArray | null = cleaned.match(/"([^"]*)"/);
      if (match) {
        return match[1]; // Content inside the quotes
      }

      // Fallback: return cleaned line if no quotes found
      return cleaned;
    })
    .filter((query: string) => query.length > 0); // Remove empty entries

  return queries;
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
