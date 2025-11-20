import { FastifyInstance } from 'fastify';
import { resolve, join, basename } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { logger } from '../../util/logger.js';

const ARTIFACTS_DIR = resolve('./artifacts');

export const artifactsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/artifacts/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    
    // Security: basic path traversal prevention by using basename (though filename param from fastify handles / differently)
    // But to be safe, we only allow reading from the root of artifacts dir for now as per requirements.
    // If subdirectories are needed, we need more complex check.
    // The example shows "bangalore-times.md" which is a simple filename.
    
    // Let's ensure we resolve it and check containment
    const safeFilename = basename(filename);
    const fullPath = resolve(ARTIFACTS_DIR, safeFilename);
    
    if (!fullPath.startsWith(ARTIFACTS_DIR)) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    if (!existsSync(fullPath)) {
      return reply.code(404).send({ error: 'Artifact not found' });
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      return content; // Return raw content
    } catch (error) {
      logger.error({ err: error, filename }, 'Failed to read artifact');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
