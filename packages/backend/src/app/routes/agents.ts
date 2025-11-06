import type { FastifyInstance } from 'fastify';
import { agents } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@async-agent/shared';
import { z } from 'zod';

const createAgentSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  promptTemplate: z.string().min(1),
  provider: z.string().optional(),
  model: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const activateAgentSchema = z.object({
  id: z.string(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  promptTemplate: z.string().min(1).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function agentsRoutes(fastify: FastifyInstance) {
  const { db, log } = fastify;

  fastify.post('/agents', async (request, reply) => {
    const body = createAgentSchema.parse(request.body);

    const existing = await db.query.agents.findFirst({
      where: and(
        eq(agents.name, body.name),
        eq(agents.version, body.version)
      ),
    });

    if (existing) {
      return reply.code(409).send({ 
        error: 'Agent with this name and version already exists' 
      });
    }

    const agentId = generateId('agent');
    
    await db.insert(agents).values({
      id: agentId,
      name: body.name,
      version: body.version,
      promptTemplate: body.promptTemplate,
      provider: body.provider,
      model: body.model,
      active: false,
      metadata: body.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    reply.code(201).send(agent);
  });

  fastify.get('/agents', async (request, reply) => {
    const { name, active } = request.query as { 
      name?: string; 
      active?: string;
    };

    let query = db.query.agents.findMany({
      orderBy: (agents, { desc }) => [desc(agents.createdAt)],
    });

    if (name || active !== undefined) {
      const conditions = [];
      if (name) conditions.push(eq(agents.name, name));
      if (active !== undefined) {
        conditions.push(eq(agents.active, active === 'true'));
      }

      const allAgents = await db.query.agents.findMany({
        where: conditions.length > 1 ? and(...conditions) : conditions[0],
        orderBy: (agents, { desc }) => [desc(agents.createdAt)],
      });
      
      return reply.send(allAgents);
    }

    const allAgents = await query;
    reply.send(allAgents);
  });

  fastify.get('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    reply.send(agent);
  });

  fastify.patch('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateAgentSchema.parse(request.body);

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    if (body.name && body.version && (body.name !== agent.name || body.version !== agent.version)) {
      const existing = await db.query.agents.findFirst({
        where: and(
          eq(agents.name, body.name),
          eq(agents.version, body.version)
        ),
      });

      if (existing) {
        return reply.code(409).send({
          error: 'Agent with this name and version already exists'
        });
      }
    }

    const updates: any = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.version !== undefined) updates.version = body.version;
    if (body.promptTemplate !== undefined) updates.promptTemplate = body.promptTemplate;
    if (body.provider !== undefined) updates.provider = body.provider;
    if (body.model !== undefined) updates.model = body.model;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    await db.update(agents)
      .set(updates)
      .where(eq(agents.id, id));

    const updated = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    reply.send(updated);
  });

  fastify.post('/agents/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    await db.update(agents)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(agents.name, agent.name));

    await db.update(agents)
      .set({ active: true, updatedAt: new Date() })
      .where(eq(agents.id, id));

    const updated = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    reply.send(updated);
  });

  fastify.delete('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    if (agent.active) {
      return reply.code(400).send({ 
        error: 'Cannot delete active agent. Activate another version first.' 
      });
    }

    await db.delete(agents).where(eq(agents.id, id));

    reply.code(204).send();
  });

  fastify.get('/agents/resolve/:name', async (request, reply) => {
    const { name } = request.params as { name: string };

    const agent = await db.query.agents.findFirst({
      where: and(
        eq(agents.name, name),
        eq(agents.active, true)
      ),
    });

    if (!agent) {
      return reply.code(404).send({ 
        error: `No active agent found with name: ${name}` 
      });
    }

    reply.send(agent);
  });
}
