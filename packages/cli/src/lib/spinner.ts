import ora, { Ora } from 'ora';

export class Spinner {
  private spinner: Ora | null = null;
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled && process.stdout.isTTY;
  }

  start(text: string): this {
    if (this.enabled) {
      this.spinner = ora({
        text,
        color: 'cyan',
      }).start();
    }
    return this;
  }

  update(text: string): this {
    if (this.spinner) {
      this.spinner.text = text;
    }
    return this;
  }

  succeed(text?: string): this {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
    return this;
  }

  fail(text?: string): this {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
    return this;
  }

  warn(text?: string): this {
    if (this.spinner) {
      this.spinner.warn(text);
      this.spinner = null;
    }
    return this;
  }

  info(text?: string): this {
    if (this.spinner) {
      this.spinner.info(text);
      this.spinner = null;
    }
    return this;
  }

  stop(): this {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    return this;
  }

  isSpinning(): boolean {
    return this.spinner !== null && this.spinner.isSpinning;
  }
}

export function createSpinner(text?: string): Spinner {
  const spinner = new Spinner();
  if (text) {
    spinner.start(text);
  }
  return spinner;
}

export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  options: {
    successText?: string;
    errorText?: string;
  } = {}
): Promise<T> {
  const spinner = createSpinner(text);

  try {
    const result = await fn();
    spinner.succeed(options.successText);
    return result;
  } catch (err) {
    spinner.fail(options.errorText);
    throw err;
  }
}
