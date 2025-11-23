
export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'waiting';
}

export function generateBlueprintMermaid(subTasks: SubTask[]): string {
  let graph = 'graph TD;\n';
  
  // Styling definitions
  graph += '  classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px;\n';
  graph += '  classDef start fill:#e1f5fe,stroke:#01579b,stroke-width:2px;\n';
  
  // Nodes
  subTasks.forEach(task => {
    const label = escapeLabel(task.description);
    // Use a shorter ID if possible or just the task ID
    // Blueprint doesn't have status, so use default style
    graph += `  ${task.id}["${task.id}: ${label}"]\n`;
  });

  // Edges
  subTasks.forEach(task => {
    task.dependencies.forEach(depId => {
      if (depId && depId !== 'none') {
        graph += `  ${depId} --> ${task.id}\n`;
      }
    });
  });

  return graph;
}

export function generateExecutionMermaid(subSteps: any[]): string {
  let graph = 'graph TD;\n';
  
  // Styling definitions
  graph += '  classDef pending fill:#f0f0f0,stroke:#ccc,stroke-width:1px,color:#999;\n';
  graph += '  classDef waiting fill:#fff3e0,stroke:#ff9800,stroke-width:1px,stroke-dasharray: 5 5;\n';
  graph += '  classDef running fill:#e3f2fd,stroke:#2196f3,stroke-width:2px,animation:pulse 2s infinite;\n';
  graph += '  classDef completed fill:#e8f5e9,stroke:#4caf50,stroke-width:2px;\n';
  graph += '  classDef failed fill:#ffebee,stroke:#f44336,stroke-width:2px;\n';
  
  // Nodes
  subSteps.forEach((step: any) => {
    const label = escapeLabel(step.description);
    const status = step.status || 'pending';
    
    // Add duration if completed
    let durationText = '';
    if (step.durationMs) {
      durationText = ` (${(step.durationMs / 1000).toFixed(1)}s)`;
    }

    graph += `  ${step.taskId}["${step.taskId}: ${durationText} ${label}"]\n`;
    graph += `  class ${step.taskId} ${status}\n`;
    
    // Optional: Click event handling requires special setup in mermaid, 
    // but we can just make them distinct visual elements first.
  });

  // Edges
  subSteps.forEach((step: any) => {
    if (step.dependencies && Array.isArray(step.dependencies)) {
      step.dependencies.forEach((depId: string) => {
        if (depId && depId !== 'none') {
           // Check if dependency exists in our node list to avoid graph errors
           if (subSteps.find((s: any) => s.taskId === depId)) {
             graph += `  ${depId} --> ${step.taskId}\n`;
           }
        }
      });
    }
  });

  return graph;
}

function escapeLabel(text: string): string {
  if (!text) return '';
  // Truncate if too long
  const MAX_LENGTH = 40;
  let label = text.length > MAX_LENGTH ? text.substring(0, MAX_LENGTH) + '...' : text;
  // Escape quotes and brackets
  return label.replace(/"/g, "'").replace(/\[/g, '(').replace(/\]/g, ')');
}
