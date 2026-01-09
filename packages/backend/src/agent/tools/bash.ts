import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { exec } from 'child_process';
import { resolve } from 'path';

const bashInputSchema = z.object({
  command: z.string().describe('The bash command to execute'),
  cwd: z.string().optional().describe('Working directory (defaults to artifacts dir)'),
  timeoutMs: z.number().default(30000).describe('Command timeout in milliseconds'),
});

type BashInput = z.infer<typeof bashInputSchema>;

interface BashOutput {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const DANGEROUS_PATTERNS = [
  'rm -rf /',
  'sudo',
  'chmod 777',
  'mkfs',
  'dd if=',
  ':(){ :|:& };:',
  '> /dev/sda',
];

const DANGEROUS_START_PATTERNS = [
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
];

export class BashTool extends BaseTool<BashInput, BashOutput> {
  name = 'bash';
  description = 'Execute a bash command with safety safeguards';
  inputSchema = bashInputSchema;

  private readonly ARTIFACTS_DIR = resolve('./artifacts');

  private validateCommand(command: string): void {
    const normalizedCommand = command.toLowerCase().trim();

    for (const pattern of DANGEROUS_PATTERNS) {
      if (normalizedCommand.includes(pattern.toLowerCase())) {
        throw new Error(`Disallowed command pattern detected: ${pattern}`);
      }
    }

    for (const pattern of DANGEROUS_START_PATTERNS) {
      if (normalizedCommand.startsWith(pattern)) {
        throw new Error(`Disallowed command: commands starting with '${pattern}' are not allowed`);
      }
    }

    const chainedCommands = command.split(/&&|;/).map(cmd => cmd.trim().toLowerCase());
    for (const chainedCmd of chainedCommands) {
      for (const pattern of DANGEROUS_PATTERNS) {
        if (chainedCmd.includes(pattern.toLowerCase())) {
          throw new Error(`Disallowed chained command pattern detected: ${pattern}`);
        }
      }
      for (const pattern of DANGEROUS_START_PATTERNS) {
        if (chainedCmd.startsWith(pattern)) {
          throw new Error(`Disallowed chained command: '${pattern}' is not allowed`);
        }
      }
    }
  }

  async execute(input: BashInput, ctx: ToolContext): Promise<BashOutput> {
    this.validateCommand(input.command);

    const workingDir = input.cwd ? resolve(input.cwd) : this.ARTIFACTS_DIR;
    const timeoutMs = input.timeoutMs ?? 30000;

    ctx.logger.info({ command: input.command, cwd: workingDir, timeoutMs }, 'Executing bash command');

    return new Promise((resolvePromise) => {
      let timedOut = false;

      const child = exec(
        input.command,
        {
          cwd: workingDir,
          timeout: timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          shell: '/bin/bash',
        },
        (error, stdout, stderr) => {
          if (error && (error as NodeJS.ErrnoException).killed) {
            timedOut = true;
          }

          const exitCode = error ? (error as any).code ?? 1 : 0;

          ctx.logger.info(
            { exitCode, timedOut, stdoutLength: stdout.length, stderrLength: stderr.length },
            'Bash command completed'
          );

          if (timedOut) {
            ctx.emitEvent?.completed(`⏱️ Command timed out after ${timeoutMs}ms`);
          } else if (exitCode === 0) {
            ctx.emitEvent?.completed(`✅ Command executed successfully`);
          } else {
            ctx.emitEvent?.completed(`❌ Command failed with exit code ${exitCode}`);
          }

          resolvePromise({
            command: input.command,
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode,
            timedOut,
          });
        }
      );

      child.on('error', (err) => {
        ctx.logger.error({ err }, 'Bash command error');
        resolvePromise({
          command: input.command,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          timedOut: false,
        });
      });
    });
  }
}
