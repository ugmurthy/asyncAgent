import type { AsyncAgentClient } from '@async-agent/api-js-client';
import type { CreateGoalRequest, GoalStatusQuery, RunStatusQuery } from '@async-agent/api-js-client';

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
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
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
    pattern: /^(?:get|show)\s+run\s+(.+)$/i,
    description: 'Get run details by ID',
    examples: ['get run run_abc123', 'show run run_abc123'],
    handler: async (ctx, args, useMarkdown, useHorizontal) => {
      try {
        const id = args[2];
        const run = await ctx.client.runs.getRun({ id });
        ctx.formatOutput(run, useMarkdown, useHorizontal);
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
];
