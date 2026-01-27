import type { AsyncAgentClient } from '@async-agent/api-js-client';

export interface CommandContext {
  client: AsyncAgentClient;
  formatOutput: (data: any, useMarkdown?: boolean, useHorizontal?: boolean) => void;
  formatError: (error: any) => void;
}

export interface Command {
  pattern: RegExp;
  description: string;
  examples: string[];
  handler: (ctx: CommandContext, args: string[], useMarkdown?: boolean, useHorizontal?: boolean) => Promise<void>;
}

export const commands: Command[] = [
  {
    pattern: /^help$/i,
    description: 'Show this help message',
    examples: ['help'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      console.log('\n📚 Available Commands:\n');
      commands.forEach((cmd) => {
        console.log(`  ${cmd.description}`);
        cmd.examples.forEach((ex) => console.log(`    → ${ex}`));
        console.log('');
      });
      console.log('  Modifiers:');
      console.log('    → Add --markdown to any command for formatted table output');
      console.log('    → Add --horizontal to render each array item as a separate key/value table');
      console.log('    → Example: list agents --markdown');
      console.log('    → Example: list agents --horizontal\n');
    },
  },

  {
    pattern: /^health$/i,
    description: 'Check API health',
    examples: ['health'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const health = await ctx.client.health.getHealth();
        ctx.formatOutput(health, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^ready$/i,
    description: 'Check API readiness',
    examples: ['ready'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const ready = await ctx.client.health.getHealthReady();
        ctx.formatOutput(ready, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^create\s+agent$/i,
    description: 'Create a new agent (interactive)',
    examples: ['create agent'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      const readline = await import('readline/promises');
      
      // Pause stdin to prevent double input from parent readline
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false, // Disable terminal mode to prevent double echo
      });

      try {
        const name = await rl.question('Agent name: ');
        const version = await rl.question('Version [1.0.0]: ');
        const promptTemplate = await rl.question('Prompt template (multiline, press Ctrl+D when done):\n');
        
        const agentRequest = {
          name: name.trim(),
          version: version.trim() || '1.0.0',
          promptTemplate: promptTemplate.trim(),
        };

        const result = await ctx.client.agents.createAgent({ requestBody: agentRequest });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      } finally {
        rl.close();
        // Resume stdin for parent readline
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      }
    },
  },

  {
    pattern: /^list\s+agents?$/i,
    description: 'List all agents',
    examples: ['list agents', 'list agent'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const agents = await ctx.client.agents.listAgents({});
        ctx.formatOutput(agents, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^list\s+agents?\s+active$/i,
    description: 'List active agents only',
    examples: ['list agents active'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const agents = await ctx.client.agents.listAgents({ active: 'true' });
        ctx.formatOutput(agents, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^list\s+agents?\s+name\s+(.+)$/i,
    description: 'List agents by name',
    examples: ['list agents name defaultAgent'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const name = args[3];
        const agents = await ctx.client.agents.listAgents({ name });
        ctx.formatOutput(agents, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^(?:get|show)\s+agent\s+(.+)$/i,
    description: 'Get agent details by ID',
    examples: ['get agent agent_abc123', 'show agent agent_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const agent = await ctx.client.agents.getAgent({ id });
        ctx.formatOutput(agent, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^resolve\s+agent\s+(.+)$/i,
    description: 'Resolve active agent by name',
    examples: ['resolve agent defaultAgent'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const name = args[2];
        const agent = await ctx.client.agents.resolveAgent({ name });
        ctx.formatOutput(agent, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^activate\s+agent\s+(.+)$/i,
    description: 'Activate an agent (deactivates others with same name)',
    examples: ['activate agent agent_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const result = await ctx.client.agents.activateAgent({ id, requestBody: {} });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^delete\s+agent\s+(.+)$/i,
    description: 'Delete an agent by ID (cannot delete active agents)',
    examples: ['delete agent agent_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const result = await ctx.client.agents.deleteAgent({ id });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },
];
