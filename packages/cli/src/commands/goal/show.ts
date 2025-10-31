import { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';
import { formatTable } from '../../lib/table.js';

interface ShowOptions {
  json?: boolean;
  runs?: boolean;
}

export async function showGoalCommand(id: string, options: ShowOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  try {
    const goal = await withSpinner(
      'Loading goal...',
      async () => client.getGoal(id)
    );

    if (options.json || config.defaultFormat === 'json') {
      display.printJson(goal);
    } else {
      display.title(`Goal: ${goal.id}`);
      display.keyValue('Objective', goal.objective);
      display.keyValue('Status', display.statusBadge(goal.status));
      display.keyValue('Created', display.formatDate(goal.createdAt));
      display.keyValue('Updated', display.formatDate(goal.updatedAt));
      
      if (goal.webhookUrl) {
        display.keyValue('Webhook URL', goal.webhookUrl);
      }

      if (options.runs) {
        try {
          const runs = await client.listRuns(id);
          
          if (runs.length > 0) {
            display.section('\nRecent Runs:');
            const table = formatTable({
              columns: [
                { key: 'id', label: 'Run ID', width: 10 },
                { key: 'status', label: 'Status', width: 12 },
                { key: 'started', label: 'Started', width: 20 },
                { key: 'duration', label: 'Duration', width: 15 },
              ],
              data: runs.slice(0, 5).map(r => ({
                id: r.id,
                status: r.status,
                started: display.formatRelativeTime(r.startedAt),
                duration: r.completedAt 
                  ? display.formatDuration(r.startedAt, r.completedAt)
                  : 'running',
              })),
            });
            console.log(table);
          } else {
            display.info('No runs found for this goal');
          }
        } catch (err) {
          display.warning('Could not load runs');
        }
      }

      display.spacer();
    }
  } catch (err: any) {
    display.error(err.message || 'Failed to load goal');
    process.exit(1);
  }
}

export function registerShowCommand(program: Command): void {
  program
    .command('show <id>')
    .description('Show goal details')
    .option('--json', 'Output as JSON')
    .option('--runs', 'Include recent runs')
    .action(showGoalCommand);
}
