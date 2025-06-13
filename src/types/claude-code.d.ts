declare module '@anthropic-ai/claude-code' {
  export interface TextContent {
    type: 'text';
    text: string;
  }

  export interface Message {
    content: Array<TextContent | { type: string }>;
  }

  export interface ClaudeEvent {
    type: string;
    message?: Message;
  }

  export interface QueryOptions {
    prompt: string;
    options?: {
      abortController?: AbortController;
      allowedTools?: string[];
      appendSystemPrompt?: string;
      customSystemPrompt?: string;
      cwd?: string;
      disallowedTools?: string[];
      executable?: string;
      executableArgs?: string[];
      maxTurns?: number;
      mcpServers?: Record<string, any>;
      pathToClaudeCodeExecutable?: string;
      permissionMode?: 'default' | string;
      permissionPromptToolName?: string;
      continue?: boolean;
      resume?: string;
      userSpecifiedModel?: string;
    };
  }

  export function query(params: QueryOptions): AsyncIterable<ClaudeEvent>;

  export class AbortError extends Error {}
}