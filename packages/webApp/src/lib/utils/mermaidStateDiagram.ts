
export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'waiting';
}

export function generateBlueprintMermaid(subTasks: SubTask[]): string {
  let diagram = 'stateDiagram-v2\n';
  diagram += '  direction LR\n';

  subTasks.forEach(task => {
    const label = escapeLabel(task.description);
    diagram += `  ${task.id} : ${task.id} - ${label}\n`;
  });

  subTasks.forEach(task => {
    task.dependencies.forEach(depId => {
      if (depId && depId !== 'none') {
        diagram += `  ${depId} --> ${task.id}\n`;
      }
    });
  });

  return diagram;
}

export function generateExecutionMermaid(subSteps: any[]): string {
  let diagram = 'stateDiagram-v2\n';
  diagram += '  direction LR\n';

  diagram += '  classDef pending fill:#f0f0f0,stroke:#ccc,color:#999\n';
  diagram += '  classDef waiting fill:#fff3e0,stroke:#ff9800\n';
  diagram += '  classDef running fill:#e3f2fd,stroke:#2196f3\n';
  diagram += '  classDef completed fill:#e8f5e9,stroke:#4caf50\n';
  diagram += '  classDef failed fill:#ffebee,stroke:#f44336\n';

  subSteps.forEach((step: any) => {
    const label = escapeLabel(step.description);
    const status = step.status || 'pending';

    let durationText = '';
    if (step.durationMs) {
      durationText = ` (${(step.durationMs / 1000).toFixed(1)}s)`;
    }

    diagram += `  ${step.taskId} : ${step.taskId}${durationText} - ${label}\n`;
    diagram += `  class ${step.taskId} ${status}\n`;
  });

  subSteps.forEach((step: any) => {
    if (step.dependencies && Array.isArray(step.dependencies)) {
      step.dependencies.forEach((depId: string) => {
        if (depId && depId !== 'none') {
          if (subSteps.find((s: any) => s.taskId === depId)) {
            diagram += `  ${depId} --> ${step.taskId}\n`;
          }
        }
      });
    }
  });

  return diagram;
}

function escapeLabel(text: string): string {
  if (!text) return '';
  const MAX_LENGTH = 40;
  let label = text.length > MAX_LENGTH ? text.substring(0, MAX_LENGTH) + '...' : text;
  return label.replace(/"/g, "'").replace(/\[/g, '(').replace(/\]/g, ')').replace(/:/g, '-');
}
