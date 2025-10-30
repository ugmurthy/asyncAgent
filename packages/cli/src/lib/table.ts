/**
 * Simple table formatter without external dependencies
 */

export interface Column {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface TableOptions {
  columns: Column[];
  data: Record<string, any>[];
}

export function formatTable(options: TableOptions): string {
  const { columns, data } = options;

  if (data.length === 0) {
    return 'No data';
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const contentWidths = data.map((row) => {
      const value = String(row[col.key] ?? '');
      return value.length;
    });
    const maxContentWidth = Math.max(...contentWidths, col.label.length);
    return col.width || Math.min(maxContentWidth + 2, 50);
  });

  // Helper to pad text
  const pad = (text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string => {
    const str = String(text);
    if (str.length >= width) {
      return str.slice(0, width);
    }

    const padding = width - str.length;
    
    switch (align) {
      case 'right':
        return ' '.repeat(padding) + str;
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
      default:
        return str + ' '.repeat(padding);
    }
  };

  // Build separator line
  const separator = '+' + widths.map(w => '-'.repeat(w)).join('+') + '+';

  // Build header
  const header = '|' + columns.map((col, i) => {
    return pad(col.label, widths[i], 'center');
  }).join('|') + '|';

  // Build rows
  const rows = data.map((row) => {
    return '|' + columns.map((col, i) => {
      const value = row[col.key] ?? '';
      return pad(String(value), widths[i], col.align);
    }).join('|') + '|';
  });

  // Combine all parts
  return [
    separator,
    header,
    separator,
    ...rows,
    separator,
  ].join('\n');
}

/**
 * Quick table formatter for simple key-value display
 */
export function formatKeyValue(data: Record<string, any>): string {
  const entries = Object.entries(data);
  
  if (entries.length === 0) {
    return 'No data';
  }

  const maxKeyLength = Math.max(...entries.map(([key]) => key.length));

  return entries
    .map(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength);
      return `${paddedKey} : ${value}`;
    })
    .join('\n');
}
