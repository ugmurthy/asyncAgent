import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { logger } from '../util/logger.js';
import { env } from '../util/env.js';

const fastify = Fastify({
  logger: logger,
});

// Register plugins
await fastify.register(cors);
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/health/ready', async () => {
  // TODO: Check DB connection, scheduler status
  return { 
    status: 'ready',
    provider: env.LLM_PROVIDER,
    timestamp: new Date().toISOString(),
  };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(env.PORT);
    const host = env.HOST;
    
    await fastify.listen({ port, host });
    logger.info(`Server listening on ${host}:${port}`);
    logger.info(`LLM Provider: ${env.LLM_PROVIDER}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await fastify.close();
    process.exit(0);
  });
});

start();
