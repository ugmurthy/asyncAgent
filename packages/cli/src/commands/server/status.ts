import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';

const PID_FILE = join(homedir(), '.async-agent-server.pid');

interface StatusOptions {
  json?: boolean;
}

export async function statusServerCommand(options: StatusOptions): Promise<void> {
  const config = getConfig().load();
  const client = createClient(config.apiUrl);

  let pidInfo: { exists: boolean; pid?: number; running?: boolean } = { exists: false };

  if (existsSync(PID_FILE)) {
    const pidStr = readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);
    
    pidInfo.exists = true;
    pidInfo.pid = pid;

    try {
      process.kill(pid, 0);
      pidInfo.running = true;
    } catch {
      pidInfo.running = false;
    }
  }

  let healthInfo: any = null;

  try {
    healthInfo = await withSpinner(
      'Checking server health...',
      async () => client.ready()
    );
  } catch (err: any) {
    // Server not reachable
  }

  if (options.json || config.defaultFormat === 'json') {
    display.printJson({
      pidFile: pidInfo,
      health: healthInfo,
    });
  } else {
    display.title('Server Status');

    if (pidInfo.exists && pidInfo.running) {
      display.keyValue('Process', display.statusBadge('running') + ` (PID: ${pidInfo.pid})`);
    } else if (pidInfo.exists && !pidInfo.running) {
      display.keyValue('Process', display.statusBadge('failed') + ' (stale PID file)');
    } else {
      display.keyValue('Process', display.statusBadge('failed') + ' (not running)');
    }

    if (healthInfo) {
      display.keyValue('API', display.statusBadge('success') + ` ${config.apiUrl}`);
      display.keyValue('Database', healthInfo.database || 'unknown');
      display.keyValue('Scheduler', healthInfo.scheduler || 'unknown');
      display.keyValue('LLM Provider', healthInfo.llmProvider || 'unknown');
      display.keyValue('Last Check', display.formatDate(healthInfo.timestamp));
    } else {
      display.keyValue('API', display.statusBadge('error') + ` ${config.apiUrl}`);
      display.warning('Cannot connect to backend API');
    }

    display.spacer();

    if (!healthInfo) {
      display.section('Troubleshooting:');
      display.log('  • Ensure the backend is running: async-agent server start');
      display.log('  • Check the API URL in config: async-agent init');
      display.log('  • Verify backend logs for errors');
      display.spacer();
    }
  }
}

export function registerStatusServerCommand(program: Command): void {
  program
    .command('status')
    .description('Check server status')
    .option('--json', 'Output as JSON')
    .action(statusServerCommand);
}
