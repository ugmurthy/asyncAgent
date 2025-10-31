import chalk from 'chalk';
import { format, formatDistance, formatDistanceToNow } from 'date-fns';

export function success(message: string): void {
  console.log(chalk.green('✓ ') + message);
}

export function error(message: string): void {
  console.error(chalk.red('✗ ') + message);
}

export function warning(message: string): void {
  console.log(chalk.yellow('⚠ ') + message);
}

export function info(message: string): void {
  console.log(chalk.blue('ℹ ') + message);
}

export function log(message: string): void {
  console.log(message);
}

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function printJson(data: any): void {
  console.log(formatJson(data));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm:ss');
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDuration(startDate: Date | string, endDate?: Date | string): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  
  if (!endDate) {
    return formatDistanceToNow(start);
  }

  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return formatDistance(start, end);
}

export function statusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return chalk.green('●') + ' ' + status;
    case 'running':
    case 'in_progress':
      return chalk.blue('●') + ' ' + status;
    case 'failed':
    case 'error':
      return chalk.red('●') + ' ' + status;
    case 'paused':
      return chalk.yellow('●') + ' ' + status;
    case 'pending':
      return chalk.gray('●') + ' ' + status;
    default:
      return chalk.white('●') + ' ' + status;
  }
}

export function enabledBadge(enabled: boolean): string {
  return enabled ? chalk.green('enabled') : chalk.gray('disabled');
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

export function title(text: string): void {
  console.log('\n' + chalk.bold.underline(text) + '\n');
}

export function section(text: string): void {
  console.log('\n' + chalk.bold(text));
}

export function keyValue(key: string, value: any, options: { color?: boolean } = {}): void {
  const formattedKey = chalk.dim(key.padEnd(20, ' '));
  const formattedValue = options.color ? value : String(value);
  console.log(`${formattedKey} ${formattedValue}`);
}

export interface ProgressOptions {
  total: number;
  current: number;
  width?: number;
}

export function progressBar(options: ProgressOptions): string {
  const { total, current, width = 40 } = options;
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const percentText = `${percentage.toFixed(0)}%`;

  return `${bar} ${percentText}`;
}

export function separator(length = 80): void {
  console.log(chalk.dim('─'.repeat(length)));
}

export function spacer(): void {
  console.log();
}
