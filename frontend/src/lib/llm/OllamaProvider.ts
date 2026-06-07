import { LLMProvider, ChatMessage } from './types';

export class OllamaProvider implements LLMProvider {
  private host: string;
  private model: string;

  constructor(host: string = 'http://127.0.0.1:11434', model: string = 'llama3') {
    this.host = host.endsWith('/') ? host.slice(0, -1) : host;
    this.model = model;
  }

  async sendMessage(
    messages: ChatMessage[],
    tools?: Record<string, unknown>[]
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false
    };
    if (tools && tools.length > 0) body.tools = tools;

    const url = `${this.host}/api/chat`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (fetchErr) {
      throw new Error(`Failed to fetch (network error) — cannot reach ${url}. Is Ollama running on ${this.host}?`);
    }
    
    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson.error || JSON.stringify(errJson);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${url})`);
    }
    
    const data = await response.json();

    if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
      return JSON.stringify(data.message.tool_calls);
    }

    return data.message?.content || '';
  }

  async streamMessage(
    messages: ChatMessage[],
    onUpdate: (chunk: string) => void,
    tools?: Record<string, unknown>[],
    onToolCall?: (toolCalls: { id: string; name: string; arguments: string }[]) => void
  ): Promise<void> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true
    };
    if (tools && tools.length > 0) body.tools = tools;

    const url = `${this.host}/api/chat`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (fetchErr) {
      throw new Error(`Failed to fetch (network error) — cannot reach ${url}. Is Ollama running on ${this.host}?`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson.error || JSON.stringify(errJson);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${url})`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json: unknown = JSON.parse(line);
          const data = json as { message?: { content?: string, tool_calls?: { function?: { name?: string, arguments?: string | Record<string, unknown> } }[] }, done?: boolean };
          if (data.message?.content) {
            onUpdate(data.message.content);
            fullContent += data.message.content;
          }
          // Ollama sends tool_calls in the final message chunk (done: true)
          if (data.done && data.message?.tool_calls && data.message.tool_calls.length > 0) {
            const parsedToolCalls = data.message.tool_calls.map((tc: unknown, idx: number) => {
              const toolCall = tc as { function?: { name?: string, arguments?: string | Record<string, unknown> } };
              return {
                id: toolCall.function?.name || `tool_${idx}`,
                name: toolCall.function?.name || '',
                arguments: typeof toolCall.function?.arguments === 'string'
                  ? toolCall.function.arguments
                  : JSON.stringify(toolCall.function?.arguments || {})
              };
            });
            if (onToolCall) {
              onToolCall(parsedToolCalls);
            }
          }
        } catch (e) {
          console.error("Failed to parse Ollama chunk", e);
        }
      }
    }
  }
}
