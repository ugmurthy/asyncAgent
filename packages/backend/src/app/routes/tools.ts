import type { FastifyInstance } from 'fastify';
import type { ToolRegistry } from '../../agent/tools/index.js';

export async function toolsRoutes(
  fastify: FastifyInstance,
  { toolRegistry }: { toolRegistry: ToolRegistry }
) {
  const { log } = fastify;

  // Get all tool definitions or specific tool by name
  fastify.get('/tools', async (request, reply) => {
    const { name } = request.query as { name?: string };

    try {
      // If name parameter is provided, return specific tool
      if (name) {
        const tool = toolRegistry.get(name);
        
        if (!tool) {
          return reply.code(404).send({ 
            error: `Tool not found: ${name}` 
          });
        }
        
        return reply.send(tool.toJSONSchema());
      }

      // Otherwise return all tools
      const allTools = toolRegistry.getAllDefinitions();
      reply.send(allTools);
    } catch (error) {
      log.error('Failed to get tools:', error);
      reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to get tools' 
      });
    }
  });
}
