/**
 * Handler for DAG execution SSE events endpoint
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { subSteps, executions } from '../../../../db/schema.js';
import { dagEventBus, type DAGEvent } from '../../../../events/bus.js';
import type { RouteContext } from '../types.js';

export function registerEventRoutes(
  fastify: FastifyInstance,
  context: RouteContext
) {
  const { log } = fastify;
  const db = (fastify as any).db;

  /**
   * GET /dag-executions/:id/events - Server-Sent Events stream for DAG execution
   */
  fastify.get('/dag-executions/:id/events', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    let params;
    try {
      params = paramsSchema.parse(request.params);
    } catch (error) {
      return reply.code(400).send({
        error: 'Invalid parameters',
        validation_errors: error instanceof z.ZodError ? error.issues : [],
      });
    }

    const { id } = params;

    const executionResult = await db
      .select()
      .from(executions)
      .where(eq(executions.id, id))
      .limit(1);

    if (!executionResult || executionResult.length === 0) {
      return reply.code(404).send({
        error: `DAG execution with id '${id}' not found`,
      });
    }

    const execution = executionResult[0];

    const subStepsList = await db.query.subSteps.findMany({
      where: eq(subSteps.executionId, id),
      orderBy: (subSteps, { asc }) => [asc(subSteps.taskId)],
    });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    const sendEvent = (event: DAGEvent) => {
      try {
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        log.error({ err: error, executionId: id }, 'Failed to send SSE event');
      }
    };

    const onEvent = (event: DAGEvent) => {
      if (event.executionId === id) {
        sendEvent(event);
      }
    };

    dagEventBus.on('dag:event', onEvent);

    sendEvent({
      type: 'execution.updated',
      executionId: id,
      timestamp: Date.now(),
      status: execution.status,
      completedTasks: execution.completedTasks,
      failedTasks: execution.failedTasks,
      waitingTasks: execution.waitingTasks,
    });

    const heartbeatInterval = setInterval(() => {
      try {
        sendEvent({
          type: 'heartbeat',
          executionId: id,
          timestamp: Date.now(),
        });
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      dagEventBus.off('dag:event', onEvent);
      log.info({ executionId: id }, 'SSE connection closed');
    });

    request.raw.on('error', () => {
      clearInterval(heartbeatInterval);
      dagEventBus.off('dag:event', onEvent);
    });
  });
}
