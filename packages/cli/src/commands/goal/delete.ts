import { Command } from 'commander';
import inquirer from 'inquirer';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';

interface DeleteOptions {
  force?: boolean;
}

export async function deleteGoalCommand(id: string, options: DeleteOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  if (!options.force) {
    const goal = await client.getGoal(id);
    
    display.warning(`You are about to delete goal: ${goal.objective}`);
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete this goal?',
        default: false,
      },
    ]);

    if (!confirm) {
      display.info('Deletion cancelled');
      return;
    }
  }

  try {
    await withSpinner(
      'Deleting goal...',
      async () => client.deleteGoal(id),
      { successText: `Goal ${id} deleted successfully` }
    );
  } catch (err: any) {
    display.error(err.message || 'Failed to delete goal');
    process.exit(1);
  }
}

export function registerDeleteCommand(program: Command): void {
  program
    .command('delete <id>')
    .alias('rm')
    .description('Delete a goal')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(deleteGoalCommand);
}
