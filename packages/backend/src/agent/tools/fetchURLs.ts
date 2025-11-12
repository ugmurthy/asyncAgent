import { z } from 'zod';
import { BaseTool } from './base.js';
import { FetchPageTool } from './fetchPage.js';
import type { ToolContext } from '@async-agent/shared';

const fetchURLsInputSchema = z.object({
  urls: z.array(
    z.union([
      z.string(),
      z.record(z.unknown())
    ])
  ).describe('Array of URLs as strings or JSON objects')
});

type FetchURLsInput = z.infer<typeof fetchURLsInputSchema>;

interface FetchPageOutput {
  url: string;
  title: string;
  content: string;
  contentLength: number;
  truncated: boolean;
}

type FetchURLsOutput = FetchPageOutput[];

export class FetchURLsTool extends BaseTool<FetchURLsInput, FetchURLsOutput> {
  name = 'fetchURLs';
  description = 'Extract valid URLs from mixed input (strings or objects) and fetch content from each';
  inputSchema = fetchURLsInputSchema;

  private fetchPageTool = new FetchPageTool();

  async execute(input: FetchURLsInput, ctx: ToolContext): Promise<FetchURLsOutput> {
    const urls: string[] = [];

    for (const item of input.urls) {
      if (typeof item === 'string') {
        try {
          new URL(item);
          urls.push(item);
        } catch {
          ctx.logger.warn(`Invalid URL string: ${item}`);
        }
      } else if (typeof item === 'object' && item !== null) {
        const possibleURLKeys = ['url', 'URL', 'link', 'href', 'uri'];
        let foundURL = false;

        for (const key of possibleURLKeys) {
          if (key in item && typeof item[key] === 'string') {
            try {
              new URL(item[key] as string);
              urls.push(item[key] as string);
              foundURL = true;
              break;
            } catch {
              continue;
            }
          }
        }

        if (!foundURL) {
          ctx.logger.warn(`No valid URL found in object: ${JSON.stringify(item)}`);
        }
      }
    }

    ctx.logger.info(`Extracted ${urls.length} valid URLs from ${input.urls.length} items`);

    const results: FetchPageOutput[] = [];

    for (const url of urls) {
      try {
        const result = await this.fetchPageTool.execute({ url, maxLength: 10000 }, ctx);
        results.push(result);
      } catch (error) {
        ctx.logger.error({ err: error }, `Failed to fetch ${url}`);
      }
    }

    return results;
  }
}
