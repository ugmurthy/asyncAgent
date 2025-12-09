import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { agents } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { LlmExecuteTool } from '../../agent/tools/llmExecute.js';
import { env } from '../../util/env.js';
import { logger } from '../../util/logger.js';

const taskParamsSchema = z.object({
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  reasoning_effort: z.enum(['low', 'medium', 'high']).optional(),
});

export async function taskRoutes(fastify: FastifyInstance) {
  const { db, log } = fastify;
  const llmExecuteTool = new LlmExecuteTool();

  fastify.post('/task', async (request, reply) => {
    try {
      const parts = await request.parts();
      
      let taskName: string | undefined;
      let prompt: string | undefined;
      let params: z.infer<typeof taskParamsSchema> = {};
      const files: Array<{ filename: string; content: string; mimeType?: string }> = [];

      for await (const part of parts) {
        if (part.type === 'field') {
          const fieldName = part.fieldname;
          const value = part.value as string;

          if (fieldName === 'taskName') {
            taskName = value;
          } else if (fieldName === 'prompt') {
            prompt = value;
          } else if (fieldName === 'params') {
            params = taskParamsSchema.parse(JSON.parse(value));
          }
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer();
          files.push({
            filename: part.filename,
            content: buffer.toString('base64'),
            mimeType: part.mimetype,
          });
        }
      }

      if (!taskName || !prompt) {
        return reply.code(400).send({ 
          error: 'taskName and prompt are required fields' 
        });
      }

      const agent = await db.query.agents.findFirst({
        where: and(
          eq(agents.name, taskName),
          eq(agents.active, true)
        ),
      });

      if (!agent) {
        return reply.code(404).send({ 
          error: `No active agent found with name: ${taskName}` 
        });
      }

      const maxTokens = params?.max_tokens ?? parseInt(env.DEFAULT_MAX_TOKENS);
      const temperature = params?.temperature ?? parseFloat(env.DEFAULT_TEMPERATURE);
      const reasoningEffort = params?.reasoning_effort ?? env.DEFAULT_REASONING_EFFORT as 'low' | 'medium' | 'high';

      const provider = agent.provider || env.LLM_PROVIDER;
      const model = agent.model || env.LLM_MODEL;

      log.info({
        taskName,
        prompt,
        provider,
        model,
        hasFiles: files.length > 0,
        fileCount: files.length,
        maxTokens,
        temperature,
        reasoningEffort,
      }, 'Executing task via llmExecute');

      const llmInput = {
        provider: provider as 'openai' | 'openrouter' | 'openrouter-fetch' | 'ollama',
        model,
        task: agent.promptTemplate,
        prompt,
        attachments: files.length > 0 ? files : undefined,
        params: {
          max_tokens: maxTokens,
          temperature,
          reasoning_effort: reasoningEffort,
        },
      };

      const result = await llmExecuteTool.execute(llmInput, {
        logger: log,
        runId: 'task-' + Date.now(),
        stepId: 'step-' + Date.now(),
      });
      log.info({ result }, 'Task execution completed');
      return reply.send({
        taskName,
        agentName: agent.name,
        agentVersion: agent.version,
        inputFiles: files.map(f => ({ filename: f.filename, mimeType: f.mimeType })),
        response: result.content,
        usage: result.usage,
        finishReason: result.finishReason,
        reasoning: result.reasoning,
        params: {
          provider,
          model,
          max_tokens: maxTokens,
          temperature,
          reasoning_effort: reasoningEffort,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Validation error', 
          details: error.errors 
        });
      }
      
      log.error({ err: error }, 'Task execution failed');
      return reply.code(500).send({ 
        error: 'Task execution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
