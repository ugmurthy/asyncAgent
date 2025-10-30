import type { FastifyInstance } from 'fastify';
import { runs, steps } from '../../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export async function runsRoutes(fastify: FastifyInstance) {
  const { db } = fastify;

  // List runs
  fastify.get('/runs', async (request, reply) => {
    const { goalId, status } = request.query as { goalId?: string; status?: string };

    // Build where conditions
    const conditions = [];
    if (goalId) {
      conditions.push(eq(runs.goalId, goalId));
    }
    if (status) {
      conditions.push(eq(runs.status, status as any));
    }

    const allRuns = await db.query.runs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        goal: true,
      },
      orderBy: [desc(runs.createdAt)],
      limit: 50,
    });

    reply.send(allRuns);
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
