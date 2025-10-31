import { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { formatTable } from '../../lib/table.js';
import { withSpinner } from '../../lib/spinner.js';

interface ListOptions {
  json?: boolean;
  enabled?: boolean;
  status?: string;
}

export async function listGoalsCommand(options: ListOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  try {
    let goals = await withSpinner(
      'Loading goals...',
      async () => client.listGoals()
    );

    if (options.status) {
      goals = goals.filter(g => g.status.toLowerCase() === options.status.toLowerCase());
    }

    if (goals.length === 0) {
      display.info('No goals found');
      return;
    }

    if (options.json || config.defaultFormat === 'json') {
      display.printJson(goals);
    } else {
      const table = formatTable({
        columns: [
          { key: 'id', label: 'ID', width: 10 },
          { key: 'objective', label: 'Objective', width: 50 },
          { key: 'status', label: 'Status', width: 12 },
        ],
        data: goals.map(g => ({
          id: g.id,
          objective: display.truncate(g.objective, 48),
          status: g.status,
        })),
      });

      console.log(table);
      display.spacer();
      display.info(`Total: ${goals.length} goal${goals.length !== 1 ? 's' : ''}`);
    }
  } catch (err: any) {
    display.error(err.message || 'Failed to list goals');
    process.exit(1);
  }
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List all goals')
    .option('--json', 'Output as JSON')
    .option('--status <status>', 'Filter by status (active, paused, archived)')
    .action(listGoalsCommand);
}
