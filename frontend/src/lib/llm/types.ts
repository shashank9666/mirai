export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // For tool role
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string; };
  }[];
  tool_call_id?: string; // For tool role
  durationMs?: number; // Timing information
}

export interface StreamResponse {
  text: string;
  isDone: boolean;
}

export interface LLMProvider {
  sendMessage(messages: ChatMessage[], tools?: Record<string, unknown>[]): Promise<string>;
  streamMessage(
    messages: ChatMessage[],
    onUpdate: (chunk: string) => void,
    tools?: Record<string, unknown>[],
    onToolCall?: (toolCalls: ToolCall[]) => void
  ): Promise<void>;
}
