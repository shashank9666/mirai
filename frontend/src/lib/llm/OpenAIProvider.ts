import type { LLMProvider, ChatMessage } from './types';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = 'gpt-4o', baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : (baseUrl || 'https://api.openai.com/v1');
  }

  async sendMessage(messages: ChatMessage[], tools?: Record<string, unknown>[]): Promise<string> {
    if (!this.apiKey) throw new Error("OpenAI API Key is missing");

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages,
    };
    if (tools && tools.length > 0) body.tools = tools;

    let response: Response;
    try {
      response = await fetch('http://localhost:4000/api/llm/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${this.baseUrl}/chat/completions`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: body
        }),
        signal: AbortSignal.timeout(300000)
      });
    } catch {
      throw new Error(`Failed to fetch (network error) — cannot reach ${this.baseUrl}/chat/completions. Check the base URL and network connectivity.`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const err = await response.json();
        detail = err.error?.message || JSON.stringify(err);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${this.baseUrl})`);
    }

    const data = await response.json();
    return data.choices[0].message.content || '';
  }

  async streamMessage(
    messages: ChatMessage[], 
    onUpdate: (chunk: string) => void,
    tools?: Record<string, unknown>[],
    onToolCall?: (toolCalls: { id: string; name: string; arguments: string }[]) => void
  ): Promise<void> {
    if (!this.apiKey) throw new Error("OpenAI API Key is missing");

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages,
      stream: true
    };
    if (tools && tools.length > 0) body.tools = tools;

    let response: Response;
    try {
      response = await fetch('http://localhost:4000/api/llm/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${this.baseUrl}/chat/completions`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: body
        }),
        signal: AbortSignal.timeout(300000)
      });
    } catch {
      throw new Error(`Failed to fetch (network error) — cannot reach ${this.baseUrl}/chat/completions. Check the base URL and network connectivity.`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const err = await response.json();
        detail = err.error?.message || JSON.stringify(err);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${this.baseUrl})`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) throw new Error('Response body is null');

    let isDone = false;
    const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};

    while (!isDone) {
      const { value, done } = await reader.read();
      if (done) {
        isDone = true;
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices[0]?.delta;
            
            if (delta?.content) {
              onUpdate(delta.content);
            }
            
            if (delta?.tool_calls) {
              for (const call of delta.tool_calls) {
                const idx = call.index;
                if (!toolCallsMap[idx]) toolCallsMap[idx] = { id: '', name: '', arguments: '' };
                if (call.id) toolCallsMap[idx].id = call.id;
                
                const fnName = call.function?.name || call.name;
                if (fnName) toolCallsMap[idx].name = fnName;
                
                const fnArgs = call.function?.arguments || call.arguments;
                if (fnArgs) toolCallsMap[idx].arguments += fnArgs;
              }
            }
          } catch {
            // Ignore parse errors from incomplete chunks
          }
        }
      }
    }

    const parsedToolCalls = Object.values(toolCallsMap);
    if (parsedToolCalls.length > 0 && onToolCall) {
      onToolCall(parsedToolCalls);
    }
  }
}
