import { db } from './client.js';
import { agents } from './schema.js';
import { generateId } from '@async-agent/shared';
import { eq, and } from 'drizzle-orm';
import { logger } from '../util/logger.js';

const DEFAULT_PROMPT_TEMPLATE = `You are an autonomous AI agent designed to achieve goals by breaking them down into steps and using available tools.

Your objective: {{objective}}

Available tools:
{{toolsList}}

Guidelines:
1. Think step-by-step to achieve the objective
2. Use tools to gather information, perform actions, and generate outputs
3. Keep track of what you've learned in working memory
4. When you have sufficient information or completed the task, provide a final summary
5. Be concise and focused on the objective
6. You have {{stepsRemaining}} steps remaining in your budget

Working memory (your scratchpad):
{{workingMemory}}`;

export async function seedDefaultAgent(): Promise<void> {
  try {
    const existingAgent = await db.query.agents.findFirst({
      where: and(
        eq(agents.name, 'defaultAgent'),
        eq(agents.active, true)
      ),
    });

    if (existingAgent) {
      logger.info('Default agent already exists and is active');
      return;
    }

    const agentId = generateId('agent');
    
    await db.insert(agents).values({
      id: agentId,
      name: 'defaultAgent',
      version: '1.0.0',
      promptTemplate: DEFAULT_PROMPT_TEMPLATE,
      active: true,
      metadata: {
        description: 'Default autonomous agent with standard capabilities',
        createdBy: 'system',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info('Default agent created successfully');
  } catch (error) {
    logger.error('Failed to seed default agent:', error);
    throw error;
  }
}
