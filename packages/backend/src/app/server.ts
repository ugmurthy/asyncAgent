import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { logger } from '../util/logger.js';
import { env } from '../util/env.js';
import { db, closeDatabase } from '../db/client.js';
import { createLLMProvider, validateLLMSetup } from '../agent/providers/index.js';
import { defaultToolRegistry } from '../agent/tools/index.js';
import { DAGScheduler } from '../scheduler/dag-scheduler.js';
import { agentsRoutes } from './routes/agents.js';
import { dagRoutes } from './routes/dag.js';
import { toolsRoutes } from './routes/tools.js';
import { artifactsRoutes } from './routes/artifacts.js';
import { taskRoutes } from './routes/task.js';
import { seedDefaultAgent } from '../db/seed.js';

const fastify = Fastify({
  logger: logger,
});

// Decorate fastify with db
fastify.decorate('db', db);

// Register plugins
await fastify.register(cors, {
  origin: ['https://local.drizzle.studio','http://localhost:5174','http://localhost:5173','http://100.100.172.104:5173','http://100.74.33.17:5173','null'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Cache-Control']
});
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Initialize LLM provider and validate
const llmProvider = createLLMProvider();
await validateLLMSetup(llmProvider, env.LLM_MODEL);

// Initialize DAG scheduler
const dagScheduler = new DAGScheduler({
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
    dagScheduler: dagScheduler.getStats(),
    timestamp: new Date().toISOString(),
  };
});

// Register routes
await fastify.register(agentsRoutes, { prefix: '/api/v1' });
await fastify.register(dagRoutes, { prefix: '/api/v1', llmProvider, toolRegistry: defaultToolRegistry, dagScheduler });
await fastify.register(toolsRoutes, { prefix: '/api/v1', toolRegistry: defaultToolRegistry });
await fastify.register(artifactsRoutes, { prefix: '/api/v1' });
await fastify.register(taskRoutes, { prefix: '/api/v1' });

// Start server
const start = async () => {
  try {
    const port = parseInt(env.PORT);
    const host = env.HOST;
    
    // Seed default agent
    await seedDefaultAgent();
    
    // Start DAG scheduler
    await dagScheduler.start();
    
    await fastify.listen({ port, host });
    logger.info(`Server listening on ${host}:${port}`);
    logger.info(`LLM Provider: ${env.LLM_PROVIDER} (${env.LLM_MODEL})`);
    logger.info(`DAG Scheduler: ${dagScheduler.getStats().activeSchedules} active schedules`);
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
    
    // Stop DAG scheduler
    await dagScheduler.stop();
    
    // Close server
    await fastify.close();
    
    // Close database
    closeDatabase();
    
    logger.info('Shutdown complete');
    process.exit(0);
  });
});

start();
