import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { env } from '../util/env.js';
import { logger } from '../util/logger.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let dbInstance: ReturnType<typeof createDatabase> | null = null;

function createDatabase() {
  const dbPath = env.DATABASE_PATH;
  
  // Ensure data directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    logger.info(`Created database directory: ${dbDir}`);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  logger.info(`Database connected: ${dbPath}`);

  return { db, sqlite };
}

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance.db;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.sqlite.close();
    dbInstance = null;
    logger.info('Database connection closed');
  }
}

export function runMigrations() {
  const { db, sqlite } = dbInstance || createDatabase();
  
  try {
    migrate(db, { migrationsFolder: './src/db/migrations' });
    logger.info('Migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

export const db = getDatabase();
export type Database = typeof db;
