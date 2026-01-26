// DEPRECATED: This file will be removed in US-006
// Stubbed out after runs/steps/goals table removal in US-004

import type { Database } from '../db/client.js';
import type { Logger } from '../util/logger.js';
import type { LLMProvider } from '@async-agent/shared';
import { ToolRegistry } from './tools/index.js';

export interface OrchestratorConfig {
  db: Database;
  logger: Logger;
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
}

export class AgentOrchestrator {
  constructor(private config: OrchestratorConfig) {}

  async executeRun(_runId: string): Promise<void> {
    throw new Error('AgentOrchestrator is deprecated and will be removed. Use DAG executor instead.');
  }
}
