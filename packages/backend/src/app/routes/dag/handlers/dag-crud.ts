/**
 * Handlers for DAG CRUD operations (List, Get, Update, Delete)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, desc, isNotNull } from 'drizzle-orm';
import cronstrue from 'cronstrue';
import { dags, dagExecutions } from '../../../../db/schema.js';
import { validateCronExpression } from '../../../../utils/cron-validator.js';
import { DagIdParamsSchema, DagListQuerySchema, DagUpdateBodySchema } from '../schemas.js';
import type { RouteContext } from '../types.js';

export function registerDagCrudRoutes(
  fastify: FastifyInstance,
  context: RouteContext
) {
  const { log } = fastify;
  const db = (fastify as any).db;
  const { dagScheduler } = context;

  /**
   * GET /dags - List all DAGs
   */
  fastify.get('/dags', async (request, reply) => {
    try {
      const { limit, offset, status } = DagListQuerySchema.parse(request.query);

      const whereConditions = status ? eq(dags.status, status) : undefined;

      const dagList = await db.query.dags.findMany({
        where: whereConditions,
        orderBy: desc(dags.createdAt),
        limit,
        offset,
      });

      const serializedDags = dagList.map(dag => ({
        ...dag,
        createdAt: dag.createdAt?.toISOString(),
        updatedAt: dag.updatedAt?.toISOString(),
      }));

      return reply.code(200).send({
        dags: serializedDags,
        pagination: {
          limit,
          offset,
          count: dagList.length,
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to list DAGs');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid query parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * GET /dags/scheduled - List all DAGs with a cron schedule
   */
  fastify.get('/dags/scheduled', async (request, reply) => {
    try {
      const scheduledDags = await db.query.dags.findMany({
        where: isNotNull(dags.cronSchedule),
        orderBy: desc(dags.updatedAt),
      });

      const results = scheduledDags.map(dag => {
        let scheduleDescription = 'Invalid schedule';
        if (dag.cronSchedule) {
          try {
            scheduleDescription = cronstrue.toString(dag.cronSchedule);
          } catch (e) {
            log.warn({ dagId: dag.id, schedule: dag.cronSchedule, err: e }, 'Failed to parse cron schedule');
          }
        }

        return {
          id: dag.id,
          dag_title: dag.dagTitle,
          cron_schedule: dag.cronSchedule,
          schedule_description: scheduleDescription,
          schedule_active: dag.scheduleActive
        };
      });

      return reply.code(200).send(results);

    } catch (error) {
      log.error({ err: error }, 'Failed to list scheduled DAGs');
      return reply.code(500).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /dags/:id - Get DAG by ID
   */
  fastify.get('/dags/:id', async (request, reply) => {
    try {
      const { id } = DagIdParamsSchema.parse(request.params);

      const dag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!dag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      return reply.code(200).send(dag);

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * PATCH /dags/:id - Update DAG
   */
  fastify.patch('/dags/:id', async (request, reply) => {
    try {
      const { id } = DagIdParamsSchema.parse(request.params);
      const updateData = DagUpdateBodySchema.parse(request.body);

      if (updateData.cronSchedule) {
        const validation = validateCronExpression(updateData.cronSchedule);
        if (!validation.valid) {
          return reply.code(400).send({
            error: 'Invalid cron expression',
            details: validation.error,
          });
        }
      }

      const existingDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!existingDag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      await db.update(dags)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(dags.id, id));

      const updatedDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (dagScheduler && (updateData.cronSchedule !== undefined || updateData.scheduleActive !== undefined)) {
        const finalSchedule = updateData.cronSchedule ?? updatedDag?.cronSchedule;
        const finalActive = updateData.scheduleActive ?? updatedDag?.scheduleActive;
        
        if (finalSchedule && finalActive) {
          dagScheduler.updateDAGSchedule(id, finalSchedule, finalActive);
          log.info({ dagId: id, cronSchedule: finalSchedule, scheduleActive: finalActive }, 'DAG schedule updated');
        } else {
          dagScheduler.unregisterDAGSchedule(id);
          log.info({ dagId: id }, 'DAG schedule unregistered');
        }
      }

      log.info({ dagId: id, updates: Object.keys(updateData) }, 'DAG updated successfully');

      return reply.code(200).send(updatedDag);

    } catch (error) {
      log.error({ err: error }, 'Failed to update DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * DELETE /dag/:id - Delete a DAG (only if no executions exist)
   */
  fastify.delete('/dag/:id', async (request, reply) => {
    try {
      const { id } = DagIdParamsSchema.parse(request.params);

      const existingDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!existingDag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      const relatedExecutions = await db.query.dagExecutions.findMany({
        where: eq(dagExecutions.dagId, id),
      });

      if (relatedExecutions.length > 0) {
        return reply.code(409).send({
          error: `Cannot delete DAG: ${relatedExecutions.length} execution(s) exist for this DAG`,
          dagId: id,
          executionCount: relatedExecutions.length,
        });
      }

      await db.delete(dags).where(eq(dags.id, id));

      if (dagScheduler) {
        dagScheduler.unregisterDAGSchedule(id);
      }

      log.info({ dagId: id }, 'DAG deleted successfully');

      return reply.code(200).send({
        message: 'DAG deleted successfully',
        dagId: id,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to delete DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * DELETE /dags/:id - Delete a DAG (same as /dag/:id)
   */
  fastify.delete('/dags/:id', async (request, reply) => {
    try {
      const { id } = DagIdParamsSchema.parse(request.params);

      const existingDag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!existingDag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      const relatedExecutions = await db.query.dagExecutions.findMany({
        where: eq(dagExecutions.dagId, id),
      });

      if (relatedExecutions.length > 0) {
        return reply.code(409).send({
          error: `Cannot delete DAG: ${relatedExecutions.length} execution(s) exist for this DAG`,
          dagId: id,
          executionCount: relatedExecutions.length,
        });
      }

      await db.delete(dags).where(eq(dags.id, id));

      if (dagScheduler) {
        dagScheduler.unregisterDAGSchedule(id);
      }

      log.info({ dagId: id }, 'DAG deleted successfully');

      return reply.code(200).send({
        message: 'DAG deleted successfully',
        dagId: id,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to delete DAG');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid parameters',
          validation_errors: error.issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });
}
