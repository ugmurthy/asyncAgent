import type { FastifyInstance } from 'fastify';
import { runs, steps } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export async function runsRoutes(fastify: FastifyInstance) {
  const { db } = fastify;

  // List runs
  fastify.get('/runs', async (request, reply) => {
    const { goalId, status } = request.query as { goalId?: string; status?: string };

    let query = db.query.runs.findMany({
      with: {
        goal: true,
      },
      orderBy: [desc(runs.createdAt)],
      limit: 50,
    });

    // Apply filters if needed (note: drizzle-orm filtering in queries is limited)
    const allRuns = await query;
    
    let filtered = allRuns;
    if (goalId) {
      filtered = filtered.filter(r => r.goalId === goalId);
    }
    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    reply.send(filtered);
  });

  // Get run by ID
  fastify.get('/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const run = await db.query.runs.findFirst({
      where: eq(runs.id, id),
      with: {
        goal: true,
      },
    });

    if (!run) {
      return reply.code(404).send({ error: 'Run not found' });
    }

    reply.send(run);
  });

  // Get run steps
  fastify.get('/runs/:id/steps', async (request, reply) => {
    const { id } = request.params as { id: string };

    const run = await db.query.runs.findFirst({
      where: eq(runs.id, id),
    });

    if (!run) {
      return reply.code(404).send({ error: 'Run not found' });
    }

    const runSteps = await db.query.steps.findMany({
      where: eq(steps.runId, id),
      orderBy: [steps.stepNo],
    });

    reply.send(runSteps);
  });

  // Delete run
  fastify.delete('/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.runs.findFirst({
      where: eq(runs.id, id),
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Run not found' });
    }

    await db.delete(runs).where(eq(runs.id, id));

    reply.code(204).send();
  });
}
