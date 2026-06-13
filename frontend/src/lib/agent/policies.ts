/**
 * Agent Policies — configuration for AI agent behavior, token limits,
 * auto-approvals, and context window management.
 */
export interface AgentPreferences {
  /** Maximum tokens for the context window */
  maxContextTokens: number;
  /** Warning threshold as percentage of context window */
  contextWarningThreshold: number;
  /** Automatically compact context when above threshold */
  autoCompact: boolean;
  /** Show token usage per message */
  showTokenUsage: boolean;
  /** Show estimated cost */
  showCost: boolean;
  /** Model pricing per 1K input tokens (USD) */
  inputCostPer1K: number;
  /** Model pricing per 1K output tokens (USD) */
  outputCostPer1K: number;
  /** Enable smart context pruning */
  smartPruning: boolean;
  /** Always include system prompt in context */
  alwaysIncludeSystemPrompt: boolean;
  /** Max messages to keep before compacting */
  maxMessagesBeforeCompact: number;
  /** Use compact summaries for old messages */
  useCompactSummaries: boolean;
}

export const DEFAULT_AGENT_PREFERENCES: AgentPreferences = {
  maxContextTokens: 128000,
  contextWarningThreshold: 0.7,
  autoCompact: true,
  showTokenUsage: true,
  showCost: true,
  inputCostPer1K: 0.0025,
  outputCostPer1K: 0.01,
  smartPruning: true,
  alwaysIncludeSystemPrompt: true,
  maxMessagesBeforeCompact: 50,
  useCompactSummaries: true,
};

/**
 * Estimate token count from text.
 * Rough approximation: ~4 chars per token for English.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for a given number of tokens.
 */
export function estimateCost(inputTokens: number, outputTokens: number, prefs: AgentPreferences): number {
  const inputCost = (inputTokens / 1000) * prefs.inputCostPer1K;
  const outputCost = (outputTokens / 1000) * prefs.outputCostPer1K;
  return inputCost + outputCost;
}

/**
 * Format cost to a human-readable string.
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(4)}`;
}

/**
 * Format token count with K/M suffixes.
 */
export function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Calculate context window usage percentage.
 */
export function contextWindowUsage(usedTokens: number, maxTokens: number): number {
  return Math.min(100, Math.round((usedTokens / maxTokens) * 100));
}

/**
 * Get color for context usage indicator.
 */
export function getContextColor(usagePercent: number, threshold: number): string {
  if (usagePercent >= 95) return '#ef4444'; // red
  if (usagePercent >= threshold * 100) return '#f59e0b'; // amber
  if (usagePercent >= 50) return '#eab308'; // yellow
  return '#22c55e'; // green
}

/**
 * Model pricing reference (per 1K tokens, USD)
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'deepseek-chat': { input: 0.00027, output: 0.0011 },
  'llama3-70b-8192': { input: 0.00059, output: 0.00079 },
  'llama3-8b-8192': { input: 0.00005, output: 0.00008 },
  'mistral-large-latest': { input: 0.002, output: 0.006 },
  'mistral-small-latest': { input: 0.0005, output: 0.0015 },
  'command-r-plus': { input: 0.003, output: 0.015 },
};

export function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] || { input: 0.0025, output: 0.01 };
}