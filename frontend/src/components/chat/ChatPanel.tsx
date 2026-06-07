'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Paperclip, Globe, Mic, Copy, RotateCw, Square, Plus, ChevronDown, Search, Trash2, FileEdit } from 'lucide-react';
import { useSettingsStore, DEFAULT_BASE_URLS, AIProvider, TeamPersona } from '@/store/useSettingsStore';
import { useChatStore } from '@/store/useChatStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useApprovalStore } from '@/store/useApprovalStore';
import { ChatMessage, LLMProvider, OpenAIProvider, AnthropicProvider, OllamaProvider, GoogleProvider } from '@/lib/llm';
import { Agent } from '@/lib/agent/Agent';
import { ask_user, allow, Policy } from '@/lib/agent/policies';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const COMMON_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  ollama: ['llama3', 'mistral', 'codellama'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'open-mixtral-8x22b'],
  openrouter: ['meta-llama/llama-3-8b-instruct', 'google/gemini-flash-1.5', 'anthropic/claude-3.5-sonnet'],
  groq: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
  together: ['meta-llama/Llama-3-8b-chat-hf', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'],
  fireworks: ['accounts/fireworks/models/llama-v3-8b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct'],
  deepinfra: ['meta-llama/Meta-Llama-3-8B-Instruct', 'meta-llama/Meta-Llama-3-70B-Instruct'],
  novita: ['meta-llama/llama-3-8b-instruct', 'meta-llama/llama-3-70b-instruct'],
  cerebras: ['llama3-8b-8192', 'llama3-70b-8192'],
  perplexity: ['llama-3-sonar-large-32k-chat', 'llama-3-sonar-small-32k-chat'],
  opencode: ['opencode-chat', 'opencode-reasoner'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
};

export default function ChatPanel() {
  const { sessions, activeChatId, setMessages, newChat, switchChat, deleteChat, renameChat } = useChatStore();
  const activeSession = sessions.find(s => s.id === activeChatId);
  const messages = React.useMemo(() => activeSession?.messages || [], [activeSession?.messages]);
  const { workspacePath } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { aiProvider, setAiProvider, providerConfigs, updateProviderConfig, autoApprove, checkpointsEnabled, agentMode, setAgentMode, webSearchEnabled, setWebSearchEnabled, zoom } = useSettingsStore();

  // Context Overlays State
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showCodeContextSelector, setShowCodeContextSelector] = useState(false);
  const [showTerminalContextSelector, setShowTerminalContextSelector] = useState(false);
  const [runningTasks, setRunningTasks] = useState<{ id: string; command: string; status: string; logs?: string }[]>([]);

  // Speech Recognition State
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
          let finalTranscript = '';
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
              finalTranscript += e.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onerror = (e: any) => {
          console.error('Speech recognition error:', e.error);
          setIsRecording(false);
        };

        rec.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleSpeechRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported or permission denied in this environment.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Context inclusion routines
  const handleAddDirectoryContext = async () => {
    try {
      const selectedPath = await api.openFolderPicker();
      if (selectedPath) {
        const result = await api.readDir(selectedPath);
        const folderName = selectedPath.split(/[/\\]/).pop() || selectedPath;
        let dirContext = `\n\n[Directory Context: ${folderName} (${selectedPath})]\nFiles:\n`;
        result.entries.slice(0, 20).forEach((entry) => {
          dirContext += `- ${entry.name}${entry.isDirectory ? '/' : ''}\n`;
        });
        if (result.entries.length > 20) {
          dirContext += `- ... and ${result.entries.length - 20} more items\n`;
        }
        setInput(prev => prev + dirContext);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRulesContext = async () => {
    if (!workspacePath) return alert('Please open a folder first.');
    try {
      let rulesContent = '';
      try {
        rulesContent = await api.readFile(`${workspacePath}/.mirairules`);
      } catch {
        try {
          rulesContent = await api.readFile(`${workspacePath}/.cursorrules`);
        } catch {
          alert('No .mirairules or .cursorrules file found in workspace.');
          return;
        }
      }
      setInput(prev => prev + `\n\n[Context: Project Rules]\n\`\`\`\n${rulesContent}\n\`\`\`\n`);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRunningTasks = async () => {
    try {
      const tasks = await api.listTasks();
      setRunningTasks(tasks.filter(t => t.status === 'running' || t.logs));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddConversationContext = () => {
    if (messages.length === 0) return alert('No conversation history.');
    let summary = `\n\n[Context: Conversation History]\n`;
    messages.forEach((msg) => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        summary += `**${msg.role.toUpperCase()}**: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}\n`;
      }
    });
    setInput(prev => prev + summary);
  };

  const handleAddMcpContext = () => {
    const mcpContext = `\n\n[Context: MCP Servers & StitchMCP registered tools]\nStitchMCP tools: create_project, get_project, list_projects, list_screens, get_screen, generate_screen_from_text, edit_screens, generate_variants, upload_design_md, create_design_system, create_design_system_from_design_md, update_design_system, list_design_systems, apply_design_system\n`;
    setInput(prev => prev + mcpContext);
  };

  // Initialize first chat if empty
  useEffect(() => {
    if (sessions.length === 0) {
      newChat();
    }
  }, [sessions.length, newChat]);

  const [chatSearch, setChatSearch] = useState('');
  const [showChatDropdown, setShowChatDropdown] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const chatDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chatDropdownRef.current && !chatDropdownRef.current.contains(e.target as Node)) {
        setShowChatDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(chatSearch.toLowerCase())
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getProvider = React.useCallback((): LLMProvider => {
    const config = providerConfigs[aiProvider];
    const baseUrl = config.baseUrl || DEFAULT_BASE_URLS[aiProvider];
    
    if (aiProvider === 'anthropic') {
      if (!config.apiKey) throw new Error("Please configure Anthropic API Key in settings.");
      return new AnthropicProvider(config.apiKey, config.model);
    } else if (aiProvider === 'google') {
      if (!config.apiKey) throw new Error("Please configure Google API Key in settings.");
      return new GoogleProvider(config.apiKey, config.model, baseUrl);
    } else if (aiProvider === 'ollama') {
      const host = baseUrl.replace(/\/v1\/?$/, ''); // Strip /v1 if it exists
      return new OllamaProvider(host || 'http://127.0.0.1:11434', config.model);
    } else {
      if (!config.apiKey) {
        throw new Error(`Please configure API Key for ${aiProvider} in settings.`);
      }
      return new OpenAIProvider(config.apiKey, config.model, baseUrl);
    }
  }, [aiProvider, providerConfigs]);

  const executeAgentLoop = React.useCallback(async (
    userMessage: ChatMessage,
    initialHistory: ChatMessage[]
  ): Promise<string> => {
    const config = providerConfigs[aiProvider];
    const baseUrl = config.baseUrl || DEFAULT_BASE_URLS[aiProvider];
    
    // Add the user message to history for the API payload
    const allMessages = [...initialHistory, userMessage];

    // Create a new assistant message slot
    setMessages(prev => [...prev, { role: 'assistant', content: '', tool_calls: [] }]);
    
    let currentContent = '';
    const currentToolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = [];

    try {
      const stream = api.streamChat({
        messages: allMessages,
        provider: aiProvider,
        model: config.model || '',
        apiKey: config.apiKey || '',
        baseUrl: baseUrl
      });

      for await (const event of stream) {
        if (event.type === 'token') {
          currentContent += event.content;
          setMessages(prev => {
            const newArr = [...prev];
            newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: currentContent };
            return newArr;
          });
        } else if (event.type === 'tool_start') {
          setCurrentAction(`Executing ${event.name}...`);
          const newTool = {
            id: Math.random().toString(36).substring(7),
            type: 'function' as const,
            function: { name: event.name, arguments: JSON.stringify(event.input || {}) }
          };
          currentToolCalls.push(newTool);
          setMessages(prev => {
            const newArr = [...prev];
            newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], tool_calls: [...currentToolCalls] };
            return newArr;
          });
        } else if (event.type === 'tool_end') {
          if (checkpointsEnabled && workspacePath && ['writeFile', 'replaceInFile', 'deleteItem'].includes(event.name)) {
             api.gitCheckpoint(workspacePath).catch(() => {});
          }
          setCurrentAction('');
        } else if (event.type === 'final') {
          if (event.content) {
            currentContent = event.content;
            setMessages(prev => {
              const newArr = [...prev];
              newArr[newArr.length - 1] = { ...newArr[newArr.length - 1], content: currentContent };
              return newArr;
            });
          }
        } else if (event.type === 'error') {
          throw new Error(event.error);
        } else if (event.type === 'done') {
          break;
        }
      }
    } catch (err) {
      throw err;
    }

    return currentContent;
  }, [aiProvider, providerConfigs, checkpointsEnabled, workspacePath, setMessages]);

  const resumeAgentLoop = React.useCallback(async (
    savedState: { messages: ChatMessage[]; stepCount: number; agentMode: 'plan' | 'auto' | 'review'; persona: string }
  ) => {
    setIsLoading(true);
    let customRules = '';
    if (workspacePath) {
      try {
        customRules = await api.readFile(`${workspacePath}/.mirairules`);
      } catch {}
    }

    const provider = getProvider();

    const policies: Policy[] = [
      allow('readFile'),
      allow('readDir'),
      allow('webFetch'),
      allow('webSearch'),
      allow('searchFiles'),
      allow('askQuestion'),
      allow('schedule'),
      allow('attemptCompletion'),
      allow('askFollowupQuestion'),
      savedState.agentMode === 'review' || !autoApprove ? ask_user('*') : allow('*')
    ];

    const agent = new Agent({
      provider,
      workspacePath,
      agentMode: savedState.agentMode,
      persona: savedState.persona as TeamPersona,
      autoApprove: autoApprove || savedState.agentMode === 'auto',
      customRules,
      policies,
      sessionId: activeChatId,
      hooks: {
        onTurnStart: () => setCurrentAction('Agent is thinking...'),
        onStateUpdate: (text) => setCurrentAction(text),
        onPreToolCall: (name) => setCurrentAction(`Executing ${name}...`),
        onPostToolCall: (name) => {
          if (checkpointsEnabled && workspacePath && ['writeFile', 'replaceInFile', 'deleteItem'].includes(name)) {
            api.gitCheckpoint(workspacePath).catch(() => {});
          }
        }
      }
    });

    try {
      await agent.resume(savedState, (msg, index) => {
        setMessages(prev => {
          const newArr = [...prev];
          while (newArr.length <= index) {
            newArr.push({ role: 'assistant', content: '' });
          }
          newArr[index] = msg;
          return newArr;
        });
      });
    } catch (err) {
      const error = err as Error;
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `**Resume Error:** ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
      setCurrentAction('');
    }
  }, [workspacePath, getProvider, autoApprove, activeChatId, checkpointsEnabled, setMessages]);

  // Load session from backend and auto-resume if needed
  useEffect(() => {
    if (!activeChatId) return;

    let active = true;

    const checkAndResume = async () => {
      try {
        const savedState = await api.loadSessionState(activeChatId);
        if (savedState && savedState.messages && savedState.messages.length > 0) {
          const localMsgs = savedState.messages.filter((m: ChatMessage) => m.role !== 'system');
          setMessages(localMsgs);

          const lastMsg = savedState.messages[savedState.messages.length - 1];
          let needsAutoResume = lastMsg && lastMsg.role === 'user';

          if (!needsAutoResume) {
            for (let i = savedState.messages.length - 1; i >= 0; i--) {
              const msg = savedState.messages[i];
              if (msg.role === 'assistant') {
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                  const completedIds = new Set<string>();
                  for (let j = i + 1; j < savedState.messages.length; j++) {
                    const followUpMsg = savedState.messages[j];
                    if (followUpMsg.role === 'tool' && followUpMsg.tool_call_id) {
                      completedIds.add(followUpMsg.tool_call_id);
                    }
                  }
                  if (msg.tool_calls.some((tc) => !completedIds.has(tc.id))) {
                    needsAutoResume = true;
                  }
                }
                break;
              }
            }
          }

          if (needsAutoResume && active) {
            try {
              const pending = await api.getPendingApproval();
              if (pending && pending.status === 'pending') {
                useApprovalStore.getState().setPending({
                  call: {
                    id: pending.id,
                    name: pending.toolName,
                    arguments: typeof pending.arguments === 'string' ? pending.arguments : JSON.stringify(pending.arguments)
                  },
                  oldContent: pending.oldContent,
                  newContent: pending.newContent,
                  resolve: async (approved: boolean) => {
                    try {
                      await api.replyApproval(pending.id, approved);
                    } catch (err) {
                      console.error('Failed to reply approval:', err);
                    }
                    useApprovalStore.getState().setPending(null);
                  }
                });
              }
            } catch (e) {
              console.error('Failed to restore approval state:', e);
            }

            await resumeAgentLoop(savedState);
          }
        }
      } catch (err) {
        console.error('Failed to sync session state:', err);
      }
    };

    checkAndResume();

    return () => {
      active = false;
    };
  }, [activeChatId, resumeAgentLoop, setMessages]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;

    if (textToSend.trim().toLowerCase() === '/clear') {
      setMessages([]);
      if (!overrideInput) setInput('');
      return;
    }

    useHistoryStore.getState().startNewSession(textToSend.substring(0, 50) + (textToSend.length > 50 ? '...' : ''));

    let userMessage: ChatMessage = { role: 'user', content: textToSend };
    const initialHistory = [...messages];
    
    setMessages(prev => [...prev, userMessage]);
    if (!overrideInput) setInput('');
    setIsLoading(true);

    try {
      if (webSearchEnabled) {
        setCurrentAction('Searching the web...');
        try {
          const searchResults = await api.webSearch(textToSend);
          if (searchResults && searchResults.length > 0) {
            const searchContext = `[Web Search Results for "${textToSend}"]\n` + 
              searchResults.map((r, i) => `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`).join('\n\n') + '\n\n';
            userMessage = { 
              role: 'user', 
              content: `${searchContext}[User Query]\n${textToSend}` 
            };
          }
        } catch (err) {
          console.error("Web search failed:", err);
        }
      }
      await executeAgentLoop(userMessage, initialHistory);
    } catch (err) {
      const error = err as Error;
      const providerLabel = aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1);
      const modelName = providerConfigs[aiProvider]?.model || 'unknown';
      const details = error.message === 'Failed to fetch'
        ? `Could not reach the ${providerLabel} API at \`${providerConfigs[aiProvider]?.baseUrl || DEFAULT_BASE_URLS[aiProvider] || 'unknown'}\`. Check your network connection, API key, and that the base URL is correct.`
        : error.message;
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: `**${providerLabel} Error (${modelName}):** ${details}` }
      ]);
    } finally {
      setIsLoading(false);
      setCurrentAction('');
    }
  };

  const handleRegenerate = async (msgIndex: number) => {
    if (isLoading) return;
    
    let userMsgIdx = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsgIdx = i;
        break;
      }
    }
    
    if (userMsgIdx === -1) return;
    
    const userMsg = messages[userMsgIdx];
    const newHistory = messages.slice(0, userMsgIdx);
    
    let cleanQuery = userMsg.content;
    if (cleanQuery.includes('[User Query]\n')) {
      cleanQuery = cleanQuery.substring(cleanQuery.indexOf('[User Query]\n') + '[User Query]\n'.length);
    }
    
    setIsLoading(true);
    setMessages([...newHistory, { role: 'user', content: cleanQuery }]);
    
    try {
      let activeUserMessage = { role: 'user', content: cleanQuery } as ChatMessage;
      if (webSearchEnabled) {
        setCurrentAction('Searching the web...');
        try {
          const searchResults = await api.webSearch(cleanQuery);
          if (searchResults && searchResults.length > 0) {
            const searchContext = `[Web Search Results for "${cleanQuery}"]\n` + 
              searchResults.map((r, idx) => `${idx + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`).join('\n\n') + '\n\n';
            activeUserMessage = { 
              role: 'user', 
              content: `${searchContext}[User Query]\n${cleanQuery}` 
            };
          }
        } catch (err) {
          console.error("Web search failed:", err);
        }
      }
      
      setMessages([...newHistory, activeUserMessage]);
      await executeAgentLoop(activeUserMessage, newHistory);
    } catch (err) {
      const error = err as Error;
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: `**Error:** ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
      setCurrentAction('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);

  const isBinaryExtension = (filePath: string): boolean => {
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
    return IMAGE_EXTENSIONS.has(ext) || ['.pdf', '.zip', '.rar', '.gz', '.exe', '.dll', '.bin', '.wasm', '.mp3', '.mp4', '.avi', '.mov', '.ttf', '.otf', '.woff', '.woff2'].includes(ext);
  };

  const attachFiles = async (filePaths: string[]) => {
    let attachmentText = '';
    for (const filePath of filePaths) {
      const fileName = filePath.split('\\').pop()?.split('/').pop() || filePath;
      if (isBinaryExtension(filePath)) {
        attachmentText += `\n\n[Attached: ${fileName}]`;
      } else {
        try {
          const content = await api.readFile(filePath);
          attachmentText += `\n\n\`\`\`${fileName}\n${content}\n\`\`\`\n`;
        } catch {
          attachmentText += `\n\n[Attached: ${fileName}]`;
        }
      }
    }
    if (attachmentText) {
      setInput(prev => prev + attachmentText);
    }
  };

  const handleAttach = async () => {
    try {
      const filePaths = await api.openFilesPicker();
      if (filePaths.length > 0) {
        await attachFiles(filePaths);
      }
    } catch (err) {
      console.error("Failed to attach file", err);
      alert(`Failed to attach file: ${err}`);
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const filePaths: string[] = [];
    for (const file of files) {
      const electronFile = file as File & { path?: string };
      if (electronFile.path) {
        filePaths.push(electronFile.path);
      }
    }
    if (filePaths.length > 0) {
      await attachFiles(filePaths);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground relative transition-colors duration-200">
      {/* Chat Header */}
      <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2 z-10">
        <div className="relative flex-1" ref={chatDropdownRef}>
          <div
            onClick={() => setShowChatDropdown(!showChatDropdown)}
            className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:border-mirai-accent/50 transition-colors"
          >
            <span className="truncate flex-1 text-foreground font-medium">
              {activeSession?.title || 'New Chat'}
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          </div>

          {showChatDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-72 flex flex-col overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
                  <Search size={14} className="text-muted-foreground shrink-0" />
                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search chats..."
                    className="bg-transparent text-sm text-foreground outline-none w-full placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {filteredSessions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No chats found</div>
                ) : (
                  filteredSessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => { 
                        if (editingSessionId !== session.id) {
                          switchChat(session.id); 
                          setShowChatDropdown(false); 
                          setChatSearch(''); 
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-muted ${
                        session.id === activeChatId ? 'bg-mirai-accent/10 text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {editingSessionId === session.id ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => {
                            if (editTitle.trim()) renameChat(session.id, editTitle.trim());
                            setEditingSessionId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editTitle.trim()) renameChat(session.id, editTitle.trim());
                              setEditingSessionId(null);
                            } else if (e.key === 'Escape') {
                              setEditingSessionId(null);
                            }
                          }}
                          className="flex-1 bg-background border border-mirai-accent/50 rounded px-1.5 py-0.5 text-sm text-foreground outline-none w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate flex-1">{session.title}</span>
                      )}
                      
                      {!editingSessionId && (
                        <>
                          <span className="text-[10px] text-muted-foreground/50">
                            {session.messages.length} msgs
                          </span>
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditTitle(session.title);
                              setEditingSessionId(session.id);
                            }}
                            className="p-1 rounded hover:bg-blue-500/20 hover:text-blue-400 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all"
                            title="Rename"
                          >
                            <FileEdit size={12} />
                          </button>
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              deleteChat(session.id); 
                              if (activeChatId === session.id && sessions.length > 0) {
                                switchChat(sessions[0].id);
                              }
                            }}
                            className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => newChat()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
          title="New Chat"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-48 flex flex-col gap-6 custom-scrollbar">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto w-full mt-10"
            >
              <div className="relative w-48 h-48 mb-8 opacity-[0.03] pointer-events-none">
                <Image src="/logo.png" alt="Mirai Logo" fill className="object-cover" unoptimized />
              </div>
              <h2 className="text-3xl font-semibold mb-2 text-foreground">How can I help you?</h2>
              <p className="text-muted-foreground text-sm">Ask questions, edit files, or let the AI build features for you.</p>
            </motion.div>
          ) : (
            messages.map((msg, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full group`}
              >
                <div 
                  className={`relative max-w-[90%] text-[15px] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'px-5 py-3.5 rounded-3xl rounded-tr-sm bg-[#f4f4f4] dark:bg-[#32302c] text-foreground' 
                      : msg.role === 'tool'
                        ? 'px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-border text-sm font-mono text-muted-foreground w-full break-all'
                        : 'text-foreground w-full'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.role === 'tool' ? (
                    <div>
                      <div className="font-semibold mb-1 text-xs text-foreground/50 flex items-center">
                        <span>Tool executed: {msg.name}</span>
                        {msg.durationMs !== undefined && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-normal text-foreground/50 font-mono">
                            {(msg.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-2">
                      {msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="mb-2 space-y-1.5">
                          {msg.tool_calls.map((tc, idx) => (
                            <details key={tc.id || idx} className="text-xs bg-black/5 dark:bg-white/5 border border-border rounded-md overflow-hidden group">
                              <summary className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 select-none list-none text-foreground/70 font-semibold transition-colors">
                                <span className="group-open:rotate-90 transition-transform text-[10px]">▶</span>
                                <span className="text-[10px] animate-pulse">⚙️</span>
                                <span>Using {tc.function.name}</span>
                              </summary>
                              <div className="px-3 py-2 font-mono text-[10px] text-foreground/50 whitespace-pre-wrap bg-black/20 dark:bg-black/40 border-t border-border/50">
                                {tc.function.arguments}
                              </div>
                            </details>
                          ))}
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-gray-100 dark:prose-pre:bg-[#2a2926] prose-pre:border prose-pre:border-border">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.durationMs !== undefined && (
                          <div className="mt-2 text-[10px] text-muted-foreground/30 text-right font-mono select-none">
                            Generated in {(msg.durationMs / 1000).toFixed(1)}s
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Message Actions Toolbar */}
                  {msg.role === 'assistant' && (
                    <div className="absolute -bottom-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg border border-border p-1 shadow-sm z-20">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                        }}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors" 
                        title="Copy"
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        onClick={() => handleRegenerate(i)}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors" 
                        title="Regenerate"
                      >
                        <RotateCw size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex items-start w-full group mb-4"
          >
            <div className="px-5 py-3.5 rounded-3xl rounded-tl-sm bg-transparent border border-mirai-accent/30 text-foreground flex items-center gap-2">
              <span className="flex gap-1">
                <motion.span animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-mirai-accent rounded-full" />
                <motion.span animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-mirai-accent rounded-full" />
                <motion.span animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-mirai-accent rounded-full" />
              </span>
              <span className="text-xs font-medium text-mirai-accent ml-2 relative flex items-center h-[18px] min-w-[200px] overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.div 
                    key={currentAction || 'Generating response...'}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute whitespace-nowrap"
                  >
                    {currentAction || 'Generating response...'}
                  </motion.div>
                </AnimatePresence>
              </span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent pb-6 pt-12 pointer-events-none"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={cn(
          "max-w-3xl mx-auto flex flex-col bg-white dark:bg-[#2a2926] border border-border rounded-2xl shadow-md transition-all duration-300 pointer-events-auto relative",
          isLoading ? "shadow-[0_0_30px_rgba(59,130,246,0.15)] border-mirai-accent/30" : isDragOver ? "shadow-lg border-blue-400/50 ring-2 ring-blue-400/20" : "focus-within:shadow-lg focus-within:border-black/20 dark:focus-within:border-white/20"
        )}>
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-blue-500/10 border-2 border-dashed border-blue-400/50 z-10 pointer-events-none">
              <span className="text-sm font-medium text-blue-400">Drop files to attach</span>
            </div>
          )}

          {/* OVERLAY SELECTORS FOR CONTEXT */}
          {showContextDropdown && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-[#1f1e1b] border border-border/80 rounded-xl shadow-2xl z-50 text-foreground py-1 text-xs font-semibold">
              <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/30">Add context to chat</div>
              <button
                type="button"
                onClick={() => { setShowContextDropdown(false); handleAttach(); }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground flex items-center gap-2 transition-colors"
              >
                <span className="font-bold text-sm">📄</span>
                Files
              </button>
              <button
                type="button"
                onClick={() => { setShowContextDropdown(false); handleAddDirectoryContext(); }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground flex items-center gap-2 transition-colors"
              >
                <span className="font-bold text-sm">📁</span>
                Directories
              </button>
              <button
                type="button"
                onClick={() => { setShowContextDropdown(false); setShowCodeContextSelector(true); }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground flex items-center gap-2 transition-colors"
              >
                <span className="font-bold text-sm">&lt;/&gt;</span>
                Code Context Items
              </button>
              <button
                type="button"
                onClick={() => { setShowContextDropdown(false); handleAddRulesContext(); }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground flex items-center gap-2 transition-colors"
              >
                <span className="font-bold text-sm">📋</span>
                Rules (.mirairules)
              </button>
              <button
                type="button"
                onClick={() => { setShowContextDropdown(false); loadRunningTasks(); setShowTerminalContextSelector(true); }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground flex items-center gap-2 transition-colors"
              >
                <span className="font-bold text-sm">&gt;_</span>
                Terminal Output Logs
              </button>
              <button
                type="button"
                onClick={() => { setShowContextDropdown(false); handleAddConversationContext(); }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground flex items-center gap-2 transition-colors"
              >
                <span className="font-bold text-sm">💬</span>
                Conversation History
              </button>
              <button
                type="button"
                onClick={() => { setShowContextDropdown(false); handleAddMcpContext(); }}
                className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground flex items-center gap-2 transition-colors"
              >
                <span className="font-bold text-sm">🔌</span>
                MCP Servers Info
              </button>
            </div>
          )}

          {showCodeContextSelector && (
            <div className="absolute bottom-full left-4 mb-2 w-72 bg-[#1f1e1b] border border-[#333333] rounded-xl shadow-2xl z-50 text-foreground py-1 text-xs">
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-[#333333] flex justify-between items-center font-semibold">
                <span>Select file to attach</span>
                <button type="button" onClick={() => setShowCodeContextSelector(false)} className="hover:text-foreground">Close</button>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {useWorkspaceStore.getState().editorGroups.flatMap(g => g.openFiles).length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground">No open editor files.</div>
                ) : (
                  useWorkspaceStore.getState().editorGroups.flatMap(g => g.openFiles).map((file, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInput(prev => prev + `\n\n[Context: ${file.path.split(/[/\\]/).pop()}]\n\`\`\`\n${file.content}\n\`\`\`\n`);
                        setShowCodeContextSelector(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground truncate transition-colors font-medium flex items-center gap-1.5"
                    >
                      <span>📄</span>
                      <span className="truncate">{file.path.split(/[/\\]/).pop()}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {showTerminalContextSelector && (
            <div className="absolute bottom-full left-4 mb-2 w-72 bg-[#1f1e1b] border border-[#333333] rounded-xl shadow-2xl z-50 text-foreground py-1 text-xs">
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-[#333333] flex justify-between items-center font-semibold">
                <span>Select task logs to attach</span>
                <button type="button" onClick={() => setShowTerminalContextSelector(false)} className="hover:text-foreground">Close</button>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {runningTasks.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground">No tasks with output logs.</div>
                ) : (
                  runningTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setInput(prev => prev + `\n\n[Terminal Logs: ${t.command}]\n\`\`\`\n${t.logs}\n\`\`\`\n`);
                        setShowTerminalContextSelector(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-primary hover:text-primary-foreground truncate transition-colors font-medium flex flex-col gap-0.5"
                    >
                      <span className="truncate font-semibold">{t.command}</span>
                      <span className="text-[10px] opacity-75 truncate">{t.status}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          
          <TextareaAutosize
            key={`textarea-zoom-${zoom}`}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              if (val.endsWith('@')) {
                setShowContextDropdown(true);
              } else if (!val.includes('@')) {
                setShowContextDropdown(false);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Mirai anything..."
            className="w-full bg-transparent resize-none px-4 py-3 text-sm text-foreground focus:outline-none"
            minRows={1}
            maxRows={6}
          />

          <div className="flex flex-wrap items-center justify-between px-2 pb-2 gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-1 min-w-0">
              {/* @ Context Button */}
              <button 
                onClick={() => setShowContextDropdown(!showContextDropdown)}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0"
                type="button"
              >
                <span className="text-sm font-bold leading-none select-none font-sans text-muted-foreground">@</span>
                <span className="hidden xs:inline">Context</span>
              </button>

              <button 
                onClick={handleAttach}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0"
              >
                <Paperclip size={14} className="shrink-0" />
                <span className="hidden xs:inline">Attach</span>
              </button>
              <button 
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                className={cn(
                  "p-1.5 rounded transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0",
                  webSearchEnabled 
                    ? "bg-[#5cb6ff]/20 text-[#5cb6ff] hover:bg-[#5cb6ff]/30" 
                    : "text-muted-foreground hover:bg-muted"
                )}
                title="Search the web for real-time information"
              >
                <Globe size={14} className="shrink-0" />
                <span className="hidden xs:inline">Search</span>
              </button>
 
              <select
                value={aiProvider}
                onChange={(e) => {
                  const prov = e.target.value as AIProvider;
                  setAiProvider(prov);
                }}
                className="bg-transparent text-muted-foreground hover:text-foreground text-xs font-semibold focus:outline-none cursor-pointer px-1 rounded hover:bg-muted transition-colors h-8 shrink-0 max-w-[85px] truncate"
              >
                <option value="openai" className="dark:bg-[#2a2926]">OpenAI</option>
                <option value="anthropic" className="dark:bg-[#2a2926]">Anthropic</option>
                <option value="google" className="dark:bg-[#2a2926]">Gemini</option>
                <option value="ollama" className="dark:bg-[#2a2926]">Ollama</option>
                <option value="mistral" className="dark:bg-[#2a2926]">Mistral</option>
                <option value="openrouter" className="dark:bg-[#2a2926]">OpenRouter</option>
                <option value="groq" className="dark:bg-[#2a2926]">Groq</option>
                <option value="together" className="dark:bg-[#2a2926]">Together AI</option>
                <option value="fireworks" className="dark:bg-[#2a2926]">Fireworks</option>
                <option value="deepinfra" className="dark:bg-[#2a2926]">DeepInfra</option>
                <option value="novita" className="dark:bg-[#2a2926]">Novita</option>
                <option value="cerebras" className="dark:bg-[#2a2926]">Cerebras</option>
                <option value="perplexity" className="dark:bg-[#2a2926]">Perplexity</option>
                <option value="opencode" className="dark:bg-[#2a2926]">OpenCode</option>
                <option value="deepseek" className="dark:bg-[#2a2926]">DeepSeek</option>
              </select>
 
              {(() => {
                const currentModel = providerConfigs[aiProvider]?.model || '';
                const modelsList = COMMON_MODELS[aiProvider] || [];
                const modelOptions = modelsList.includes(currentModel) 
                  ? modelsList 
                  : (currentModel ? [...modelsList, currentModel] : modelsList);
                
                return (
                  <select
                    value={currentModel}
                    onChange={(e) => updateProviderConfig(aiProvider, { model: e.target.value })}
                    className="bg-transparent text-muted-foreground hover:text-foreground text-xs font-semibold focus:outline-none cursor-pointer px-1 rounded hover:bg-muted transition-colors h-8 max-w-[95px] truncate shrink-0"
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m} className="dark:bg-[#2a2926]">{m}</option>
                    ))}
                  </select>
                );
              })()}
 
              {/* Select Dropdown for Agent Mode */}
              <select
                value={agentMode}
                onChange={(e) => setAgentMode(e.target.value as 'plan' | 'auto' | 'review')}
                className="bg-transparent text-[#a855f7] hover:text-[#a855f7]/80 text-xs font-semibold focus:outline-none cursor-pointer px-1 rounded hover:bg-muted transition-colors h-8 shrink-0 max-w-[90px] truncate"
              >
                <option value="plan" className="dark:bg-[#2a2926]">Plan Mode</option>
                <option value="auto" className="dark:bg-[#2a2926]">Auto Mode</option>
                <option value="review" className="dark:bg-[#2a2926]">Review Mode</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button 
                onClick={toggleSpeechRecording}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isRecording 
                    ? "text-red-500 bg-red-500/10 hover:bg-red-500/20 animate-pulse" 
                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
                title={isRecording ? "Stop Recording (Listening...)" : "Start Voice Typing"}
                type="button"
              >
                <Mic size={18} />
              </button>
              {isLoading ? (
                <button
                  onClick={() => setIsLoading(false)}
                  className="p-2 rounded-xl transition-all flex items-center justify-center shadow-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 shrink-0"
                >
                  <Square size={18} fill="currentColor" />
                </button>
              ) : (
                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className={cn(
                    "p-2 rounded-xl transition-all flex items-center justify-center shadow-sm shrink-0",
                    input.trim()
                      ? "bg-black text-white dark:bg-white dark:text-black hover:opacity-80"
                      : "bg-black/5 text-black/30 dark:bg-white/5 dark:text-white/30"
                  )}
                >
                  <Send size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="text-center mt-2 text-[11px] text-muted-foreground font-medium">
          Mirai can make mistakes. Please verify information.
        </div>
      </div>
    </div>
  );
}
