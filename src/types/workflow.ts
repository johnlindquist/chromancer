export interface WorkflowStepResult {
  stepNumber: number;
  command: string;
  args: any;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  checkpoint?: WorkflowCheckpoint;
}

export interface WorkflowCheckpoint {
  id: string;
  name?: string;
  pageState: {
    url: string;
    title: string;
    timestamp: string;
  };
  stepNumber: number;
}

export interface WorkflowExecutionResult {
  success: boolean;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  steps: WorkflowStepResult[];
  totalDuration: number;
  earlyBailout?: boolean;
  checkpoints?: WorkflowCheckpoint[];
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
  branches?: WorkflowBranch[];
}

export interface WorkflowVersion {
  version: number;
  yaml: string;
  prompt: string;
  createdAt: string;
  reason?: string; // Why this version was created (e.g., "autofix attempt 1")
}

export interface WorkflowBranch {
  id: string;
  name: string;
  fromCheckpoint: string; // checkpoint ID
  prompt: string; // What the user wanted to do from this checkpoint
  yaml: string; // Additional steps from the checkpoint
  createdAt: string;
}