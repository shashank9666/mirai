import React, { useState, useRef } from 'react';
import { Send, Scale, RefreshCw } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import { api } from '@/lib/api';
import { useSettingsStore, AIProvider, DEFAULT_BASE_URLS } from '@/store/useSettingsStore';
import { ChatMessage } from '@/lib/llm';

const COMMON_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  ollama: ['llama3.2', 'qwen2.5-coder:7b', 'mistral', 'codellama'],
  mistral: ['mistral-large-latest', 'open-mixtral-8x22b'],
  openrouter: ['meta-llama/llama-3-8b-instruct'],
  groq: ['llama3-8b-8192', 'llama3-70b-8192'],
  together: ['meta-llama/Llama-3-8b-chat-hf'],
  fireworks: ['accounts/fireworks/models/llama-v3-8b-instruct'],
  deepinfra: ['meta-llama/Meta-Llama-3-8B-Instruct'],
  novita: ['meta-llama/llama-3-8b-instruct'],
  cerebras: ['llama3-8b-8192'],
  perplexity: ['llama-3-sonar-large-32k-chat'],
  opencode: ['opencode-chat'],
  deepseek: ['deepseek-chat'],
};

export default function CompareView() {
  const { providerConfigs } = useSettingsStore();

  const [providerA, setProviderA] = useState<AIProvider>('openai');
  const [modelA, setModelA] = useState<string>('gpt-4o');

  const [providerB, setProviderB] = useState<AIProvider>('anthropic');
  const [modelB, setModelB] = useState<string>('claude-3-5-sonnet-20241022');

  const [messagesA, setMessagesA] = useState<ChatMessage[]>([]);
  const [messagesB, setMessagesB] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const endRefA = useRef<HTMLDivElement>(null);
  const endRefB = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endRefA.current?.scrollIntoView({ behavior: "smooth" });
    endRefB.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessagesA(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setMessagesB(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setInput('');
    setIsLoading(true);

    const configA = providerConfigs[providerA];
    const baseUrlA = configA?.baseUrl || DEFAULT_BASE_URLS[providerA];

    const configB = providerConfigs[providerB];
    const baseUrlB = configB?.baseUrl || DEFAULT_BASE_URLS[providerB];

    const runStream = async (
      provider: string,
      model: string,
      apiKey: string,
      baseUrl: string,
      history: ChatMessage[],
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
    ) => {
      try {
        const stream = api.streamChat({
          messages: [...history, userMessage],
          provider,
          model,
          apiKey,
          baseUrl
        });

        let currentContent = '';
        for await (const event of stream) {
          if (event.type === 'token') {
            currentContent += event.content;
            setMessages(prev => {
              const newArr = [...prev];
              newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: currentContent };
              return newArr;
            });
            scrollToBottom();
          } else if (event.type === 'final' && event.content) {
            setMessages(prev => {
              const newArr = [...prev];
              newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: event.content };
              return newArr;
            });
          }
        }
      } catch (err) {
        console.error(err);
        setMessages(prev => {
          const newArr = [...prev];
          newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: `**Error:** ${(err as Error).message}` };
          return newArr;
        });
      }
    };

    await Promise.allSettled([
      runStream(providerA, modelA, configA?.apiKey || '', baseUrlA, messagesA, setMessagesA),
      runStream(providerB, modelB, configB?.apiKey || '', baseUrlB, messagesB, setMessagesB)
    ]);

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessagesA([]);
    setMessagesB([]);
  };

  const renderMessage = (msg: ChatMessage) => (
    <div className={`p-4 ${msg.role === 'user' ? 'bg-muted/50' : ''}`}>
      {msg.role === 'user' ? (
        <div className="font-semibold text-sm mb-2 text-foreground/70">User</div>
      ) : (
        <div className="font-semibold text-sm mb-2 text-[#a855f7]">Assistant</div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {msg.role === 'user' ? (
          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
        ) : (
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#a855f7]/10 text-[#a855f7] rounded-lg">
            <Scale size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg">Compare Models</h1>
            <p className="text-xs text-muted-foreground">Blind test or compare responses side-by-side.</p>
          </div>
        </div>
        <button onClick={clearChat} className="p-2 hover:bg-muted text-muted-foreground hover:text-red-400 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold">
          <RefreshCw size={14} /> Clear
        </button>
      </div>

      {/* Split View */}
      <div className="flex-1 overflow-hidden flex border-b border-border">
        {/* Left Side */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="p-2 bg-muted/30 border-b border-border flex items-center gap-2">
            <select
              value={providerA}
              onChange={(e) => {
                const p = e.target.value as AIProvider;
                setProviderA(p);
                setModelA(COMMON_MODELS[p]?.[0] || '');
              }}
              className="bg-transparent text-sm font-semibold p-1 outline-none w-32"
            >
              {Object.keys(COMMON_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="bg-transparent text-sm font-semibold p-1 outline-none text-muted-foreground w-48"
            >
              {COMMON_MODELS[providerA]?.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {messagesA.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm opacity-50">Waiting for prompt...</div>
            ) : (
              messagesA.map((msg, i) => <React.Fragment key={i}>{renderMessage(msg)}</React.Fragment>)
            )}
            <div ref={endRefA} />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex-1 flex flex-col">
          <div className="p-2 bg-muted/30 border-b border-border flex items-center gap-2">
            <select
              value={providerB}
              onChange={(e) => {
                const p = e.target.value as AIProvider;
                setProviderB(p);
                setModelB(COMMON_MODELS[p]?.[0] || '');
              }}
              className="bg-transparent text-sm font-semibold p-1 outline-none w-32"
            >
              {Object.keys(COMMON_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="bg-transparent text-sm font-semibold p-1 outline-none text-muted-foreground w-48"
            >
              {COMMON_MODELS[providerB]?.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {messagesB.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm opacity-50">Waiting for prompt...</div>
            ) : (
              messagesB.map((msg, i) => <React.Fragment key={i}>{renderMessage(msg)}</React.Fragment>)
            )}
            <div ref={endRefB} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-background">
        <div className="max-w-4xl mx-auto relative border border-border focus-within:border-[#a855f7]/50 focus-within:shadow-[0_0_15px_rgba(168,85,247,0.1)] rounded-2xl overflow-hidden transition-all bg-card">
          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to compare both models..."
            className="w-full bg-transparent resize-none p-4 pr-14 text-sm outline-none max-h-48 custom-scrollbar"
            minRows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 rounded-xl bg-[#a855f7] hover:bg-[#a855f7]/90 text-white disabled:opacity-50 transition-all shadow-md"
          >
            {isLoading ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
