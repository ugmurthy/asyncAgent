/**
 * Handlers for DAG cost tracking endpoints
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { dags, dagExecutions, subSteps } from '../../../../db/schema.js';
import { DagIdParamsSchema, CostSummaryQuerySchema } from '../schemas.js';
import { parseDate, formatDateByGroup } from '../utils.js';
import type { RouteContext } from '../types.js';

export function registerCostRoutes(
  fastify: FastifyInstance,
  context: RouteContext
) {
  const { log } = fastify;
  const db = (fastify as any).db;

  /**
   * GET /dag-executions/:id/costs - Get cost breakdown for a specific execution
   */
  fastify.get('/dag-executions/:id/costs', async (request, reply) => {
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

      const dag = execution.dagId 
        ? await db.query.dags.findFirst({ where: eq(dags.id, execution.dagId) })
        : null;

      const allSubSteps = await db.query.subSteps.findMany({
        where: eq(subSteps.executionId, id),
      });

      const synthesisStep = allSubSteps.find(s => s.toolOrPromptName === '__synthesis__');
      const taskSteps = allSubSteps.filter(s => s.toolOrPromptName !== '__synthesis__');

      const planningCost = parseFloat(dag?.planningTotalCostUsd ?? '0');
      const executionCost = parseFloat(execution.totalCostUsd ?? '0');

      return reply.code(200).send({
        dagId: execution.dagId,
        executionId: id,
        planning: dag ? {
          totalUsage: dag.planningTotalUsage,
          totalCostUsd: dag.planningTotalCostUsd,
          attempts: dag.planningAttempts,
        } : null,
        execution: {
          totalUsage: execution.totalUsage,
          totalCostUsd: execution.totalCostUsd,
          subSteps: taskSteps.map(s => ({
            id: s.id,
            taskId: s.taskId,
            actionType: s.actionType,
            toolOrPromptName: s.toolOrPromptName,
            usage: s.usage,
            costUsd: s.costUsd,
          })),
          synthesis: synthesisStep ? {
            usage: synthesisStep.usage,
            costUsd: synthesisStep.costUsd,
          } : null,
        },
        totals: {
          planningCostUsd: dag?.planningTotalCostUsd ?? '0',
          executionCostUsd: execution.totalCostUsd ?? '0',
          grandTotalCostUsd: (planningCost + executionCost).toString(),
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve execution costs');
      
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
   * GET /dags/:id/costs - Get total cost for a DAG (planning + all executions)
   */
  fastify.get('/dags/:id/costs', async (request, reply) => {
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

      const allExecutions = await db.query.dagExecutions.findMany({
        where: eq(dagExecutions.dagId, id),
      });

      const executionTotalCost = allExecutions.reduce(
        (sum, e) => sum + parseFloat(e.totalCostUsd ?? '0'), 
        0
      );

      const planningCost = parseFloat(dag.planningTotalCostUsd ?? '0');

      return reply.code(200).send({
        dagId: id,
        planning: {
          totalUsage: dag.planningTotalUsage,
          totalCostUsd: dag.planningTotalCostUsd,
          attempts: dag.planningAttempts,
        },
        executions: allExecutions.map(e => ({
          executionId: e.id,
          status: e.status,
          totalCostUsd: e.totalCostUsd,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
        })),
        totals: {
          planningCostUsd: dag.planningTotalCostUsd ?? '0',
          executionsCostUsd: executionTotalCost.toString(),
          grandTotalCostUsd: (planningCost + executionTotalCost).toString(),
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve DAG costs');
      
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
   * GET /costs/summary - Get cost summary across all DAGs
   */
  fastify.get('/costs/summary', async (request, reply) => {
    try {
      const { from, to, groupBy } = CostSummaryQuerySchema.parse(request.query);

      const fromDate = parseDate(from, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      const toDate = parseDate(to, new Date());

      const allDags = await db.query.dags.findMany();
      const allExecutions = await db.query.dagExecutions.findMany();

      const costsByDate = new Map<string, { planningCostUsd: number; executionCostUsd: number }>();

      for (const dag of allDags) {
        if (!dag.createdAt) continue;
        const dagDate = new Date(dag.createdAt);
        if (dagDate < fromDate || dagDate > toDate) continue;
        
        const dateKey = formatDateByGroup(dagDate, groupBy);
        const existing = costsByDate.get(dateKey) ?? { planningCostUsd: 0, executionCostUsd: 0 };
        existing.planningCostUsd += parseFloat(dag.planningTotalCostUsd ?? '0');
        costsByDate.set(dateKey, existing);
      }

      for (const exec of allExecutions) {
        if (!exec.completedAt) continue;
        const execDate = new Date(exec.completedAt);
        if (execDate < fromDate || execDate > toDate) continue;
        
        const dateKey = formatDateByGroup(execDate, groupBy);
        const existing = costsByDate.get(dateKey) ?? { planningCostUsd: 0, executionCostUsd: 0 };
        existing.executionCostUsd += parseFloat(exec.totalCostUsd ?? '0');
        costsByDate.set(dateKey, existing);
      }

      const summary = Array.from(costsByDate.entries())
        .map(([date, costs]) => ({
          date,
          planningCostUsd: costs.planningCostUsd.toString(),
          executionCostUsd: costs.executionCostUsd.toString(),
          totalCostUsd: (costs.planningCostUsd + costs.executionCostUsd).toString(),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totals = summary.reduce(
        (acc, day) => ({
          planningCostUsd: acc.planningCostUsd + parseFloat(day.planningCostUsd),
          executionCostUsd: acc.executionCostUsd + parseFloat(day.executionCostUsd),
          totalCostUsd: acc.totalCostUsd + parseFloat(day.totalCostUsd),
        }),
        { planningCostUsd: 0, executionCostUsd: 0, totalCostUsd: 0 }
      );

      return reply.code(200).send({
        dateRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          groupBy,
        },
        summary,
        totals: {
          planningCostUsd: totals.planningCostUsd.toString(),
          executionCostUsd: totals.executionCostUsd.toString(),
          totalCostUsd: totals.totalCostUsd.toString(),
        },
      });

    } catch (error) {
      log.error({ err: error }, 'Failed to retrieve cost summary');
      
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
