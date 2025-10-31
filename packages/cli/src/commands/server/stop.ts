import { Command } from 'commander';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as display from '../../lib/display.js';

const PID_FILE = join(homedir(), '.async-agent-server.pid');

export async function stopServerCommand(): Promise<void> {
  if (!existsSync(PID_FILE)) {
    display.error('No server PID file found. Server may not be running.');
    return;
  }

  const pidStr = readFileSync(PID_FILE, 'utf-8').trim();
  const pid = parseInt(pidStr, 10);

  if (isNaN(pid)) {
    display.error('Invalid PID in file');
    unlinkSync(PID_FILE);
    return;
  }

  try {
    process.kill(pid, 0);
  } catch (err) {
    display.warning(`Process ${pid} not found. Cleaning up PID file.`);
    unlinkSync(PID_FILE);
    return;
  }

  display.info(`Stopping server (PID: ${pid})...`);

  try {
    process.kill(pid, 'SIGTERM');

    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        process.kill(pid, 0);
        attempts++;
      } catch {
        display.success('Server stopped successfully');
        unlinkSync(PID_FILE);
        return;
      }
    }

    display.warning('Server did not stop gracefully, sending SIGKILL...');
    process.kill(pid, 'SIGKILL');
    unlinkSync(PID_FILE);
    display.success('Server forcefully stopped');
  } catch (err: any) {
    display.error(`Failed to stop server: ${err.message}`);
    process.exit(1);
  }
}

export function registerStopServerCommand(program: Command): void {
  program
    .command('stop')
    .description('Stop the backend server')
    .action(stopServerCommand);
}
