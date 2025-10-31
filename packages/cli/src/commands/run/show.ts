import { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';
import chalk from 'chalk';

interface ShowRunOptions {
  json?: boolean;
  steps?: boolean;
}

export async function showRunCommand(id: string, options: ShowRunOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  try {
    const run = await withSpinner(
      'Loading run...',
      async () => client.getRun(id)
    );

    if (options.json || config.defaultFormat === 'json') {
      display.printJson(run);
    } else {
      display.title(`Run: ${run.id}`);
      display.keyValue('Goal ID', run.goalId);
      display.keyValue('Status', display.statusBadge(run.status));
      display.keyValue('Started', display.formatDate(run.startedAt));
      
      if (run.completedAt) {
        display.keyValue('Completed', display.formatDate(run.completedAt));
        display.keyValue('Duration', display.formatDuration(run.startedAt, run.completedAt));
      } else {
        display.keyValue('Duration', display.formatDuration(run.startedAt) + ' (running)');
      }

      if (run.error) {
        display.spacer();
        display.section('Error:');
        console.log(chalk.red(run.error));
      }

      if (options.steps) {
        const steps = await withSpinner(
          'Loading steps...',
          async () => client.getRunSteps(id)
        );

        if (steps.length > 0) {
          display.section('\nSteps:');
          display.spacer();

          for (const step of steps) {
            const stepNum = chalk.dim(`[${step.stepNumber}]`);
            const stepType = chalk.cyan(step.type.padEnd(10));
            console.log(`${stepNum} ${stepType} ${display.formatDate(step.createdAt)}`);
            
            if (step.content) {
              const preview = display.truncate(step.content.trim(), 100);
              console.log(chalk.dim('  ' + preview));
            }
            
            display.spacer();
          }

          display.info(`Total steps: ${steps.length}`);
        } else {
          display.info('No steps found for this run');
        }
      }

      display.spacer();
    }
  } catch (err: any) {
    display.error(err.message || 'Failed to load run');
    process.exit(1);
  }
}

export function registerShowRunCommand(program: Command): void {
  program
    .command('show <id>')
    .description('Show run details')
    .option('--json', 'Output as JSON')
    .option('--steps', 'Include run steps')
    .action(showRunCommand);
}
