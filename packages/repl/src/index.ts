#!/usr/bin/env node

import { createInterface } from 'readline/promises';
import { AsyncAgentClient } from '@async-agent/api-js-client';
import { commands, type CommandContext } from './commands.js';
import { formatAsMarkdown, formatAsHorizontal } from './formatter.js';
import chalk from 'chalk';

const DEFAULT_BASE_URL = 'http://localhost:3000';

function formatOutput(data: any, useMarkdown: boolean = false, useHorizontal: boolean = false): void {
  if (useHorizontal) {
    console.log(formatAsHorizontal(data));
    return;
  }

  if (useMarkdown) {
    console.log(formatAsMarkdown(data));
    return;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log(chalk.yellow('  No results found.'));
      return;
    }
    console.log(chalk.green(`\n  Found ${data.length} result(s):\n`));
    data.forEach((item, index) => {
      console.log(chalk.cyan(`  [${index + 1}]`), JSON.stringify(item, null, 2).split('\n').join('\n  '));
    });
  } else {
    console.log(chalk.green('\n  ✓ Success:\n'));
    console.log('  ', JSON.stringify(data, null, 2).split('\n').join('\n  '));
  }
  console.log('');
}

function formatError(error: any): void {
  console.error(chalk.red('\n  ✗ Error:'));
  if (error.body) {
    console.error('  ', JSON.stringify(error.body, null, 2).split('\n').join('\n  '));
  } else if (error.message) {
    console.error('  ', error.message);
  } else {
    console.error('  ', error);
  }
  console.log('');
}

async function parseAndExecute(
  input: string,
  ctx: CommandContext
): Promise<boolean> {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return true;
  }

  if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
    return false;
  }

  let useMarkdown = false;
  let useHorizontal = false;
  let cleanedInput = trimmed;
  
  if (trimmed.includes('--markdown')) {
    useMarkdown = true;
    cleanedInput = cleanedInput.replace(/--markdown/g, '').trim();
  }

  if (trimmed.includes('--horizontal')) {
    useHorizontal = true;
    cleanedInput = cleanedInput.replace(/--horizontal/g, '').trim();
  }

  const args = cleanedInput.split(/\s+/);
  
  for (const command of commands) {
    const match = cleanedInput.match(command.pattern);
    if (match) {
      await command.handler(ctx, args, useMarkdown, useHorizontal);
      return true;
    }
  }

  console.log(chalk.red(`  Unknown command: "${trimmed}"`));
  console.log(chalk.gray('  Type "help" for available commands.\n'));
  return true;
}

async function main() {
  const baseUrl = process.env.ASYNC_AGENT_API_URL || DEFAULT_BASE_URL;
  
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   Async Agent Interactive REPL       ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════╝\n'));
  console.log(chalk.gray(`  Connected to: ${baseUrl}`));
  console.log(chalk.gray(`  Type "help" for commands, "exit" to quit\n`));

  const client = new AsyncAgentClient({ BASE: baseUrl });
  
  try {
    await client.health.getHealth();
    console.log(chalk.green('  ✓ API is healthy\n'));
  } catch (error) {
    console.log(chalk.yellow('  ⚠ Warning: Could not connect to API'));
    console.log(chalk.gray(`    Make sure the backend is running at ${baseUrl}\n`));
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold.cyan('async-agent> '),
  });

  const ctx: CommandContext = {
    client,
    formatOutput,
    formatError,
  };

  rl.prompt();

  for await (const line of rl) {
    const shouldContinue = await parseAndExecute(line, ctx);
    if (!shouldContinue) {
      console.log(chalk.gray('\n  Goodbye! 👋\n'));
      rl.close();
      break;
    }
    rl.prompt();
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
