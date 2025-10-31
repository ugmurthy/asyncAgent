import { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';

export async function resumeGoalCommand(id: string): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  try {
    const goal = await withSpinner(
      'Resuming goal...',
      async () => client.resumeGoal(id),
      { successText: 'Goal resumed successfully' }
    );

    display.spacer();
    display.keyValue('ID', goal.id);
    display.keyValue('Objective', goal.objective);
    display.keyValue('Status', display.statusBadge(goal.status));
    display.spacer();
  } catch (err: any) {
    display.error(err.message || 'Failed to resume goal');
    process.exit(1);
  }
}

export function registerResumeCommand(program: Command): void {
  program
    .command('resume <id>')
    .description('Resume a paused goal')
    .action(resumeGoalCommand);
}
