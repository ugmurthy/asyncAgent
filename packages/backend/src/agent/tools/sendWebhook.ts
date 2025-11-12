import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';

const sendWebhookInputSchema = z.object({
  url: z.string().url().describe('Webhook URL to send POST request to'),
  payload: z.record(z.any()).describe('JSON payload to send'),
  headers: z.record(z.string()).optional().describe('Optional custom headers'),
});

type SendWebhookInput = z.infer<typeof sendWebhookInputSchema>;

interface SendWebhookOutput {
  url: string;
  status: number;
  statusText: string;
  success: boolean;
  response?: any;
}

export class SendWebhookTool extends BaseTool<SendWebhookInput, SendWebhookOutput> {
  name = 'sendWebhook';
  description = 'Send a POST request with JSON payload to a webhook URL';
  inputSchema = sendWebhookInputSchema;

  async execute(input: SendWebhookInput, ctx: ToolContext): Promise<SendWebhookOutput> {
    ctx.logger.info(`Sending webhook to: ${input.url}`);

    try {
      const response = await this.retry(
        async () => {
          return await this.withTimeout(
            fetch(input.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AsyncAgent/1.0',
                ...input.headers,
              },
              body: JSON.stringify(input.payload),
              signal: ctx.abortSignal,
            }),
            10000,
            'Webhook request timed out'
          );
        },
        3,
        1000
      );

      const success = response.ok;
      let responseData: any;

      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }
      } catch {
        responseData = null;
      }

      ctx.logger.info(`Webhook response: ${response.status} ${response.statusText}`);

      return {
        url: input.url,
        status: response.status,
        statusText: response.statusText,
        success,
        response: responseData,
      };
    } catch (error) {
      ctx.logger.error({ err: error }, 'Webhook send failed');
      throw error;
    }
  }
}
