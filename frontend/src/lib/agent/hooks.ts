export interface AgentHooks {
  onSessionStart?: () => void | Promise<void>;
  onTurnStart?: () => void | Promise<void>;
  onPreToolCall?: (toolName: string, args: string) => void | Promise<void>;
  onPostToolCall?: (toolName: string, result: string, error?: boolean) => void | Promise<void>;
  onStateUpdate?: (actionText: string) => void | Promise<void>;
}
