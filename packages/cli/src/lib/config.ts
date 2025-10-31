import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { z } from 'zod';

const ConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  apiUrl: z.string().url().default('http://localhost:3000'),
  apiKey: z.string().optional(),
  defaultFormat: z.enum(['json', 'table', 'compact']).default('table'),
  debugMode: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

const CONFIG_FILENAME = '.async-agent.json';
const CONFIG_DIR = homedir();

export class ConfigManager {
  private configPath: string;
  private config: Config | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || join(CONFIG_DIR, CONFIG_FILENAME);
  }

  exists(): boolean {
    return existsSync(this.configPath);
  }

  load(): Config {
    if (this.config) {
      return this.config;
    }

    if (!this.exists()) {
      this.config = this.getDefaults();
      return this.config;
    }

    try {
      const raw = readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.config = ConfigSchema.parse(parsed);
      return this.config;
    } catch (err: any) {
      throw new Error(`Failed to load config from ${this.configPath}: ${err.message}`);
    }
  }

  save(config: Partial<Config>): Config {
    const current = this.exists() ? this.load() : this.getDefaults();
    const updated = { ...current, ...config };
    
    const validated = ConfigSchema.parse(updated);

    try {
      writeFileSync(this.configPath, JSON.stringify(validated, null, 2), 'utf-8');
      this.config = validated;
      return validated;
    } catch (err: any) {
      throw new Error(`Failed to save config to ${this.configPath}: ${err.message}`);
    }
  }

  get(key: keyof Config): any {
    const config = this.load();
    return config[key];
  }

  set(key: keyof Config, value: any): void {
    const config = this.load();
    const updated = { ...config, [key]: value };
    this.save(updated);
  }

  getDefaults(): Config {
    return ConfigSchema.parse({});
  }

  getPath(): string {
    return this.configPath;
  }

  delete(): void {
    if (this.exists()) {
      const fs = require('fs');
      fs.unlinkSync(this.configPath);
      this.config = null;
    }
  }
}

let defaultManager: ConfigManager | null = null;

export function getConfig(): ConfigManager {
  if (!defaultManager) {
    defaultManager = new ConfigManager();
  }
  return defaultManager;
}

export function setConfigPath(path: string): void {
  defaultManager = new ConfigManager(path);
}
