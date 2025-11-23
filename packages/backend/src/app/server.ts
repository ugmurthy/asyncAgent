import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { logger } from '../util/logger.js';
import { env } from '../util/env.js';
import { db, closeDatabase } from '../db/client.js';
import { createLLMProvider, validateLLMSetup } from '../agent/providers/index.js';
import { defaultToolRegistry } from '../agent/tools/index.js';
import { CronScheduler } from '../scheduler/cron.js';
import { goalsRoutes } from './routes/goals.js';
import { runsRoutes } from './routes/runs.js';
import { agentsRoutes } from './routes/agents.js';
import { dagRoutes } from './routes/dag.js';
import { toolsRoutes } from './routes/tools.js';
import { artifactsRoutes } from './routes/artifacts.js';
import { seedDefaultAgent } from '../db/seed.js';

const fastify = Fastify({
  logger: logger,
});

// Decorate fastify with db
fastify.decorate('db', db);

// Register plugins
await fastify.register(cors, {
  origin: ['https://local.drizzle.studio','http://localhost:5174','http://localhost:5173','null'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Cache-Control']
});
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Initialize LLM provider and validate
const llmProvider = createLLMProvider();
await validateLLMSetup(llmProvider, env.LLM_MODEL);

// Initialize scheduler
const scheduler = new CronScheduler({
  db,
  logger,
  llmProvider,
  toolRegistry: defaultToolRegistry,
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/health/ready', async () => {
  return { 
    status: 'ready',
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL,
    scheduler: scheduler.getStats(),
    timestamp: new Date().toISOString(),
  };
});

// Register routes
await fastify.register(agentsRoutes, { prefix: '/api/v1' });
await fastify.register(goalsRoutes, { prefix: '/api/v1', scheduler });
await fastify.register(runsRoutes, { prefix: '/api/v1' });
await fastify.register(dagRoutes, { prefix: '/api/v1', llmProvider, toolRegistry: defaultToolRegistry });
await fastify.register(toolsRoutes, { prefix: '/api/v1', toolRegistry: defaultToolRegistry });
await fastify.register(artifactsRoutes, { prefix: '/api/v1' });

// Start server
const start = async () => {
  try {
    const port = parseInt(env.PORT);
    const host = env.HOST;
    
    // Seed default agent
    await seedDefaultAgent();
    
    // Start scheduler
    await scheduler.start();
    
    await fastify.listen({ port, host });
    logger.info(`Server listening on ${host}:${port}`);
    logger.info(`LLM Provider: ${env.LLM_PROVIDER} (${env.LLM_MODEL})`);
    logger.info(`Scheduler: ${scheduler.getStats().activeSchedules} active schedules`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    // Stop scheduler
    await scheduler.stop();
    
    // Close server
    await fastify.close();
    
    // Close database
    closeDatabase();
    
    logger.info('Shutdown complete');
    process.exit(0);
  });
});

start();
