import type { LLMProvider, ChatMessage } from './types';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
}

export class GoogleProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gemini-1.5-pro', baseUrl = 'https://generativelanguage.googleapis.com/v1beta') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private convertMessages(messages: ChatMessage[]): { contents: GeminiContent[]; systemInstruction?: GeminiContent } {
    let systemInstruction: GeminiContent | undefined;
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { role: 'user', parts: [{ text: msg.content }] };
      } else if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        const parts: GeminiPart[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
              }
            });
          }
        }
        contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool') {
        let responseData: Record<string, unknown> = {};
        try { responseData = JSON.parse(msg.content); }
        catch { responseData = { result: msg.content }; }
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.name || '',
              response: responseData
            }
          }]
        });
      }
    }

    return { contents, systemInstruction };
  }

  private convertTools(tools?: Record<string, unknown>[]) {
    if (!tools || tools.length === 0) return undefined;
    const functionDeclarations = tools.map(t => {
      const fn = t.function as Record<string, unknown>;
      return {
        name: fn.name as string,
        description: fn.description as string,
        parameters: fn.parameters
      };
    });
    return [{ functionDeclarations }];
  }

  async sendMessage(messages: ChatMessage[], tools?: Record<string, unknown>[]): Promise<string> {
    if (!this.apiKey) throw new Error('Google API Key is missing');
    const { contents, systemInstruction } = this.convertMessages(messages);
    const body: Record<string, unknown> = { contents };
    if (systemInstruction) body.systemInstruction = { parts: systemInstruction.parts };
    const convertedTools = this.convertTools(tools);
    if (convertedTools) body.tools = convertedTools;

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300000)
      });
    } catch {
      throw new Error(`Failed to fetch (network error) — cannot reach ${url}. Check the base URL and network connectivity.`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const err = await response.json().catch(() => ({}));
        detail = err.error?.message || JSON.stringify(err);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${url})`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  }

  async streamMessage(
    messages: ChatMessage[],
    onUpdate: (chunk: string) => void,
    tools?: Record<string, unknown>[],
    onToolCall?: (toolCalls: { id: string; name: string; arguments: string }[]) => void
  ): Promise<void> {
    if (!this.apiKey) throw new Error('Google API Key is missing');
    const { contents, systemInstruction } = this.convertMessages(messages);
    const body: Record<string, unknown> = { contents };
    if (systemInstruction) body.systemInstruction = { parts: systemInstruction.parts };
    const convertedTools = this.convertTools(tools);
    if (convertedTools) body.tools = convertedTools;

    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300000)
      });
    } catch {
      throw new Error(`Failed to fetch (network error) — cannot reach ${url}. Check the base URL and network connectivity.`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const err = await response.json().catch(() => ({}));
        detail = err.error?.message || JSON.stringify(err);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${url})`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    if (!reader) throw new Error('Response body is null');

    let buffer = '';
    let isDone = false;
    const functionCalls: { name: string; arguments: string }[] = [];

    while (!isDone) {
      const { value, done } = await reader.read();
      if (done) { isDone = true; break; }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(trimmed.slice(6)) as GeminiResponse;
            const parts = parsed.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.text) onUpdate(part.text);
              if (part.functionCall) {
                functionCalls.push({
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args)
                });
              }
            }
          } catch {
            // ignore parse errors from incomplete chunks
          }
        }
      }
    }

    if (functionCalls.length > 0 && onToolCall) {
      onToolCall(functionCalls.map((fc, i) => ({
        id: `call_${i}`,
        name: fc.name,
        arguments: fc.arguments
      })));
    }
  }
}
