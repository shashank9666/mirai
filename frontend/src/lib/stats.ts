import { encode } from 'gpt-tokenizer';
import type { ChatMessage } from './llm';

export const CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'o1-mini': 128000,
  'o1-preview': 128000,
  'claude-3-5-sonnet-20240620': 200000,
  'claude-3-5-haiku-20241022': 200000,
  'claude-3-opus-20240229': 200000,
  'gemini-1.5-pro': 2097152,
  'gemini-1.5-flash': 1048576,
  'gemini-1.5-flash-8b': 1048576,
  'deepseek-chat': 128000,
  'deepseek-reasoner': 128000,
  'opencode-chat': 128000,
  'opencode-reasoner': 128000,
  'llama3': 8192,
  'llama3-8b-8192': 8192,
  'llama3-70b-8192': 8192,
  'mistral': 8192,
  'codellama': 16384,
  'mixtral-8x7b-32768': 32768,
  'mistral-large-latest': 128000,
  'mistral-medium-latest': 32000,
  'meta-llama/Llama-3-8b-chat-hf': 8192,
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': 128000,
  'meta-llama/Meta-Llama-3-8B-Instruct': 8192,
  'meta-llama/Meta-Llama-3-70B-Instruct': 8192,
  'meta-llama/llama-3-8b-instruct': 8192,
  'meta-llama/llama-3-70b-instruct': 8192,
  'llama-3-sonar-large-32k-chat': 32768,
  'llama-3-sonar-small-32k-chat': 32768,
};

const DEFAULT_CONTEXT = 128000;

export function getContextWindow(model: string): number {
  return CONTEXT_WINDOWS[model] || DEFAULT_CONTEXT;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

export function countMessagesTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.content) {
      total += countTokens(msg.content);
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += countTokens(tc.function.name + tc.function.arguments);
      }
    }
  }
  return total;
}

export function formatTokenCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return count.toString();
}
