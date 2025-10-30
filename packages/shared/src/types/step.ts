export interface Step {
  id: string;
  runId: string;
  stepNo: number;
  thought: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  observation?: string;
  durationMs: number;
  error?: string;
  createdAt: Date;
}
