import { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { formatTable } from '../../lib/table.js';
import { withSpinner } from '../../lib/spinner.js';

interface ListRunsOptions {
  json?: boolean;
  goalId?: string;
  status?: string;
}

export async function listRunsCommand(options: ListRunsOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  try {
    let runs = await withSpinner(
      'Loading runs...',
      async () => client.listRuns(options.goalId)
    );

    if (options.status) {
      runs = runs.filter(r => r.status.toLowerCase() === options.status!.toLowerCase());
    }

    if (runs.length === 0) {
      display.info('No runs found');
      return;
    }

    if (options.json || config.defaultFormat === 'json') {
      display.printJson(runs);
    } else {
      const table = formatTable({
        columns: [
          { key: 'id', label: 'Run ID', width: 10 },
          { key: 'goalId', label: 'Goal ID', width: 10 },
          { key: 'status', label: 'Status', width: 12 },
          { key: 'started', label: 'Started', width: 20 },
          { key: 'duration', label: 'Duration', width: 15 },
        ],
        data: runs.map(r => ({
          id: r.id,
          goalId: r.goalId,
          status: r.status,
          started: display.formatRelativeTime(r.startedAt),
          duration: r.completedAt 
            ? display.formatDuration(r.startedAt, r.completedAt)
            : 'running',
        })),
      });

      console.log(table);
      display.spacer();
      display.info(`Total: ${runs.length} run${runs.length !== 1 ? 's' : ''}`);
    }
  } catch (err: any) {
    display.error(err.message || 'Failed to list runs');
    process.exit(1);
  }
}

export function registerListRunsCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List all runs')
    .option('--json', 'Output as JSON')
    .option('--goal-id <id>', 'Filter by goal ID')
    .option('--status <status>', 'Filter by status')
    .action(listRunsCommand);
}
