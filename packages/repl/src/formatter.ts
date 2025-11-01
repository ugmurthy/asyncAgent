import Table from 'cli-table3';
import chalk from 'chalk';

export function formatAsMarkdown(data: any): string {
  if (!data) {
    return chalk.yellow('No data');
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return chalk.yellow('No results found.');
    }
    return formatArrayAsTable(data);
  }

  return formatObjectAsTable(data);
}

export function formatAsHorizontal(data: any): string {
  if (!data) {
    return chalk.yellow('No data');
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return chalk.yellow('No results found.');
    }
    return formatArrayAsHorizontalTables(data);
  }

  return formatObjectAsTable(data);
}

function formatArrayAsHorizontalTables(items: any[]): string {
  if (items.length === 0) {
    return chalk.yellow('No results found.');
  }

  let output = `\n${chalk.green(`Found ${items.length} result(s):`)}\n`;

  items.forEach((item, index) => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      output += `\n${chalk.cyan(`[${index + 1}]`)}\n`;
      output += formatObjectAsTable(item);
    } else {
      output += `\n${chalk.cyan(`[${index + 1}]`)} ${formatValue(item)}\n`;
    }
  });

  return output;
}

function formatArrayAsTable(items: any[]): string {
  if (items.length === 0) {
    return chalk.yellow('No results found.');
  }

  const allKeys = new Set<string>();
  items.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(key => allKeys.add(key));
    }
  });

  const keys = Array.from(allKeys);
  
  const table = new Table({
    head: keys.map(k => chalk.cyan(k)),
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true,
    wrapOnWordBoundary: true,
  });

  items.forEach(item => {
    const row = keys.map(key => formatValue(item[key]));
    table.push(row);
  });

  return `\n${chalk.green(`Found ${items.length} result(s):`)}\n\n${table.toString()}\n`;
}

function formatObjectAsTable(obj: any): string {
  if (typeof obj !== 'object' || obj === null) {
    return chalk.green(String(obj));
  }

  const table = new Table({
    head: [chalk.cyan('Property'), chalk.cyan('Value')],
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true,
    wrapOnWordBoundary: true,
    colWidths: [30, 80],
  });

  Object.entries(obj).forEach(([key, value]) => {
    table.push([chalk.yellow(key), formatValue(value)]);
  });

  return `\n${chalk.green('✓ Success:')}\n\n${table.toString()}\n`;
}

function formatValue(value: any): string {
  if (value === null) {
    return chalk.gray('null');
  }
  
  if (value === undefined) {
    return chalk.gray('undefined');
  }

  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.red('false');
  }

  if (typeof value === 'number') {
    return chalk.magenta(String(value));
  }

  if (typeof value === 'string') {
    if (value.length > 100) {
      return value.substring(0, 97) + '...';
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    if (value.every(v => typeof v !== 'object')) {
      return `[${value.join(', ')}]`;
    }
    return `Array[${value.length}]`;
  }

  if (typeof value === 'object') {
    const preview = JSON.stringify(value);
    if (preview.length > 80) {
      return preview.substring(0, 77) + '...';
    }
    return preview;
  }

  return String(value);
}
