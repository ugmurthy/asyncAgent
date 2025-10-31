import { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';

export async function pauseGoalCommand(id: string): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  try {
    const goal = await withSpinner(
      'Pausing goal...',
      async () => client.pauseGoal(id),
      { successText: 'Goal paused successfully' }
    );

    display.spacer();
    display.keyValue('ID', goal.id);
    display.keyValue('Objective', goal.objective);
    display.keyValue('Status', display.statusBadge(goal.status));
    display.spacer();
  } catch (err: any) {
    display.error(err.message || 'Failed to pause goal');
    process.exit(1);
  }
}

export function registerPauseCommand(program: Command): void {
  program
    .command('pause <id>')
    .description('Pause a goal')
    .action(pauseGoalCommand);
}
