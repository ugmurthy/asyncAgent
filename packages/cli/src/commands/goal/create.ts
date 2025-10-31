import { Command } from 'commander';
import inquirer from 'inquirer';
import { getConfig } from '../../lib/config.js';
import { createClient, type CreateGoalRequest } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';

interface CreateOptions {
  objective?: string;
  schedule?: string;
  json?: boolean;
}

export async function createGoalCommand(options: CreateOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  let objective = options.objective;
  let schedule = options.schedule;

  if (!objective || schedule === undefined) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'objective',
        message: 'Goal objective (what should the agent accomplish?):',
        when: !objective,
        validate: (input: string) => 
          input.trim().length >= 10 || 'Objective must be at least 10 characters',
      },
      {
        type: 'input',
        name: 'schedule',
        message: 'Cron schedule (e.g., "0 9 * * *" for daily at 9am, or leave empty for manual trigger):',
        when: schedule === undefined,
        default: '',
      },
    ]);

    objective = objective || answers.objective;
    schedule = schedule !== undefined ? schedule : answers.schedule;
  }

  const params: CreateGoalRequest = {
    objective: objective!,
  };

  if (schedule && schedule.trim()) {
    params.schedule = {
      cronExpr: schedule.trim(),
      timezone: 'UTC',
    };
  }

  try {
    const goal = await withSpinner(
      'Creating goal...',
      async () => client.createGoal(params),
      { successText: 'Goal created successfully' }
    );

    if (options.json || config.defaultFormat === 'json') {
      display.printJson(goal);
    } else {
      display.spacer();
      display.keyValue('ID', goal.id);
      display.keyValue('Objective', goal.objective);
      display.keyValue('Status', display.statusBadge(goal.status));
      display.keyValue('Created', display.formatDate(goal.createdAt));
      display.spacer();
    }
  } catch (err: any) {
    display.error(err.message || 'Failed to create goal');
    process.exit(1);
  }
}

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create a new goal')
    .option('-o, --objective <text>', 'Goal objective (what the agent should accomplish)')
    .option('-s, --schedule <cron>', 'Cron schedule expression (e.g., "0 9 * * *")')
    .option('--json', 'Output as JSON')
    .action(createGoalCommand);
}
