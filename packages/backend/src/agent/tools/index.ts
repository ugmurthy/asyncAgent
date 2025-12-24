import type { Tool } from '@async-agent/shared';
import { WebSearchTool } from './webSearch.js';
import { FetchPageTool } from './fetchPage.js';
import { FetchURLsTool } from './fetchURLs.js';
import { WriteFileTool } from './writeFile.js';
import { ReadFileTool } from './readFile.js';
import { SendWebhookTool } from './sendWebhook.js';
import { SendEmailTool } from './sendEmail.js';
//import { ExplainCodeTool } from './explainCode.js';
//import { LlmExecuteTool } from './llmExecute.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    this.register(new WebSearchTool());
    this.register(new FetchPageTool());
    this.register(new FetchURLsTool());
    this.register(new WriteFileTool());
    this.register(new ReadFileTool());
    this.register(new SendWebhookTool());
    this.register(new SendEmailTool());
    //this.register(new ExplainCodeTool());
    //this.register(new LlmExecuteTool());
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getAllDefinitions() {
    return this.getAll().map(tool => tool.toJSONSchema());
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  filterByNames(names?: string[]): Tool[] {
    if (!names || names.length === 0) {
      return this.getAll();
    }
    return names
      .map(name => this.get(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }
}

export const defaultToolRegistry = new ToolRegistry();

export * from './base.js';
export * from './webSearch.js';
export * from './fetchPage.js';
export * from './fetchURLs.js';
export * from './writeFile.js';
export * from './readFile.js';
export * from './sendWebhook.js';
export * from './sendEmail.js';
//export * from './explainCode.js';
//export * from './llmExecute.js';
