import type { LLMProvider, ChatMessage } from './types';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private mapMessages(messages: ChatMessage[]) {
    // Anthropic API uses a top-level system prompt instead of including it in messages
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const filteredMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content
    }));
    return { system: systemMessage, messages: filteredMessages };
  }

  async sendMessage(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) throw new Error("Anthropic API Key is missing");

    const { system, messages: formattedMessages } = this.mapMessages(messages);
    const url = 'https://api.anthropic.com/v1/messages';

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true' // Allow client-side use
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          system,
          messages: formattedMessages,
        })
      });
    } catch (fetchErr) {
      throw new Error(`Failed to fetch (network error) — cannot reach ${url}. Check the base URL and network connectivity.`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const err = await response.json();
        detail = err.error?.message || JSON.stringify(err);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${url})`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async streamMessage(messages: ChatMessage[], onUpdate: (chunk: string) => void): Promise<void> {
    if (!this.apiKey) throw new Error("Anthropic API Key is missing");

    const { system, messages: formattedMessages } = this.mapMessages(messages);
    const url = 'https://api.anthropic.com/v1/messages';

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          system,
          messages: formattedMessages,
          stream: true
        })
      });
    } catch (fetchErr) {
      throw new Error(`Failed to fetch (network error) — cannot reach ${url}. Check the base URL and network connectivity.`);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const err = await response.json();
        detail = err.error?.message || JSON.stringify(err);
      } catch {
        detail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`${detail} (${url})`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) throw new Error('Response body is null');

    let isDone = false;
    while (!isDone) {
      const { value, done } = await reader.read();
      if (done) {
        isDone = true;
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              onUpdate(parsed.delta.text);
            }
          } catch {
            // Ignore parse errors from incomplete chunks
          }
        }
      }
    }
  }
}
