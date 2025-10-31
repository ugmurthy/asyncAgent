import { Command } from 'commander';
import { spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';

const PID_FILE = join(homedir(), '.async-agent-server.pid');

interface StartOptions {
  foreground?: boolean;
  port?: string;
}

export async function startServerCommand(options: StartOptions): Promise<void> {
  if (existsSync(PID_FILE)) {
    display.warning('Server PID file exists. Checking if server is already running...');
    
    try {
      const config = getConfig().load();
      const client = createClient(config.apiUrl);
      await client.health();
      display.error('Server is already running');
      return;
    } catch {
      display.info('Stale PID file found, removing...');
      const fs = require('fs');
      fs.unlinkSync(PID_FILE);
    }
  }

  const port = options.port || process.env.PORT || '3000';
  
  display.info('Starting async-agent backend server...');

  const env = {
    ...process.env,
    PORT: port,
  };

  if (options.foreground) {
    const child = spawn('pnpm', ['--filter', 'backend', 'start'], {
      env,
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        display.error(`Server exited with code ${code}`);
        process.exit(code || 1);
      }
    });

    process.on('SIGINT', () => {
      child.kill('SIGTERM');
      process.exit(0);
    });
  } else {
    const child = spawn('pnpm', ['--filter', 'backend', 'start'], {
      env,
      stdio: 'ignore',
      detached: true,
      shell: true,
    });

    writeFileSync(PID_FILE, child.pid!.toString());
    child.unref();

    display.success(`Server started in background (PID: ${child.pid})`);
    display.info(`Logs: Check backend logs for output`);
    display.info(`Stop: async-agent server stop`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const config = getConfig().load();
      const client = createClient(config.apiUrl);
      await client.health();
      display.success('Server is healthy and accepting requests');
    } catch (err) {
      display.warning('Server may still be starting up. Check logs if issues persist.');
    }
  }
}

export function registerStartServerCommand(program: Command): void {
  program
    .command('start')
    .description('Start the backend server')
    .option('-f, --foreground', 'Run in foreground (default: background)')
    .option('-p, --port <port>', 'Port to run on (default: 3000)')
    .action(startServerCommand);
}
