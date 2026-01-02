import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext, MessageContent } from '@async-agent/shared';
import { createLLMProvider } from '../providers/index.js';
import type { LLMProviderType } from '@async-agent/shared';

const attachmentSchema = z.object({
  filename: z.string().describe('Name of the file'),
  content: z.string().describe('Content of the file'),
  mimeType: z.string().optional().describe('MIME type of the file'),
});

const paramsSchema = z.object({
  reasoning_effort: z.enum(['low', 'medium', 'high']).optional().describe('Reasoning effort level'),
  max_tokens: z.number().int().positive().optional().describe('Maximum tokens in response'),
  temperature: z.number().min(0).max(2).optional().describe('Temperature for response randomness'),
}).optional();

const llmExecuteInputSchema = z.object({
  provider: z.enum(['openai', 'openrouter', 'openrouter-fetch', 'ollama']).describe('LLM provider name'),
  model: z.string().describe('Model name to use'),
  task: z.string().describe('Task name or identifier'),
  prompt: z.string().describe('Prompt to send to the LLM'),
  attachments: z.array(attachmentSchema).optional().describe('Optional array of file attachments'),
  params: paramsSchema.describe('Optional parameters for LLM call'),
});

type LlmExecuteInput = z.infer<typeof llmExecuteInputSchema>;

interface LlmExecuteOutput {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  costUsd?: number;
  generationStats?: Record<string, any>;
  finishReason?: string;
  reasoning?: string;
}

export class LlmExecuteTool extends BaseTool<LlmExecuteInput, LlmExecuteOutput> {
  name = 'llmExecute';
  description = 'Execute a prompt using a specified LLM provider and model with optional attachments and parameters';
  inputSchema = llmExecuteInputSchema;

  private isImageFile(mimeType?: string, filename?: string): boolean {
    const imageMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    
    if (mimeType && imageMimeTypes.includes(mimeType.toLowerCase())) {
      return true;
    }

    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '');
    }

    return false;
  }

  private getImageMimeType(mimeType?: string, filename?: string): string {
    if (mimeType) {
      return mimeType;
    }

    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      switch (ext) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        case 'gif': return 'image/gif';
        default: return 'image/jpeg';
      }
    }

    return 'image/jpeg';
  }

  private convertToBase64DataUrl(content: string, mimeType: string): string {
    return `data:${mimeType};base64,${content}`;
  }

  async execute(input: LlmExecuteInput, ctx: ToolContext): Promise<LlmExecuteOutput> {
    ctx.logger.debug({
      provider: input.provider,
      model: input.model,
      //task: input.task,
      hasAttachments: !!input.attachments?.length,
    }, '╰─Executing LLM call');

    try {
      const provider = createLLMProvider({
        provider: input.provider as LLMProviderType,
        model: input.model,
      });

      const validation = await provider.validateToolCallSupport(input.model);
      if (!validation.supported) {
        ctx.logger.warn(` ╰─Model ${input.model} not supported: ${validation.message}`);
      }

      let userContent: MessageContent = input.prompt;

      if (input.attachments && input.attachments.length > 0) {
        const textFiles = input.attachments.filter(
          att => !this.isImageFile(att.mimeType, att.filename)
        );
        const imageFiles = input.attachments.filter(
          att => this.isImageFile(att.mimeType, att.filename)
        );

        const hasImages = imageFiles.length > 0;
        const supportsMultimodal = input.provider === 'openrouter-fetch';

        if (hasImages && supportsMultimodal) {
          const contentParts: Array<{
            type: 'text' | 'image_url';
            text?: string;
            image_url?: { url: string };
          }> = [];

          contentParts.push({
            type: 'text',
            text: input.prompt,
          });

          if (textFiles.length > 0) {
            const textContent = textFiles
              .map(att => `\n\n--- File: ${att.filename} ---\n${att.content}`)
              .join('');
            contentParts.push({
              type: 'text',
              text: textContent,
            });
          }

          for (const img of imageFiles) {
            const mimeType = this.getImageMimeType(img.mimeType, img.filename);
            const dataUrl = this.convertToBase64DataUrl(img.content, mimeType);
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            });
          }

          userContent = contentParts;
          
          ctx.logger.info(` ╰─Using multimodal content with ${textFiles.length} docs & ${imageFiles.length} images`);
        } else {
          if (hasImages && !supportsMultimodal) {
            ctx.logger.warn({
              provider: input.provider,
              ignoredImages: imageFiles.length,
            }, 'Image attachments ignored - provider does not support multimodal');
          }

          if (textFiles.length > 0) {
            const attachmentText = textFiles
              .map(att => `\n\n--- File: ${att.filename} ---\n${att.content}`)
              .join('');
            userContent = `${input.prompt}${attachmentText}`;
          }
        }
      }

      const messages = [
        {
          role: 'system' as const,
          content: `Task: ${input.task}`,
        },
        {
          role: 'user' as const,
          content: userContent,
        },
      ];

      const temperature = input.params?.temperature ?? 0.7;
      const maxTokens = input.params?.max_tokens;

      const response = await provider.chat({
        messages,
        temperature,
        maxTokens,
      });

      ctx.logger.debug('LLM execution completed');

      return {
        content: response.content,
        usage: response.usage,
        costUsd: response.costUsd,
        generationStats: response.generationStats,
      };
    } catch (error) {
      ctx.logger.error({
        err: error,
        provider: input.provider,
        model: input.model,
        task: input.task,
      }, 'LLM execution failed');
      throw error;
    }
  }
}
