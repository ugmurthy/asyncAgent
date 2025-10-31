export interface GlobalOptions {
  debug?: boolean;
  config?: string;
  json?: boolean;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export type OutputFormat = 'json' | 'table' | 'compact';

export interface FormattedOutput {
  format: OutputFormat;
  data: any;
}
