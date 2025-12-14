import { z } from 'zod';
import { BaseTool } from './base.js';
import type { ToolContext } from '@async-agent/shared';
import { readFile as fsReadFile } from 'fs/promises';
import { join, resolve } from 'path';

const explainCodeInputSchema = z.object({
  filePath: z.string().describe('File path relative to project root or absolute path'),
  maxLength: z.number().int().min(1).max(100000).default(50000).describe('Maximum bytes to read'),
});

type ExplainCodeInput = z.infer<typeof explainCodeInputSchema>;

interface ExplainCodeOutput {
  filePath: string;
  pseudoCode: string;
  lineCount: number;
  originalSize: number;
  truncated: boolean;
}

export class ExplainCodeTool extends BaseTool<ExplainCodeInput, ExplainCodeOutput> {
  name = 'explainCode';
  description = 'Analyze a code file and generate pseudo code with line number prefixes explaining what the code does';
  inputSchema = explainCodeInputSchema;

  private readonly PROJECT_ROOT = resolve('./');

  async execute(input: ExplainCodeInput, ctx: ToolContext): Promise<ExplainCodeOutput> {
    const filePath = input.filePath;
    
    // Security: prevent path traversal
    const safePath = filePath.replace(/\.\./g, '');
    const fullPath = filePath.startsWith('/') ? safePath : join(this.PROJECT_ROOT, safePath);

    // Ensure path is within project root (if relative path provided)
    if (!filePath.startsWith('/') && !fullPath.startsWith(this.PROJECT_ROOT)) {
      throw new Error('Invalid path: must be within project directory');
    }

    ctx.logger.info(`Analyzing code file: ${filePath}`);

    try {
      const content = await fsReadFile(fullPath, 'utf-8');
      const size = Buffer.byteLength(content, 'utf-8');
      
      const truncated = size > input.maxLength;
      const finalContent = truncated ? content.slice(0, input.maxLength) : content;

      // Generate pseudo code with line numbers
      const lines = finalContent.split('\n');
      const pseudoCode = this.generatePseudoCode(lines);

      ctx.logger.info(`Analyzed ${lines.length} lines from ${filePath}${truncated ? ' (truncated)' : ''}`);

      return {
        filePath,
        pseudoCode,
        lineCount: lines.length,
        originalSize: size,
        truncated,
      };
    } catch (error) {
      ctx.logger.error({ err: error }, 'Code analysis failed');
      throw error;
    }
  }

  /**
   * Generate pseudo code from source code lines with line number prefixes
   * Analyzes code structure, logic flow, and key operations
   */
  private generatePseudoCode(lines: string[]): string {
    const pseudoLines: string[] = [];
    let inMultilineComment = false;
    let inFunction = false;
    let functionIndent = 0;
    let blockStack: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and pure comment lines
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed === '') {
        continue;
      }

      // Track multi-line comments
      if (trimmed.includes('/*')) {
        inMultilineComment = true;
      }
      if (inMultilineComment) {
        if (trimmed.includes('*/')) {
          inMultilineComment = false;
        }
        continue;
      }

      // Detect function/method definitions
      if (this.isFunctionStart(trimmed)) {
        const funcName = this.extractFunctionName(trimmed);
        pseudoLines.push(`(line ${lineNum}) ${this.getIndent(line)}Function: ${funcName}`);
        inFunction = true;
        functionIndent = this.getLineIndent(line);
        blockStack.push('function');
        continue;
      }

      // Detect class/interface definitions
      if (this.isClassStart(trimmed)) {
        const className = this.extractClassName(trimmed);
        pseudoLines.push(`(line ${lineNum}) ${this.getIndent(line)}Class/Interface: ${className}`);
        blockStack.push('class');
        continue;
      }

      // Detect control flow
      if (this.isControlFlow(trimmed)) {
        const description = this.describeControlFlow(trimmed);
        pseudoLines.push(`(line ${lineNum}) ${this.getIndent(line)}├─ ${description}`);
        continue;
      }

      // Detect assignments and operations
      if (this.isAssignment(trimmed)) {
        const description = this.describeAssignment(trimmed);
        pseudoLines.push(`(line ${lineNum}) ${this.getIndent(line)}├─ ${description}`);
        continue;
      }

      // Detect function calls
      if (this.isFunctionCall(trimmed)) {
        const funcName = this.extractFunctionCall(trimmed);
        pseudoLines.push(`(line ${lineNum}) ${this.getIndent(line)}├─ Call: ${funcName}`);
        continue;
      }

      // Detect return statements
      if (this.isReturn(trimmed)) {
        const returnValue = this.extractReturn(trimmed);
        pseudoLines.push(`(line ${lineNum}) ${this.getIndent(line)}└─ Return: ${returnValue}`);
        continue;
      }

      // Detect try/catch blocks
      if (this.isTryCatch(trimmed)) {
        pseudoLines.push(`(line ${lineNum}) ${this.getIndent(line)}├─ Try-Catch Block`);
        blockStack.push('try-catch');
        continue;
      }
    }

    return pseudoLines.join('\n') || '(No analyzable code found)';
  }

  private isFunctionStart(line: string): boolean {
    return /^(async\s+)?(function|const|let|var)\s+\w+\s*=?\s*(async\s*)?\(|^\s*(async\s+)?(export\s+)?(function|const|let|var)/.test(
      line
    );
  }

  private isClassStart(line: string): boolean {
    return /^(export\s+)?(class|interface|type)\s+\w+/.test(line);
  }

  private isControlFlow(line: string): boolean {
    return /^(if|else|switch|case|for|while|do|break|continue)\b/.test(line);
  }

  private isAssignment(line: string): boolean {
    return /\s*\w+\s*[+\-*/%&|^]?=|let|const|var/.test(line) && !this.isFunctionStart(line);
  }

  private isFunctionCall(line: string): boolean {
    return /\w+\([^)]*\)/.test(line) && !this.isControlFlow(line) && !this.isAssignment(line);
  }

  private isReturn(line: string): boolean {
    return /^return\s+/.test(line);
  }

  private isTryCatch(line: string): boolean {
    return /^try\s*{|^catch\s*\(|^finally\s*{/.test(line);
  }

  private extractFunctionName(line: string): string {
    const match = line.match(/(?:function|const|let|var)\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\(/);
    return match ? match[1] || match[2] : 'Anonymous';
  }

  private extractClassName(line: string): string {
    const match = line.match(/(?:class|interface|type)\s+(\w+)/);
    return match ? match[1] : 'Unknown';
  }

  private describeControlFlow(line: string): string {
    if (line.startsWith('if')) return `Conditional: ${line.slice(0, 50)}...`;
    if (line.startsWith('for')) return `Loop: ${line.slice(0, 50)}...`;
    if (line.startsWith('while')) return `While Loop: ${line.slice(0, 50)}...`;
    if (line.startsWith('switch')) return `Switch Statement`;
    if (line.startsWith('case')) return `Case: ${line.slice(0, 50)}...`;
    return `Control Flow: ${line.slice(0, 50)}...`;
  }

  private describeAssignment(line: string): string {
    const match = line.match(/^(const|let|var)?\s*(\w+)\s*[=]/);
    const varName = match ? match[2] : 'variable';
    return `Assign: ${varName} = ${line.slice(line.indexOf('=') + 1).trim().slice(0, 40)}`;
  }

  private extractFunctionCall(line: string): string {
    const match = line.match(/(\w+)\s*\(/);
    return match ? match[1] : 'function';
  }

  private extractReturn(line: string): string {
    return line.slice(line.indexOf('return') + 6).trim().slice(0, 50);
  }

  private getIndent(line: string): string {
    const match = line.match(/^(\s*)/);
    const spaces = match ? match[1].length : 0;
    return spaces > 0 ? `${spaces > 4 ? '  ' : ''}` : '';
  }

  private getLineIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}
