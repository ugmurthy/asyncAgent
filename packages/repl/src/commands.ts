import type { AsyncAgentClient } from '@async-agent/api-js-client';
import type { CreateGoalRequest, GoalStatusQuery, RunStatusQuery } from '@async-agent/api-js-client';
import _ from 'lodash';

export interface CommandContext {
  client: AsyncAgentClient;
  formatOutput: (data: any, useMarkdown?: boolean, useHorizontal?: boolean) => void;
  formatError: (error: any) => void;
}

function findAllValuesByKey(obj: any, targetKey: string): any[] {
  const results: any[] = [];

  function traverse(current: any): void {
    if (_.isPlainObject(current)) {
      _.forIn(current, (value, key) => {
        if (key === targetKey) {
          results.push(value);
        }
        if (_.isPlainObject(value) || _.isArray(value)) {
          traverse(value);
        }
      });
    } else if (_.isArray(current)) {
      _.forEach(current, traverse);
    }
  }

  traverse(obj);
  return results;
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
      console.log('    → Example: list goals --markdown');
      console.log('    → Example: list goals --horizontal\n');
    },
  },

  {
    pattern: /^create\s+goal$/i,
    description: 'Create a new goal (interactive)',
    examples: ['create goal'],
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
        const description = await rl.question('Goal description: ');
        const scheduleType = await rl.question('Schedule type (cron/interval/none) [none]: ');
        
        const goalRequest: CreateGoalRequest = {
          objective: description.trim(),
        };

        if (scheduleType.toLowerCase() === 'cron') {
          const cronExpression = await rl.question('Cron expression (e.g., "0 9 * * *"): ');
          goalRequest.schedule = {
            cronExpr: cronExpression.trim(),
          };
        }

        const result = await ctx.client.goals.createGoal({ requestBody: goalRequest });
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
    pattern: /^list\s+goals?$/i,
    description: 'List all goals',
    examples: ['list goals', 'list goal'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const goals = await ctx.client.goals.listGoals({});
        ctx.formatOutput(goals, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^list\s+goals?\s+status\s+(\w+)$/i,
    description: 'List goals by status',
    examples: ['list goals status active', 'list goals status paused'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const status = args[3] as GoalStatusQuery;
        const goals = await ctx.client.goals.listGoals({ status });
        ctx.formatOutput(goals, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^(?:get|show)\s+goal\s+(.+)$/i,
    description: 'Get goal details by ID',
    examples: ['get goal goal_abc123', 'show goal goal_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const goal = await ctx.client.goals.getGoal({ id });
        ctx.formatOutput(goal, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^delete\s+goal\s+(.+)$/i,
    description: 'Delete a goal by ID',
    examples: ['delete goal goal_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const result = await ctx.client.goals.deleteGoal({ id });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^pause\s+goal\s+(.+)$/i,
    description: 'Pause a goal',
    examples: ['pause goal goal_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const result = await ctx.client.goals.pauseGoal({ id, requestBody: {} });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^resume\s+goal\s+(.+)$/i,
    description: 'Resume a paused goal',
    examples: ['resume goal goal_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const result = await ctx.client.goals.resumeGoal({ id, requestBody: {} });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^run\s+goal\s+(.+)$/i,
    description: 'Trigger a run for a goal',
    examples: ['run goal goal_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const result = await ctx.client.goals.triggerGoalRun({ id, requestBody: {} });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^list\s+runs?$/i,
    description: 'List all runs',
    examples: ['list runs', 'list run'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const runs = await ctx.client.runs.listRuns({});
        ctx.formatOutput(runs, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^list\s+runs?\s+status\s+(\w+)$/i,
    description: 'List runs by status',
    examples: ['list runs status running', 'list runs status completed'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const status = args[3] as RunStatusQuery;
        const runs = await ctx.client.runs.listRuns({ status });
        ctx.formatOutput(runs, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^(?:get|show)\s+run\s+(\S+)(?:\s+(.+))?$/i,
    description: 'Get run details by ID (optionally filter by key)',
    examples: ['get run run_abc123', 'show run run_abc123', 'show run run_abc123 status', 'show run run_abc123 result'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const key = args[3]?.trim();
        const run = await ctx.client.runs.getRun({ id });
        
        if (key) {
          const values = findAllValuesByKey(run, key);
          const result = values.length === 0 ? null : (values.length === 1 ? values[0] : values);
          ctx.formatOutput(result, useMarkdown, useHorizontal);
        } else {
          ctx.formatOutput(run, useMarkdown, useHorizontal);
        }
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^(?:show|list)\s+steps?\s+(.+)$/i,
    description: 'Show steps for a run',
    examples: ['show steps run_abc123', 'list steps run_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const steps = await ctx.client.runs.getRunSteps({ id });
        ctx.formatOutput(steps, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
    },
  },

  {
    pattern: /^delete\s+run\s+(.+)$/i,
    description: 'Delete a run by ID',
    examples: ['delete run run_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const result = await ctx.client.runs.deleteRun({ id });
        ctx.formatOutput(result, useMarkdown, useHorizontal);
      } catch (error) {
        ctx.formatError(error);
      }
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
