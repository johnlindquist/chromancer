export interface WorkflowStepResult {
  stepNumber: number;
  command: string;
  args: any;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export interface WorkflowExecutionResult {
  success: boolean;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  steps: WorkflowStepResult[];
  totalDuration: number;
  earlyBailout?: boolean;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  yaml: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  executions?: number;
  lastExecuted?: string;
  versions?: WorkflowVersion[];
}

export interface WorkflowVersion {
  version: number;
  yaml: string;
  prompt: string;
  createdAt: string;
  reason?: string; // Why this version was created (e.g., "autofix attempt 1")
}