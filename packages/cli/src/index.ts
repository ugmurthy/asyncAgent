import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { registerInitCommand } from './commands/config/init.js';
import { registerCreateCommand } from './commands/goal/create.js';
import { registerListCommand } from './commands/goal/list.js';
import { registerShowCommand } from './commands/goal/show.js';
import { registerDeleteCommand } from './commands/goal/delete.js';
import { registerPauseCommand } from './commands/goal/pause.js';
import { registerResumeCommand } from './commands/goal/resume.js';
import { registerListRunsCommand } from './commands/run/list.js';
import { registerShowRunCommand } from './commands/run/show.js';
import { registerLogsCommand } from './commands/run/logs.js';
import { registerStartServerCommand } from './commands/server/start.js';
import { registerStopServerCommand } from './commands/server/stop.js';
import { registerStatusServerCommand } from './commands/server/status.js';

import * as display from './lib/display.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packagePath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const program = new Command();

program
  .name('async-agent')
  .description('Autonomous async agent system with multi-provider LLM support')
  .version(packageJson.version)
  .option('--debug', 'Enable debug mode')
  .option('--config <path>', 'Path to config file');

registerInitCommand(program);

const goalCommand = program
  .command('goal')
  .description('Manage goals');

registerCreateCommand(goalCommand);
registerListCommand(goalCommand);
registerShowCommand(goalCommand);
registerDeleteCommand(goalCommand);
registerPauseCommand(goalCommand);
registerResumeCommand(goalCommand);

const runCommand = program
  .command('run')
  .description('Manage runs and view execution logs');

registerListRunsCommand(runCommand);
registerShowRunCommand(runCommand);
registerLogsCommand(runCommand);

const serverCommand = program
  .command('server')
  .description('Manage backend server');

registerStartServerCommand(serverCommand);
registerStopServerCommand(serverCommand);
registerStatusServerCommand(serverCommand);

program.on('command:*', () => {
  display.error(`Invalid command: ${program.args.join(' ')}`);
  display.info('Run --help for available commands');
  process.exit(1);
});

program.parseAsync(process.argv).catch((err) => {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    display.error('Module not found. Make sure dependencies are installed.');
  } else {
    display.error(err.message || 'An unexpected error occurred');
    
    if (process.argv.includes('--debug')) {
      console.error(err);
    }
  }
  
  process.exit(1);
});
