import type { FastifyInstance } from 'fastify';
import { createGoalSchemaFactory, updateGoalSchemaFactory, generateGoalId, generateId } from '@async-agent/shared';
import { goals, schedules, agents } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { CronScheduler } from '../../scheduler/cron.js';
import { env } from '../../util/env.js';
import type { DrizzleDB } from '../../db/index.js';

type ResolveAgentResult = 
  | { success: true; agentId: string | undefined }
  | { success: false; error: string };

async function resolveAgentId(
  db: DrizzleDB,
  body: { agentName?: string; agentId?: string }
): Promise<ResolveAgentResult> {
  if ('agentName' in body && body.agentName) {
    const agent = await db.query.agents.findFirst({
      where: and(
        eq(agents.name, body.agentName),
        eq(agents.active, true)
      ),
    });
    
    if (!agent) {
      return { 
        success: false, 
        error: `No active agent found with name: ${body.agentName}` 
      };
    }
    
    return { success: true, agentId: agent.id };
  }
  
  if ('agentId' in body && body.agentId) {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, body.agentId),
    });
    
    if (!agent) {
      return { 
        success: false, 
        error: `Agent not found with id: ${body.agentId}` 
      };
    }
    
    return { success: true, agentId: agent.id };
  }
  
  const defaultAgent = await db.query.agents.findFirst({
    where: and(
      eq(agents.name, 'defaultAgent'),
      eq(agents.active, true)
    ),
  });
  
  return { 
    success: true, 
    agentId: defaultAgent?.id 
  };
}

const createGoalSchema = createGoalSchemaFactory(parseInt(env.MAX_MESSAGE_LENGTH, 10));
const updateGoalSchema = updateGoalSchemaFactory(parseInt(env.MAX_MESSAGE_LENGTH, 10));

export async function goalsRoutes(
  fastify: FastifyInstance,
  { scheduler }: { scheduler: CronScheduler }
) {
  const { db, log } = fastify;

  // Create goal
  fastify.post('/goals', async (request, reply) => {
    const body = createGoalSchema.parse(request.body);

    const result = await resolveAgentId(db, body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    const agentId = result.agentId;

    const goalId = generateGoalId();
    
    await db.insert(goals).values({
      id: goalId,
      objective: body.objective,
      params: body.params || {},
      webhookUrl: body.webhookUrl,
      agentId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create schedule if provided
    if (body.schedule) {
      const scheduleId = generateId('sched');
      
      await db.insert(schedules).values({
        id: scheduleId,
        goalId,
        cronExpr: body.schedule.cronExpr,
        timezone: body.schedule.timezone,
        active: true,
        createdAt: new Date(),
      });

      // Register with scheduler
      const schedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, scheduleId),
        with: { goal: true },
      });

      if (schedule) {
        scheduler.registerSchedule(schedule);
      }
    }

    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
    });

    reply.code(201).send(goal);
  });

  // List goals
  fastify.get('/goals', async (request, reply) => {
    const { status } = request.query as { status?: 'active' | 'paused' | 'archived' };

    const allGoals = status
      ? await db.query.goals.findMany({
          where: eq(goals.status, status),
          orderBy: (goals, { desc }) => [desc(goals.createdAt)],
          with: {
            schedules: true,
            agent: true,
          },
        })
      : await db.query.goals.findMany({
          orderBy: (goals, { desc }) => [desc(goals.createdAt)],
          with: {
            schedules: true,
            agent: true,
          },
        });

    reply.send(allGoals);
  });

  // Get goal by ID
  fastify.get('/goals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, id),
      with: {
        schedules: true,
      },
    });

    if (!goal) {
      return reply.code(404).send({ error: 'Goal not found' });
    }

    reply.send(goal);
  });

  // Update goal
  fastify.patch('/goals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGoalSchema.parse(request.body);

    const existing = await db.query.goals.findFirst({
      where: eq(goals.id, id),
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Goal not found' });
    }

    await db.update(goals)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(goals.id, id));

    const updated = await db.query.goals.findFirst({
      where: eq(goals.id, id),
    });

    reply.send(updated);
  });

  // Delete goal
  fastify.delete('/goals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.goals.findFirst({
      where: eq(goals.id, id),
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Goal not found' });
    }

    // Unregister schedules
    const goalSchedules = await db.query.schedules.findMany({
      where: eq(schedules.goalId, id),
    });

    for (const schedule of goalSchedules) {
      scheduler.unregisterSchedule(schedule.id);
    }

    // Delete goal (cascades to schedules and runs)
    await db.delete(goals).where(eq(goals.id, id));

    reply.code(204).send();
  });

  // Trigger goal manually
  fastify.post('/goals/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const runId = await scheduler.triggerGoal(id);
      reply.send({ runId, message: 'Run triggered' });
    } catch (error) {
      log.error('Failed to trigger goal:', error);
      reply.code(400).send({ 
        error: error instanceof Error ? error.message : 'Failed to trigger goal' 
      });
    }
  });

  // Pause/resume goal
  fastify.post('/goals/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string };

    await db.update(goals)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(goals.id, id));

    // Deactivate associated schedules
    const goalSchedules = await db.query.schedules.findMany({
      where: eq(schedules.goalId, id),
    });

    for (const schedule of goalSchedules) {
      await db.update(schedules)
        .set({ active: false })
        .where(eq(schedules.id, schedule.id));
      
      scheduler?.unregisterSchedule(schedule.id);
    }

    reply.send({ message: 'Goal paused' });
  });

  fastify.post('/goals/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string };

    await db.update(goals)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(goals.id, id));

    // Reactivate associated schedules
    const goalSchedules = await db.query.schedules.findMany({
      where: eq(schedules.goalId, id),
    });

    for (const schedule of goalSchedules) {
      await db.update(schedules)
        .set({ active: true })
        .where(eq(schedules.id, schedule.id));
      
      scheduler?.registerSchedule({ ...schedule, goal: { id } });
    }

    reply.send({ message: 'Goal resumed' });
  });
}
