/**
 * Handlers for DAG execution endpoints (List, Get, Sub-steps, Delete)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { dags, dagExecutions, subSteps, executions } from '../../../../db/schema.js';
import { 
  DagIdParamsSchema, 
  ExecutionListQuerySchema,
  DagExecutionsQuerySchema 
} from '../schemas.js';
import type { RouteContext } from '../types.js';

export function registerDagExecutionRoutes(
  fastify: FastifyInstance,
  context: RouteContext
) {
  const { log } = fastify;
  const db = (fastify as any).db;

  /**
   * GET /dag-executions/:id - Get DAG execution details
   */
  fastify.get('/dag-executions/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

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

      return reply.code(200).send({
        ...execution,
        subSteps: subStepsList,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve DAG execution');
      
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
   * GET /dag-executions/:id/sub-steps - Get all sub-steps for an execution
   */
  fastify.get('/dag-executions/:id/sub-steps', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const execution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, id),
      });

      if (!execution) {
        return reply.code(404).send({
          error: `DAG execution with id '${id}' not found`,
        });
      }

      const steps = await db.query.subSteps.findMany({
        where: eq(subSteps.executionId, id),
        orderBy: (subSteps, { asc }) => [asc(subSteps.taskId)],
      });

      return reply.code(200).send({
        executionId: id,
        subSteps: steps,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve sub-steps');
      
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
   * GET /dag-executions - List all DAG executions
   */
  fastify.get('/dag-executions', async (request, reply) => {
    try {
      const { limit, offset, status } = ExecutionListQuerySchema.parse(request.query);

      let executionsList;
      if (status) {
        executionsList = await db
          .select()
          .from(executions)
          .where(eq(executions.status, status))
          .limit(limit)
          .offset(offset);
      } else {
        executionsList = await db
          .select()
          .from(executions)
          .limit(limit)
          .offset(offset);
      }

      return reply.code(200).send({
        executions: executionsList,
        pagination: {
          limit,
          offset,
          count: executionsList.length,
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to list DAG executions');
      
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
   * GET /dags/:id/executions - Get executions for a specific DAG
   */
  fastify.get('/dags/:id/executions', async (request, reply) => {
    try {
      const { id } = DagIdParamsSchema.parse(request.params);
      const { limit, offset, status } = DagExecutionsQuerySchema.parse(request.query);

      const dag = await db.query.dags.findFirst({
        where: eq(dags.id, id),
      });

      if (!dag) {
        return reply.code(404).send({
          error: `DAG with id '${id}' not found`,
        });
      }

      const conditions = [eq(dagExecutions.dagId, id)];
      if (status) {
        conditions.push(eq(dagExecutions.status, status));
      }

      const executionsList = await db.query.dagExecutions.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: (dagExecutions, { desc }) => [desc(dagExecutions.createdAt)],
      });

      const allExecutions = await db.query.dagExecutions.findMany({
        where: and(...conditions),
      });

      return reply.code(200).send({
        executions: executionsList,
        total: allExecutions.length,
        limit,
        offset,
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve DAG executions');
      
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
   * DELETE /dag-executions/:id - Delete a DAG execution and cascade to related sub-steps
   */
  fastify.delete('/dag-executions/:id', async (request, reply) => {
    try {
      const paramsSchema = z.object({
        id: z.string().min(1),
      });

      const { id } = paramsSchema.parse(request.params);

      const existingExecution = await db.query.dagExecutions.findFirst({
        where: eq(dagExecutions.id, id),
      });

      if (!existingExecution) {
        return reply.code(404).send({
          error: `DAG execution with id '${id}' not found`,
        });
      }

      const relatedSubSteps = await db.query.subSteps.findMany({
        where: eq(subSteps.executionId, id),
      });

      await db.delete(dagExecutions).where(eq(dagExecutions.id, id));

      log.info({ 
        executionId: id, 
        cascadedSubSteps: relatedSubSteps.length 
      }, 'DAG execution deleted successfully');

      return reply.code(200).send({
        message: 'DAG execution deleted successfully',
        executionId: id,
        cascadeInfo: {
          relatedSubStepsDeleted: relatedSubSteps.length,
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to delete DAG execution');
      
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
