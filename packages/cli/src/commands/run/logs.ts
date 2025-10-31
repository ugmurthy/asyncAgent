import { Command } from 'commander';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';
import chalk from 'chalk';
import type { RunStep } from '@async-agent/shared/types/run.js';

interface LogsOptions {
  json?: boolean;
  follow?: boolean;
}

function formatStepContent(step: RunStep): void {
  const timestamp = chalk.dim(display.formatDate(step.createdAt));
  const stepNum = chalk.dim(`[${step.stepNumber}]`);
  
  let typeColor = chalk.white;
  let icon = '•';
  
  switch (step.type) {
    case 'thinking':
      typeColor = chalk.cyan;
      icon = '💭';
      break;
    case 'tool':
      typeColor = chalk.yellow;
      icon = '🔧';
      break;
    case 'result':
      typeColor = chalk.green;
      icon = '✓';
      break;
    case 'error':
      typeColor = chalk.red;
      icon = '✗';
      break;
  }

  const header = `${stepNum} ${icon} ${typeColor(step.type.toUpperCase())} ${timestamp}`;
  console.log(header);

  if (step.content) {
    const lines = step.content.split('\n');
    for (const line of lines) {
      console.log(chalk.dim('  │ ') + line);
    }
  }

  console.log();
}

export async function logsCommand(id: string, options: LogsOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl, { debug: config.debugMode });

  try {
    const steps = await withSpinner(
      'Loading logs...',
      async () => client.getRunSteps(id)
    );

    if (steps.length === 0) {
      display.info('No logs found for this run');
      return;
    }

    if (options.json || config.defaultFormat === 'json') {
      display.printJson(steps);
    } else {
      display.title(`Run Logs: ${id}`);
      
      for (const step of steps) {
        formatStepContent(step);
      }

      display.separator();
      display.info(`Total steps: ${steps.length}`);
      display.spacer();
    }

    if (options.follow) {
      display.warning('Follow mode (--follow) is not yet implemented');
    }
  } catch (err: any) {
    display.error(err.message || 'Failed to load logs');
    process.exit(1);
  }
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs <id>')
    .description('View run logs and steps')
    .option('--json', 'Output as JSON')
    .option('-f, --follow', 'Follow logs in real-time (not yet implemented)')
    .action(logsCommand);
}
