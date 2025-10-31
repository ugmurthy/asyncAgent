import { Command } from 'commander';
import inquirer from 'inquirer';
import { getConfig } from '../../lib/config.js';
import { createClient } from '../../lib/api-client.js';
import * as display from '../../lib/display.js';
import { withSpinner } from '../../lib/spinner.js';

interface InitOptions {
  apiUrl?: string;
  force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const configManager = getConfig();

  if (configManager.exists() && !options.force) {
    display.warning('Configuration file already exists at: ' + configManager.getPath());
    
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Do you want to overwrite it?',
        default: false,
      },
    ]);

    if (!overwrite) {
      display.info('Initialization cancelled');
      return;
    }
  }

  let apiUrl = options.apiUrl;

  if (!apiUrl) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiUrl',
        message: 'Backend API URL:',
        default: 'http://localhost:3000',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      },
    ]);
    apiUrl = answers.apiUrl;
  }

  const client = createClient(apiUrl);

  try {
    await withSpinner(
      'Testing connection to backend...',
      async () => {
        const health = await client.ready();
        return health;
      },
      {
        successText: 'Connected to backend successfully',
        errorText: 'Failed to connect to backend',
      }
    );
  } catch (err: any) {
    display.error(err.message || 'Could not connect to backend');
    display.info('You can still save the configuration and fix the connection later');
    
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Save configuration anyway?',
        default: true,
      },
    ]);

    if (!proceed) {
      display.info('Initialization cancelled');
      return;
    }
  }

  const config = configManager.save({
    apiUrl,
    defaultFormat: 'table',
    debugMode: false,
  });

  display.spacer();
  display.success('Configuration saved to: ' + configManager.getPath());
  display.spacer();
  
  display.section('Current configuration:');
  display.keyValue('API URL', config.apiUrl);
  display.keyValue('Default Format', config.defaultFormat);
  display.keyValue('Debug Mode', config.debugMode ? 'enabled' : 'disabled');
  
  display.spacer();
  display.section('Next steps:');
  display.log('  • List goals:        async-agent goal list');
  display.log('  • Create a goal:     async-agent goal create');
  display.log('  • View runs:         async-agent run list');
  display.spacer();
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize async-agent configuration')
    .option('--api-url <url>', 'Backend API URL')
    .option('--force', 'Overwrite existing configuration without prompting')
    .action(initCommand);
}
