import * as display from './display.js';
import type { ApiError } from './api-client.js';

export function handleError(err: any, debug = false): never {
  if (isApiError(err)) {
    display.error(err.message);
    
    if (err.statusCode === 404) {
      display.info('The requested resource was not found');
    } else if (err.statusCode === 400) {
      display.info('Invalid request. Please check your input.');
    } else if (err.statusCode === 0) {
      display.info('Cannot connect to server. Is it running?');
    }

    if (debug && err.details) {
      display.spacer();
      display.section('Error details:');
      display.printJson(err.details);
    }
  } else if (err instanceof Error) {
    display.error(err.message);
    
    if (debug) {
      display.spacer();
      console.error(err.stack);
    }
  } else {
    display.error('An unexpected error occurred');
    
    if (debug) {
      display.spacer();
      console.error(err);
    }
  }

  process.exit(1);
}

function isApiError(err: any): err is ApiError {
  return err && typeof err.message === 'string' && typeof err.statusCode === 'number';
}

export function validateRequired(value: any, name: string): void {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    throw new Error(`${name} is required`);
  }
}

export function validateUrl(value: string, name = 'URL'): void {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

export function validateCron(value: string): void {
  const parts = value.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    throw new Error('Cron expression must have 5 parts (minute hour day month weekday)');
  }
}
