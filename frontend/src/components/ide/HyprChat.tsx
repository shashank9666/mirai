'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import TokenOptimizationTips from './TokenOptimizationTips';
import { useAiStore } from '@/store/aiStore';
import { useChatStore } from '@/store/chatStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useEditorStore } from '@/store/editorStore';

import { WifiOff, Mic, MicOff, Plus, ChevronRight, Paperclip, FileCode, X, GitCompareArrows, FilePlus2, Check, RotateCcw, ChevronDown, Clock, BookOpen, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import SimpleBar from 'simplebar-react';
import { formatTokens } from '@/lib/agent/policies';
// Removed AgentPreferencesPanel import
// Removed DEFAULT_AGENT_PREFERENCES import
import { useVoiceStore } from '@/store/voiceStore';
import VoiceOrb from './VoiceOrb';
import AgentReviewPanel from './AgentReviewPanel';
import PermissionModal from './PermissionModal';
import ConversationHistory from './ConversationHistory';
import CustomizationsPanel from './CustomizationsPanel';

const DEFAULT_SYSTEM_PROMPT = `You are Mirai, an autonomous software engineering agent inside Mirai IDE.

ENVIRONMENT

You have direct access to:
- Entire workspace file system
- Open editors
- Terminal
- Browser
- Search tools
- Project structure
- Git repository

You can inspect, read, create, modify, rename, and delete files.
You MUST assume workspace access already exists.

DO NOT ask the user:
- to upload files
- to paste code
- to provide project structure
- to provide folder names
- to provide file contents
unless you have already searched the workspace and cannot find what is needed.

WORKFLOW

Before asking any question:
1. Search the workspace.
2. Read relevant files.
3. Analyze project structure.
4. Identify likely files.
5. Attempt the task.

Only ask questions if a genuine ambiguity remains.

FILE DISCOVERY

Never ask where files are located before searching. 
Use your directory listing and file reading tools to explore the workspace.

CODE CHANGES

CRITICAL: Do NOT use terminal commands (like echo, cat, sed, python scripts, or shell redirection) to edit code files directly. Use the write_file tool or output code blocks in the chat using the following format. The IDE frontend will convert them into reviewable pending changes.

When asked to change code, you MUST use the following format exactly:

\`\`\`<language>:<filepath>
<file contents>
\`\`\`

Example:
\`\`\`html:index.html
<!DOCTYPE html>
...
\`\`\`

Always provide the FULL file contents. Do not truncate. Explain your changes briefly before or after the code block.

AGENTIC WORKFLOW

For code tasks, behave like a direct, action-oriented coding agent:
1. Inspect relevant files before writing edits.
2. Comply with the active auto-approval settings. If a setting allows auto-applying code edits, perform the write operations immediately using your tools instead of presenting them as pending user changes.
3. Do NOT default to planning mode or separate planning phases unless specifically requested by the user. Move straight to execution and applying files.
4. If approval is required by the active settings, propose the code block in the chat and pause for review; otherwise, write/execute them directly and inform the user.
5. Do not claim files were changed unless a tool confirmed it.

AUTONOMY

Default behavior:
* Investigate first
* Act second
* Ask last

You are expected to behave like a senior autonomous agent. The user should not need to manually guide file discovery. If information exists in the workspace, retrieve it yourself.`;

interface ChatPanelProps {
  isPinned: boolean;
  isMinimized: boolean;
  onPin: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

function PendingChangesWidget({ changeIds }: { changeIds: string[] }) {
  const { pendingChanges, openDiffForReview, acceptChange, rejectChange } = useEditorStore();
  const changes = changeIds.map((id) => pendingChanges.find((c) => c.id === id))
    .filter(Boolean) as typeof pendingChanges;

  if (changes.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-1 max-w-[90%]">
      {changes.map((change) => (
        <div
          key={change.id}
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[11px] font-mono border transition-all ${change.status === 'accepted'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : change.status === 'rejected'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-white/5 border-white/10 text-white/70'
            }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <FileCode className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{change.fileName}</span>
            {change.status !== 'pending' && (
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${change.status === 'accepted' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                }`}>
                {change.status}
              </span>
            )}
          </div>
          {change.status === 'pending' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => openDiffForReview(change.id)}
                className="px-2 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors border border-blue-500/30"
                title="View Diff"
              >
                <GitCompareArrows className="w-3 h-3" />
              </button>
              <button
                onClick={() => rejectChange(change.id)}
                className="px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/30"
              >
                Reject
              </button>
              <button
                onClick={async () => { await acceptChange(change.id); }}
                className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors border border-emerald-500/30"
              >
                Accept
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Token count badge for messages
function TokenBadge({ tokenCount, role }: { tokenCount?: number; role: string }) {
if (tokenCount === undefined) return null;
return (
  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${role === 'user' ? 'bg-white/5 text-white/30' : 'bg-white/5 text-white/30'
    }`}>
    ~{formatTokens(tokenCount)}
  </span>
);
}

function CodeBlockRenderer({ children, className, handleReviewChange }: { children?: React.ReactNode; className?: string; handleReviewChange: (filepath: string, code: string) => void;[key: string]: unknown }) {
  const codeString = String(children).replace(/\n$/, '');
  const match = /language-([a-zA-Z0-9_-]+)(?::(.+))?/.exec(className || '');
  const lang = match ? match[1] : '';
  let filepath = match && match[2] ? match[2] : '';

  const workspacePath = useWorkspaceStore.getState().workspacePath;
  let cleanCode = codeString;
  if (workspacePath && filepath) {
    const normalizedWorkspace = workspacePath.replace(/[\\/]+$/, '');
    const normalizedFilepath = filepath.trim().replace(/[\\/]+$/, '');
    const isDirectory = filepath.trim().endsWith('/') || 
                        filepath.trim().endsWith('\\') || 
                        normalizedFilepath === normalizedWorkspace;
    if (isDirectory) {
      const lines = codeString.split('\n');
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        const filenameRegex = /^[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]{1,5}$/;
        if (filenameRegex.test(firstLine)) {
          const sep = filepath.includes('\\') || workspacePath.includes('\\') ? '\\' : '/';
          filepath = normalizedFilepath + sep + firstLine;
          cleanCode = lines.slice(1).join('\n');
        }
      }
    }
  }

  const filename = filepath.split(/[/\\]/).pop() || filepath;

  return (
    <div className="my-2 border border-white/10 rounded-md bg-black/40 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-2">
        <ChevronRight className="w-4 h-4 text-white/50" />
        <FileCode className="w-3 h-3 text-blue-400" />
        <span className="text-[11px] font-mono text-white/80">Edited {lang.toUpperCase()} <span className="text-white font-semibold">{filename}</span></span>
        <span className="text-[10px] font-mono text-emerald-400 ml-2">+{cleanCode.split('\n').filter(l => l.trim()).length}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); handleReviewChange(filepath, cleanCode); }}
        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-[10px] font-mono transition-colors border border-emerald-500/30"
      >
        <GitCompareArrows className="w-3 h-3" />
        Review
      </button>
    </div>
  );
}

const MODELS_LIST = [
  { id: 'gemini-3.5-flash-medium', name: 'Gemini 3.5 Flash (Medium)', providerId: 'gemini', model: 'gemini-1.5-flash', speedBadge: 'Fast' },
  { id: 'gemini-3.5-flash-high', name: 'Gemini 3.5 Flash (High)', providerId: 'gemini', model: 'gemini-1.5-flash', speedBadge: 'Fast' },
  { id: 'gemini-3.5-flash-low', name: 'Gemini 3.5 Flash (Low)', providerId: 'gemini', model: 'gemini-1.5-flash', speedBadge: 'Fast' },
  { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (Low)', providerId: 'gemini', model: 'gemini-1.5-pro' },
  { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)', providerId: 'gemini', model: 'gemini-1.5-pro' },
  { id: 'claude-sonnet-4.6-thinking', name: 'Claude Sonnet 4.6 (Thinking)', providerId: 'anthropic', model: 'claude-3-5-sonnet-20240620' },
  { id: 'claude-opus-4.6-thinking', name: 'Claude Opus 4.6 (Thinking)', providerId: 'anthropic', model: 'claude-3-opus-20240229' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)', providerId: 'openai', model: 'gpt-4o' }
];

function StepItem({ step }: { step: import('@/store/chatStore').AgentStep }) {
  const [expanded, setExpanded] = useState(step.status === 'running');
  const title = step.title;
  const detail = step.detail || '';

  const FILE_ICONS: Record<string, string> = {
    '.tsx': '⚛️', '.ts': '🔷', '.js': '🟨', '.jsx': '⚛️',
    '.css': '🎨', '.json': '📋', '.md': '📝', '.py': '🐍',
    '.html': '🌐', '.env': '🔑', '.gitignore': '🙈',
  };

  const getFileIcon = (name: string) => {
    const ext = '.' + name.split('.').pop();
    return FILE_ICONS[ext] || '📄';
  };

  let type = 'default';
  let filename = '';
  let truncatedCmd = '';
  let additions = 0;
  let deletions = 0;
  let hasStats = false;
  let lineRange = '#L1-100';
  let fileLang = 'TS';

  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('run_command') || lowerTitle.includes('execute')) {
    type = 'run';
    let cmd = detail.trim();
    if (cmd.startsWith('{') || cmd.startsWith('[')) {
      try {
        const parsed = JSON.parse(cmd);
        cmd = parsed.CommandLine || parsed.command || cmd;
      } catch {}
    }
    truncatedCmd = cmd ? cmd.split('\n')[0].slice(0, 35) + (cmd.length > 35 ? '...' : '') : 'command';
  } else if (
    lowerTitle.includes('write') ||
    lowerTitle.includes('replace') ||
    lowerTitle.includes('edit') ||
    lowerTitle.includes('multi_replace')
  ) {
    type = 'edit';
    filename = 'file';
    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        const fullPath = parsed.TargetFile || parsed.path || '';
        filename = fullPath.split(/[/\\]/).pop() || 'file';

        if (parsed.ReplacementChunks && Array.isArray(parsed.ReplacementChunks)) {
          for (const chunk of parsed.ReplacementChunks) {
            if (chunk.TargetContent) {
              deletions += chunk.TargetContent.split('\n').length;
            }
            if (chunk.ReplacementContent) {
              additions += chunk.ReplacementContent.split('\n').length;
            }
          }
          hasStats = true;
        } else if (parsed.TargetContent && parsed.ReplacementContent) {
          deletions = parsed.TargetContent.split('\n').length;
          additions = parsed.ReplacementContent.split('\n').length;
          hasStats = true;
        } else if (parsed.CodeContent) {
          additions = parsed.CodeContent.split('\n').length;
          deletions = 0;
          hasStats = true;
        }
      } catch {
        const pathMatch = detail.match(/(?:TargetFile|path)["']?\s*:\s*["']([^"']+)["']/);
        if (pathMatch) {
          filename = pathMatch[1].split(/[/\\]/).pop() || 'file';
        } else {
          filename = detail.split(/[/\\]/).pop() || 'file';
        }
      }
    }
    if (!hasStats) {
      additions = 2;
      deletions = 2;
      hasStats = true;
    }
  } else if (
    lowerTitle.includes('read') ||
    lowerTitle.includes('view') ||
    lowerTitle.includes('list')
  ) {
    type = 'read';
    filename = 'api.ts';
    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        const fullPath = parsed.AbsolutePath || parsed.DirectoryPath || parsed.TargetFile || parsed.path || '';
        filename = fullPath.split(/[/\\]/).pop() || 'api.ts';
        if (parsed.StartLine && parsed.EndLine) {
          lineRange = `#L${parsed.StartLine}-${parsed.EndLine}`;
        } else if (parsed.startLine && parsed.endLine) {
          lineRange = `#L${parsed.startLine}-${parsed.endLine}`;
        } else {
          lineRange = '#L20-60';
        }
      } catch {
        const pathMatch = detail.match(/(?:AbsolutePath|DirectoryPath|TargetFile|path)["']?\s*:\s*["']([^"']+)["']/);
        if (pathMatch) {
          filename = pathMatch[1].split(/[/\\]/).pop() || 'api.ts';
        }
        lineRange = '#L20-60';
      }
    } else {
      lineRange = '#L20-60';
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'ts' || ext === 'tsx') fileLang = 'TS';
    else if (ext === 'js' || ext === 'jsx') fileLang = 'JS';
    else if (ext === 'py') fileLang = 'PY';
    else if (ext === 'css') fileLang = 'CSS';
    else if (ext === 'html') fileLang = 'HTML';
    else if (ext === 'json') fileLang = 'JSON';
    else fileLang = ext?.toUpperCase() || 'TXT';
  }

  const isReadStep = type === 'read';
  const hasDetail = isReadStep || !!detail;

  return (
    <div className="flex flex-col overflow-hidden mb-1.5 transition-all w-full font-mono text-[11px]">
      <div
        onClick={() => hasDetail && setExpanded(!expanded)}
        className="flex items-center justify-between py-1 text-white/70 select-none cursor-pointer hover:text-white transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isReadStep ? (
            <span className="text-white/60 font-semibold">
              {step.status === 'completed' ? 'Explored 1 file' : 'Exploring 1 file'}
            </span>
          ) : type === 'edit' ? (
            <>
              <span className="text-white/40">Edited</span>
              <span className="text-[11px] shrink-0">{getFileIcon(filename)}</span>
              <span className="text-white/80 font-medium truncate">{filename}</span>
              {hasStats && (
                <span className="flex items-center gap-1 text-[9px] font-bold">
                  <span className="text-emerald-400">+{additions}</span>
                  <span className="text-rose-400">-{deletions}</span>
                </span>
              )}
            </>
          ) : type === 'run' ? (
            <>
              <span className="text-white/40">Ran</span>
              <span className="text-blue-400 shrink-0">⚙️</span>
              <span className="text-white/80 font-medium truncate">{truncatedCmd}</span>
            </>
          ) : (
            <>
              <span className="text-purple-400 shrink-0">⚡</span>
              <span className="text-white/80 font-medium truncate">{title}</span>
            </>
          )}
        </div>

        {hasDetail && (
          <div className="flex items-center shrink-0">
            <span className="text-[10px] text-white/30 mr-1.5">
              {expanded ? 'v' : '>'}
            </span>
          </div>
        )}
      </div>

      {expanded && isReadStep && (
        <div className="pl-4 py-0.5 flex flex-col gap-1 border-l border-white/10 ml-1.5 text-[10px] text-white/50">
          <div className="flex items-center gap-1.5">
            <span>Analyzed</span>
            <span className="px-1 py-0.2 bg-blue-500/15 text-blue-400 rounded text-[8px] font-bold tracking-wider">{fileLang}</span>
            <span className="text-white/70 font-semibold">{filename}</span>
            <span className="text-white/35 font-mono">{lineRange}</span>
          </div>
          {(step.status === 'running' || step.status === 'waiting_approval') && (
            <div className="text-white/40 italic flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>Working</span>
            </div>
          )}
        </div>
      )}

      {expanded && !isReadStep && detail && (
        <div className="pl-4 py-1 border-l border-white/10 ml-1.5 text-[9px] text-white/40 whitespace-pre-wrap break-all max-h-[160px] overflow-y-auto custom-scrollbar">
          {detail}
        </div>
      )}
    </div>
  );
}

function AgentSteps({ steps }: { steps?: import('@/store/chatStore').AgentStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-2 flex flex-col gap-0.5 w-full max-w-[95%]">
      {steps.map((step) => (
        <StepItem key={step.id} step={step} />
      ))}
    </div>
  );
}

interface AgentFileProposal {
  path: string;
  newContent: string;
  oldContent?: string;
}

const getVoiceRecorderOptions = (): MediaRecorderOptions | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
};

const extractJsonObjects = (text: string): unknown[] => {
  const objects: unknown[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length; j += 1) {
      const char = text[j];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            objects.push(JSON.parse(text.slice(i, j + 1)));
            i = j;
          } catch {
            // Keep scanning; this brace pair was not standalone JSON.
          }
          break;
        }
      }
    }
  }
  return objects;
};

const normalizeProposal = (value: unknown): AgentFileProposal | null => {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const path = data.path;
  const newContent = data.newContent ?? data.content ?? data.proposedContent;

  if (data.approval_required !== true && data.tool !== 'write_file') return null;
  if (typeof path !== 'string' || typeof newContent !== 'string') return null;

  return {
    path,
    newContent,
    oldContent: typeof data.oldContent === 'string' ? data.oldContent : undefined,
  };
};

export default function HyprChat({ isMinimized, onClose, onDragStart }: ChatPanelProps) {
  const { activeAiProviderId, aiProviders, autoApproveSettings, setAutoApproveSettings, setActiveAiProvider } = useAiStore();
  const activeModelId = useAiStore(s => (s as any).activeModelId) || 'gemini-3.1-pro-low';
  const currentModel = MODELS_LIST.find(m => m.id === activeModelId) || MODELS_LIST[3];
  const {
    messages: chatMessages,
    addMessage,
    updateMessage,
    clearMessages,
    createConversation,
  } = useChatStore();
  const isPlaying = useVoiceStore(s => s.isPlaying);
  const hasPendingChanges = useEditorStore(state => state.pendingChanges.some(c => c.status === 'pending'));
  const workspaceName = useWorkspaceStore((s) => s.workspaceName);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [customizationsTab, setCustomizationsTab] = useState<'rules' | 'workflows' | 'preferences'>('rules');
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomizations, setShowCustomizations] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isConvoMode, setIsConvoMode] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachedPaths, setAttachedPaths] = useState<string[]>([]);
  const lastUserInputRef = useRef('');

  useEffect(() => {
    if (isStreaming) {
      useVoiceStore.getState().setState('speaking');
    } else if (isListening) {
      useVoiceStore.getState().setState('listening');
    } else if (hasPendingChanges) {
      useVoiceStore.getState().setState('thinking');
    } else {
      useVoiceStore.getState().setState('idle');
    }
  }, [isStreaming, isListening, hasPendingChanges]);


  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Health check on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
        setBackendAvailable(res.ok);
      } catch {
        setBackendAvailable(false);
      }
    };
    checkBackend();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [chatMessages, scrollToBottom]);

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    useVoiceStore.getState().stopAudio();
  };

  const isListeningRef = useRef(false);

  const sendMessageRef = useRef<() => void>(() => { });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const stopListening = useCallback(() => {
    if (!isListeningRef.current && !mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    isListeningRef.current = false;
    setIsListening(false);
    useVoiceStore.getState().stopRecording();
    useVoiceStore.getState().setMicVolume(0);

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current || isStreaming || backendAvailable === false) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice capture is not supported in this environment.');
      useVoiceStore.getState().setError('Voice capture is not supported here.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const recorder = new MediaRecorder(stream, getVoiceRecorderOptions());

      mediaStreamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        useVoiceStore.getState().setMicVolume(0);

        if (blob.size < 512) {
          useVoiceStore.getState().setState('idle');
          return;
        }
        
        try {
          useVoiceStore.getState().setState('thinking');
          const { voiceSTT } = await import('@/lib/api');
          const openaiApiKey = useAiStore.getState().aiProviders.find(p => p.id === 'openai')?.apiKey;
          const transcript = (await voiceSTT(blob, openaiApiKey, 'openai')).trim();
          useVoiceStore.getState().setLastTranscript(transcript);
          if (transcript) {
            setInput(prev => prev + (prev ? ' ' : '') + transcript);
            setTimeout(() => {
              sendMessageRef.current();
            }, 50);
          } else {
            useVoiceStore.getState().setState('idle');
          }
        } catch (err) {
          console.error('Transcription error:', err);
          const message = err instanceof Error ? err.message : 'Backend transcription failed.';
          setError(message);
          useVoiceStore.getState().setError(message);
        }
      };
      recorder.onerror = () => {
        const message = 'Voice recorder failed. Restart listening and try again.';
        setError(message);
        useVoiceStore.getState().setError(message);
        stopListening();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
      isListeningRef.current = true;
      hasSpokenRef.current = false;
      setError(null);
      useVoiceStore.getState().startRecording();

      // VAD setup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

        const checkAudioLevel = () => {
        if (!isListeningRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        useVoiceStore.getState().setMicVolume(average);

        // Thresholds
        const SILENCE_THRESHOLD = 15;
        
        if (average > SILENCE_THRESHOLD) {
          if (!hasSpokenRef.current) hasSpokenRef.current = true;
          
          // Interrupt AI if it's currently speaking/generating and user starts talking loudly
          const { isPlaying } = useVoiceStore.getState();
          const isGenerating = useChatStore.getState().messages.some(m => m.role === 'assistant' && m.content === '');
          if (average > 30 && (isPlaying || isGenerating)) {
             useVoiceStore.getState().stopAudio();
             stopGeneration();
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          if (hasSpokenRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopListening();
            }, 1500); // 1.5 seconds of silence
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();

    } catch (err) {
      console.error('Microphone access denied:', err);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      const message = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone permission was denied.'
        : 'Could not start microphone.';
      setError(message);
      useVoiceStore.getState().setError(message);
    }
  }, [backendAvailable, isStreaming, stopListening]);

  const toggleVoiceMode = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const prevIsPlayingRef = useRef(false);
  useEffect(() => {
    if (isConvoMode) {
      if (prevIsPlayingRef.current && !isPlaying && !isStreaming) {
        // AI finished speaking, auto-restart mic after a small delay
        window.setTimeout(() => {
          if (isConvoMode && !isStreaming && !isListeningRef.current) startListening();
        }, 800); 
      }
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying, isStreaming, isConvoMode, startListening]);

  useEffect(() => {
    return () => {
      stopListening();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, [stopListening]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const path = e.dataTransfer.getData('application/mirai-file-path');
    if (path) {
      setAttachedPaths(prev => {
        if (!prev.includes(path)) return [...prev, path];
        return prev;
      });
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setAttachedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const handleUploadMedia = () => {
    setShowActionMenu(false);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleAddActiveFile = () => {
    setShowActionMenu(false);
    const activeGroup = useEditorStore.getState().getActiveGroup();
    const activeFile = activeGroup?.activeFile;
    if (activeFile) {
      setAttachedPaths(prev => {
        if (!prev.includes(activeFile)) return [...prev, activeFile];
        return prev;
      });
    }
  };

  const handleReviewChange = async (filepath: string, codeString: string, knownOriginalContent?: string) => {
    try {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) return;

      let cleanFilepath = filepath.trim();
      let cleanCode = codeString;

      const normalizedWorkspace = workspacePath.replace(/[\\/]+$/, '');
      const normalizedFilepath = cleanFilepath.replace(/[\\/]+$/, '');
      const isDirectory = cleanFilepath.endsWith('/') || 
                          cleanFilepath.endsWith('\\') || 
                          normalizedFilepath === normalizedWorkspace;

      if (isDirectory) {
        const lines = cleanCode.split('\n');
        if (lines.length > 0) {
          const firstLine = lines[0].trim();
          const filenameRegex = /^[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]{1,5}$/;
          if (filenameRegex.test(firstLine)) {
            const sep = workspacePath.includes('\\') ? '\\' : '/';
            cleanFilepath = normalizedFilepath + sep + firstLine;
            cleanCode = lines.slice(1).join('\n');
          }
        }
      }

      const sep = workspacePath.includes('\\') ? '\\' : '/';
      const absPath = cleanFilepath.startsWith('/') || cleanFilepath.match(/^[a-zA-Z]:[\\/]/) ? cleanFilepath : `${workspacePath}${sep}${cleanFilepath}`;
      codeString = cleanCode; // Bind back to original variable for rest of function

      let originalContent = knownOriginalContent ?? '';
      if (knownOriginalContent === undefined) {
        try {
          const res = await fetch('http://127.0.0.1:8000/api/fs/readFile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: absPath }),
          });
          const result = await res.json();
          originalContent = result.content;
        } catch {
          originalContent = '';
        }
      }

      const { proposePendingChange, setActiveFile, acceptChange, openDiffForReview } = useEditorStore.getState();
      const existing = useEditorStore.getState().pendingChanges.find(
        (change) => change.status === 'pending' && change.filePath === absPath && change.proposedContent === codeString
      );
      if (existing) {
        openDiffForReview(existing.id);
        return;
      }

      const changeId = proposePendingChange(absPath, codeString, originalContent);

      if (useAiStore.getState().autoApproveSettings.editProjectFiles) {
        await acceptChange(changeId);
      } else {
        const fileName = absPath.split(/[/\\]/).pop() || absPath;
        setActiveFile(absPath, fileName, originalContent);
        openDiffForReview(changeId);
      }
    } catch (err) {
      console.error('Failed to open review:', err);
    }
  };

  const collectFileProposals = useCallback((value: unknown): AgentFileProposal[] => {
    const proposals: AgentFileProposal[] = [];
    if (typeof value === 'string') {
      for (const object of extractJsonObjects(value)) {
        const proposal = normalizeProposal(object);
        if (proposal) proposals.push(proposal);
      }
      return proposals;
    }

    const direct = normalizeProposal(value);
    if (direct) proposals.push(direct);
    return proposals;
  }, []);

  const readProjectInstructions = useCallback(async (workspacePath: string): Promise<string> => {
    if (!workspacePath || workspacePath === 'No workspace open') return '';
    const sep = workspacePath.includes('\\') ? '\\' : '/';
    const candidates = ['SKILLS.md', 'AGENTS.md', 'CLAUDE.md'];
    const sections: string[] = [];

    for (const file of candidates) {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/fs/readFile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: `${workspacePath}${sep}${file}` }),
        });
        if (!res.ok) continue;
        const result = await res.json();
        if (typeof result.content === 'string' && result.content.trim()) {
          sections.push(`${file}\n${result.content.trim()}`);
        }
      } catch {
        // Optional instruction files should not block chat.
      }
    }

    return sections.length
      ? `\n\nPROJECT INSTRUCTIONS\n${sections.join('\n\n---\n\n')}`
      : '';
  }, []);

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removePath = (index: number) => {
    setAttachedPaths(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0 && attachedPaths.length === 0 || isStreaming) return;

    if (backendAvailable === false) {
      setError('Cannot connect to AI backend. Make sure the server is running on port 8000.');
      return;
    }

    setError(null);
    let contentStr = text;
    lastUserInputRef.current = text;
    if (attachedFiles.length > 0) {
      contentStr += `\n[Attached Media: ${attachedFiles.map(f => f.name).join(', ')}]`;
    }
    if (attachedPaths.length > 0) {
      contentStr += `\n[Attached Project Files: ${attachedPaths.join(', ')}]`;
    }

    // Store user message in persistent store
    addMessage({ role: 'user', content: contentStr });
    const assistantMsg = addMessage({ role: 'assistant', content: '' });

    setInput('');
    setAttachedFiles([]);
    setAttachedPaths([]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const currentModel = MODELS_LIST.find(m => m.id === (useAiStore.getState() as any).activeModelId) || MODELS_LIST[3];
      const activeProvider = aiProviders.find(p => p.id === currentModel.providerId);
      const activeModelName = currentModel.model;

      // Build messages from chat store
      const storeMessages = useChatStore.getState().messages;
      const autoApproveSettings = useAiStore.getState().autoApproveSettings;
      const workspacePath = useWorkspaceStore.getState().workspacePath || 'No workspace open';
      const openFiles = useEditorStore.getState().groups.flatMap(g => g.tabs.map(t => t.path));
      const projectInstructions = await readProjectInstructions(workspacePath);

      const dynamicContext = `
CURRENT WORKSPACE
Workspace Root: ${workspacePath}
Open Files:
${openFiles.map(f => `- ${f}`).join('\n') || '- None'}

Use this information before asking the user for files.${projectInstructions}`;

      const res = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT + '\n\n' + dynamicContext + (!autoApproveSettings.editProjectFiles ? '\n\nIMPORTANT: You do NOT have permission to write files automatically. All file edits must become pending changes for user review. Do not say an edit is applied until the user accepts it.' : '\n\nCurrent setting: file edits may be auto-applied after the IDE creates a pending change.') },
            ...storeMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          provider: activeProvider?.id || 'openai',
          model: activeModelName,
          apiKey: activeProvider?.apiKey || '',
          baseUrl: activeProvider?.baseUrl || '',
          autoApproveSettings,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}${res.status === 500 ? ' - internal error' : ''}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'token' && event.content) {
              accumulatedContent += event.content;
              updateMessage(assistantMsg.id, { content: accumulatedContent });
            } else if (event.type === 'final') {
              if (typeof event.content === 'string' && event.content.trim()) {
                accumulatedContent = event.content;
                updateMessage(assistantMsg.id, { content: accumulatedContent });

                if (useVoiceStore.getState().autoTts || isConvoMode) {
                  import('@/lib/api').then(({ voiceTTS }) => {
                    const openaiApiKey = useAiStore.getState().aiProviders.find(p => p.id === 'openai')?.apiKey;
                    voiceTTS(accumulatedContent, openaiApiKey, 'openai').then((blob: Blob) => {
                      const url = URL.createObjectURL(blob);
                      useVoiceStore.getState().playAudio(url);
                    }).catch(console.error);
                  });
                }

                // Auto-parse file edits and create pending changes
                const fileRegex = /```[a-zA-Z0-9_-]+:([^\n]+)\n([\s\S]*?)```/g;
                let match;
                while ((match = fileRegex.exec(accumulatedContent)) !== null) {
                  const filepath = match[1].trim();
                  const codeString = match[2].trim();
                  void handleReviewChange(filepath, codeString);
                }

                for (const proposal of collectFileProposals(accumulatedContent)) {
                  void handleReviewChange(proposal.path, proposal.newContent, proposal.oldContent);
                }
              }
            } else if (event.type === 'tool_start') {
              const currentMsg = useChatStore.getState().messages.find(m => m.id === assistantMsg.id);
              const toolCalls = currentMsg?.toolCalls || [];
              updateMessage(assistantMsg.id, {
                toolCalls: [...toolCalls, { id: crypto.randomUUID(), name: event.name, status: 'running', input: event.input }]
              });
            } else if (event.type === 'workflow_step') {
              const currentMsg = useChatStore.getState().messages.find(m => m.id === assistantMsg.id);
              const steps = currentMsg?.steps || [];
              const detail = typeof event.detail === 'string'
                ? event.detail
                : event.detail
                  ? JSON.stringify(event.detail)
                  : undefined;
              const nextStep = {
                id: String(event.id || crypto.randomUUID()),
                title: String(event.title || 'Working'),
                status: event.status || 'running',
                detail,
                timestamp: Date.now(),
              };
              const existingIndex = steps.findIndex(step => step.id === nextStep.id);
              const nextSteps = existingIndex >= 0
                ? steps.map((step, index) => index === existingIndex ? { ...step, ...nextStep } : step)
                : [...steps, nextStep];
              updateMessage(assistantMsg.id, { steps: nextSteps });
            } else if (event.type === 'tool_end') {
              for (const proposal of collectFileProposals(event.output)) {
                void handleReviewChange(proposal.path, proposal.newContent, proposal.oldContent);
              }

              const currentMsg = useChatStore.getState().messages.find(m => m.id === assistantMsg.id);
              if (currentMsg?.toolCalls) {
                const updatedToolCalls = [...currentMsg.toolCalls];
                for (let i = updatedToolCalls.length - 1; i >= 0; i--) {
                  if (updatedToolCalls[i].name === event.name && updatedToolCalls[i].status === 'running') {
                    updatedToolCalls[i] = { ...updatedToolCalls[i], status: 'completed' };
                    break;
                  }
                }
                updateMessage(assistantMsg.id, { toolCalls: updatedToolCalls });
              }
            } else if (event.type === 'error') {
              const currentMsg = useChatStore.getState().messages.find(m => m.id === assistantMsg.id);
              const steps = currentMsg?.steps || [];
              updateMessage(assistantMsg.id, {
                steps: [...steps, {
                  id: `error:${Date.now()}`,
                  title: 'Agent run failed',
                  status: 'failed',
                  detail: event.error || event.content,
                  timestamp: Date.now(),
                }],
              });
              throw new Error(event.error || event.content || 'Unknown error from AI');
            }
          } catch (e) {
            if (e instanceof Error && !(e instanceof SyntaxError)) {
              throw e;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateMessage(assistantMsg.id, { content: '(Generation stopped)' });
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to connect to AI backend';
        setError(msg);
        useChatStore.getState().removeMessage(assistantMsg.id);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      // Remove empty assistant messages
      const currentContent = useChatStore.getState().messages.find(m => m.id === assistantMsg.id)?.content;
      if (!currentContent || !currentContent.trim()) {
        useChatStore.getState().removeMessage(assistantMsg.id);
      }

      const hasPending = useEditorStore.getState().pendingChanges.some(c => c.status === 'pending');
      if (!hasPending) {
        inputRef.current?.focus();
      }
    }
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  const handleClearChat = () => {
    if (chatMessages.length === 0) return;
    if (confirm('Clear all chat messages? This cannot be undone.')) {
      clearMessages();
      const { pendingChanges, rejectChange } = useEditorStore.getState();
      pendingChanges.forEach(c => {
        if (c.status === 'pending') rejectChange(c.id);
      });
    }
  };

  const handleNewChat = () => {
    createConversation(workspaceName || undefined);
    const { pendingChanges, rejectChange } = useEditorStore.getState();
    pendingChanges.forEach(c => {
      if (c.status === 'pending') rejectChange(c.id);
    });
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRetryLast = () => {
    const lastUserMessage = [...useChatStore.getState().messages].reverse().find(m => m.role === 'user');
    const retryText = lastUserInputRef.current || lastUserMessage?.content || '';
    setInput(retryText);
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const backendIndicator = backendAvailable === null
    ? 'bg-yellow-500 animate-pulse'
    : backendAvailable
      ? 'bg-green-500'
      : 'bg-red-500';

  const activeProvider = aiProviders.find(p => p.id === activeAiProviderId);
  const pendingChangeCount = useEditorStore(state => state.pendingChanges.filter(c => c.status === 'pending').length);


  return (
    <div
      className={`hypr-panel w-full h-full flex flex-col overflow-hidden relative transition-colors ${isDraggingOver ? 'bg-white/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm border-2 border-dashed border-[var(--color-primary-accent)] rounded-xl m-1">
          <div className="flex flex-col items-center text-white/80">
            <Paperclip className="w-8 h-8 mb-2" />
            <span className="font-mono text-sm">Drop files to attach</span>
          </div>
        </div>
      )}

      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Redesigned Custom Header */}
      <div
        draggable
        onDragStart={onDragStart}
        className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 bg-white/[0.01] shrink-0 select-none cursor-grab active:cursor-grabbing relative z-30"
        style={{ borderTop: `2px solid #7C3AED` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-bold text-xs text-white/90 tracking-wide font-sans">
            Agent
          </span>
          <div className="flex items-center gap-2 ml-2">
            <div className={`w-1.5 h-1.5 rounded-full ${backendIndicator}`} title={backendAvailable ? 'Backend connected' : backendAvailable === null ? 'Checking...' : 'Backend offline'} />
            {isStreaming && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
            )}
          </div>
        </div>

        {/* Action icons (+, 🕐, …, ×) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleNewChat}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
            title="New Chat (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowHistory(true)}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
            title="Chat History (🕐)"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`p-1 rounded transition-all flex items-center justify-center ${
                showSettingsMenu || showCustomizations
                  ? 'text-white bg-white/5'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
              title="More Options (…)"
            >
              <span className="font-bold text-[14px] leading-none block px-0.5 select-none pb-1">...</span>
            </button>

            <AnimatePresence>
              {showSettingsMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1.5 w-56 bg-black/95 border border-white/10 rounded-xl shadow-xl py-2 z-50 flex flex-col gap-0.5"
                >
                  <div className="px-3 pb-1.5 border-b border-white/5 mb-1 text-[10px] font-bold text-white/45 uppercase tracking-wider font-mono">
                    Agent Options
                  </div>

                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      setCustomizationsTab('rules');
                      setShowCustomizations(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[10px] font-mono text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Customizations (Rules/Workflows)
                  </button>

                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      setCustomizationsTab('preferences');
                      setShowCustomizations(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[10px] font-mono text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Agent Preferences
                  </button>

                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      const newState = !isConvoMode;
                      setIsConvoMode(newState);
                      if (newState && !isListeningRef.current) toggleVoiceMode();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[10px] font-mono text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {isConvoMode ? 'Disable Convo Mode' : 'Enable Convo Mode'}
                  </button>

                  <div className="border-t border-white/5 my-1" />

                  <div className="px-3 py-1 text-[9px] font-bold text-white/45 uppercase tracking-wider font-mono">
                    Auto-Approve Settings
                  </div>
                  {[
                    { id: 'readProjectFiles', label: 'Read Project Files' },
                    { id: 'editProjectFiles', label: 'Edit Project Files' },
                    { id: 'executeSafeCommands', label: 'Execute Commands' },
                  ].map((setting) => (
                    <label key={setting.id} className="flex items-center justify-between px-3 py-1 cursor-pointer hover:bg-white/5 group">
                      <span className="text-[10px] font-mono text-white/60 group-hover:text-white/90 transition-colors">
                        {setting.label}
                      </span>
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 checked:bg-purple-500 checked:border-transparent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        checked={autoApproveSettings[setting.id as keyof typeof autoApproveSettings]}
                        onChange={(e) => setAutoApproveSettings({ [setting.id]: e.target.checked })}
                      />
                    </label>
                  ))}

                  <div className="border-t border-white/5 my-1" />

                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      handleClearChat();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[10px] font-mono text-red-400 hover:bg-red-500/10 transition-colors font-semibold"
                  >
                    Clear Chat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Close Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Overlays (History, Customizations, Legacy Prefs) */}
          <AnimatePresence>
            {showHistory && (
              <ConversationHistory onClose={() => setShowHistory(false)} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCustomizations && (
              <CustomizationsPanel
                defaultTab={customizationsTab}
                onClose={() => setShowCustomizations(false)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {/* Agent Preferences moved to CustomizationsPanel */}
          </AnimatePresence>

          

          {/* Backend offline banner */}
          {backendAvailable === false && chatMessages.length === 0 && (
            <div className="mx-3 mt-2 px-3 py-2 rounded-xl text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2">
              <WifiOff className="w-3 h-3 shrink-0" />
              <span>Backend server not available. AI features are disabled.</span>
            </div>
          )}

          {/* Content Area */}
          <SimpleBar className="flex-1 p-3 flex flex-col gap-3 relative min-h-0">
            {isConvoMode ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--panel-bg)] z-30">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative flex items-center justify-center mb-8"
                >
                  <VoiceOrb size={200} showControls={false} showLabel={false} />
                </motion.div>
                <div className="font-mono text-[12px] text-white/50 tracking-widest uppercase text-center drop-shadow-md">
                  {isStreaming ? 'Mirai is speaking...' : isListening ? 'Listening...' : 'Convo Mode Paused'}
                </div>
                <div className="mt-8 px-8 text-center text-[11px] font-mono text-white/30 max-w-sm">
                  {chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user' ? (
                    <span className="text-white/60">&quot;{chatMessages[chatMessages.length - 1].content}&quot;</span>
                  ) : chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant' ? (
                    <span className="text-white/40 line-clamp-3">Mirai: {chatMessages[chatMessages.length - 1].content}</span>
                  ) : 'Speak to interact with Mirai.'}
                </div>
              </div>
            ) : (
              <>
                {chatMessages.length === 0 && !error && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 animate-fade-in select-none my-auto">
                    <div className="space-y-1">
                      <div className="text-[9px] font-semibold text-white/30 uppercase tracking-widest font-mono">Active Workspace</div>
                      <h1 className="text-base font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent px-2 font-sans">
                        {workspaceName || 'Mirai Workspace'}
                      </h1>
                    </div>

                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono border ${
                      backendAvailable === null
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25 animate-pulse'
                        : backendAvailable
                          ? 'bg-green-500/10 text-green-400 border-green-500/25'
                          : 'bg-red-500/10 text-red-400 border-red-500/25'
                    }`}>
                      {backendAvailable === null ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                          <span>⚠ Authenticating...</span>
                        </>
                      ) : backendAvailable ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span>✓ Connected</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span>✗ Disconnected</span>
                        </>
                      )}
                    </div>

                    <p className="text-[10px] text-white/40 max-w-[220px] font-mono leading-normal">
                      {backendAvailable === false
                        ? 'The backend server is offline. Run local server on port 8000 to enable agent functions.'
                        : 'Ask the agent to write code, search the workspace, edit files, or execute tests.'}
                    </p>
                  </div>
                )}

        {error && (
          <div className="px-3 py-2 rounded-xl text-[11px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* Message Header */}
            <div className="flex items-center gap-2 px-1 opacity-60">
              <span className="text-[10px] font-bold uppercase tracking-wider">{msg.role === 'user' ? 'You' : 'Mirai'}</span>
              <TokenBadge tokenCount={msg.tokenCount} role={msg.role} />
            </div>
            {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="flex flex-col gap-1 mb-1 mt-1 max-w-[90%]">
                {msg.toolCalls.map(tc => (
                  <div key={tc.id} className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-mono text-white/50 w-fit">
                    {tc.status === 'running' ? (
                      <div className="w-2.5 h-2.5 rounded-full border border-blue-400 border-t-transparent animate-spin shrink-0" />
                    ) : (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate max-w-[200px]">{tc.status === 'running' ? 'Running' : 'Completed'} <span className="text-white/70">{tc.name}</span></span>
                  </div>
                ))}
              </div>
            )}
            {msg.role === 'assistant' && <AgentSteps steps={msg.steps} />}
            <div
              className={`max-w-[90%] overflow-x-auto px-3 py-2 rounded-xl text-[12px] leading-relaxed font-mono ${msg.role === 'user'
                ? 'bg-[var(--color-primary-accent)]/20 text-[var(--text-active)] rounded-br-sm'
                : 'bg-[var(--color-glass-bg)] text-[var(--text-normal)] rounded-bl-sm border border-[var(--color-glass-border)]'
                }`}
            >
              <div className="whitespace-pre-wrap break-words">
                <ReactMarkdown
                  components={{
                    code(props) {
                      return <CodeBlockRenderer {...props} handleReviewChange={handleReviewChange} />;
                    },
                    a(props) {
                      const href = props.href || '';
                      const text = String(props.children || '');
                      const isWalkthrough = text.toLowerCase().includes('walkthrough.md') || href.toLowerCase().includes('walkthrough.md');
                      const isTask = text.toLowerCase().includes('task.md') || href.toLowerCase().includes('task.md');
                      const isImplementation = text.toLowerCase().includes('implementation.md') || href.toLowerCase().includes('implementation.md');

                      if (isWalkthrough || isTask || isImplementation) {
                        return (
                          <a
                            href={href}
                            onClick={(e) => {
                              e.preventDefault();
                              if (href.startsWith('file:///')) {
                                const path = href.replace('file:///', '');
                                const name = path.split('/').pop() || text;
                                fetch('http://127.0.0.1:8000/api/fs/readFile', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ filePath: path }),
                                })
                                  .then(res => res.json())
                                  .then(data => {
                                    if (data && data.content) {
                                      useEditorStore.getState().setActiveFile(path, name, data.content);
                                    }
                                  })
                                  .catch(console.error);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-semibold underline decoration-dotted cursor-pointer"
                          >
                            {isWalkthrough && <span className="mr-0.5">📖</span>}
                            {isTask && <span className="mr-0.5">☑️</span>}
                            {isImplementation && <span className="mr-0.5">📋</span>}
                            {text}
                          </a>
                        );
                      }
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                          {props.children}
                        </a>
                      );
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
              {isStreaming && msg.role === 'assistant' && i === chatMessages.length - 1 && (
                <span className="inline-block w-1.5 h-3 bg-purple-400/70 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>

            {msg.role === 'assistant' && i === chatMessages.length - 1 && !isStreaming && (
              <button
                type="button"
                onClick={handleRetryLast}
                className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono text-white/35 transition-colors hover:bg-white/5 hover:text-white/75"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            )}

            {msg.pendingChangeIds && msg.pendingChangeIds.length > 0 && (
              <PendingChangesWidget changeIds={msg.pendingChangeIds} />
            )}
          </div>
        ))}

        <div ref={messagesEndRef} className="h-4 w-full shrink-0" />
      </>
            )}
      </SimpleBar>

    {pendingChangeCount > 0 && (
      <div className="shrink-0 border-t border-white/5 bg-[#1E1E1E]/95 backdrop-blur-md max-h-[40%] flex flex-col z-40 relative">
        <AgentReviewPanel />
      </div>
    )}

          {/* Attached Files display */ }
  {
    (attachedFiles.length > 0 || attachedPaths.length > 0) && (
      <div className="px-2 py-1 flex gap-2 overflow-x-auto custom-scrollbar border-t border-white/5">
        {attachedPaths.map((path, idx) => (
          <div key={`path-${idx}`} className="flex items-center gap-1 bg-white/10 rounded-md px-2 py-1 shrink-0 group">
            <FileCode className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-mono text-white/80 max-w-[150px] truncate" title={path}>{path.split('/').pop() || path.split('\\').pop()}</span>
            <button onClick={() => removePath(idx)} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 ml-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {attachedFiles.map((file, idx) => (
          <div key={`file-${idx}`} className="flex items-center gap-1 bg-white/10 rounded-md px-2 py-1 shrink-0 group">
            <FileCode className="w-3 h-3 text-white/60" />
            <span className="text-[10px] font-mono text-white/80 max-w-[100px] truncate">{file.name}</span>
            <button onClick={() => removeFile(idx)} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 ml-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  {/* Token Optimization Tips */}
  <TokenOptimizationTips />

  {/* Input */}
  <div className="p-2 border-t border-white/5 shrink-0 relative flex flex-col gap-2">
    <AnimatePresence>
      {showActionMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-2 mb-2 w-48 bg-black/95 border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-1 z-50"
        >
          <button onClick={handleAddActiveFile} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[10px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <FilePlus2 className="w-3.5 h-3.5 text-blue-400/70" /> Add Active File
          </button>
          <button onClick={handleUploadMedia} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[10px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <Paperclip className="w-3.5 h-3.5 text-white/40" /> Upload Media
          </button>
        </motion.div>
      )}
    </AnimatePresence>

    <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-2 py-2 border border-white/5 focus-within:border-[var(--color-primary-accent)]/40 transition-colors relative z-20">
      <button
        onClick={() => setShowActionMenu(!showActionMenu)}
        className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center transition-colors ${showActionMenu ? 'text-white bg-white/10' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
      >
        <Plus className="w-4 h-4" />
      </button>

      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
        placeholder={hasPendingChanges ? 'Waiting for approval...' : backendAvailable === false ? 'Backend offline' : isListening ? 'Listening...' : 'Ask AI...'}
        disabled={isStreaming || backendAvailable === false || hasPendingChanges}
        className="flex-1 bg-transparent border-none outline-none text-[12px] text-[var(--text-active)] placeholder:text-[var(--text-muted)] font-mono disabled:opacity-40"
      />

      <button
        onClick={toggleVoiceMode}
        className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center transition-colors ${isListening ? 'text-red-400 bg-red-500/20' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
        title={isListening ? 'Stop Listening' : 'Start Listening'}
      >
        {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
      </button>

      {(isStreaming || isPlaying) ? (
        <button
          onClick={stopGeneration}
          className="w-6 h-6 rounded-lg bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-all shrink-0"
        >
          <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />
        </button>
      ) : (
        <button
          onClick={sendMessage}
          disabled={(!input.trim() && attachedFiles.length === 0 && attachedPaths.length === 0) || backendAvailable === false || hasPendingChanges}
          className="w-6 h-6 shrink-0 rounded-lg bg-[var(--color-primary-accent)]/80 flex items-center justify-center hover:bg-[var(--color-primary-accent)] transition-all disabled:opacity-40 disabled:hover:bg-[var(--color-primary-accent)]/80"
        >
          <svg className="w-3 h-3 text-white ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      )}
    </div>

    {/* Footer row with model selector & disclaimers */}
    <div className="flex items-center justify-between px-1.5 relative z-20">
      <div className="relative">
        <button
          onClick={() => setShowModelDropdown(!showModelDropdown)}
          className="flex items-center gap-1.5 px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] text-[9px] text-white/55 hover:text-white/80 rounded-md border border-white/5 transition-all font-mono"
        >
          <span className="text-purple-400 font-bold font-sans">+</span>
          <span>{currentModel.name}</span>
          <ChevronDown className="w-2.5 h-2.5 text-white/40" />
        </button>

        {/* Model dropdown */}
        <AnimatePresence>
          {showModelDropdown && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full left-0 mb-1.5 w-64 bg-black/95 border border-white/10 rounded-xl shadow-2xl py-2 z-50 flex flex-col gap-0.5 max-h-[240px] overflow-y-auto custom-scrollbar"
            >
              <div className="px-3 pb-1.5 border-b border-white/5 mb-1 text-[9px] font-bold text-white/45 uppercase tracking-wider font-mono">
                Model
              </div>

              {MODELS_LIST.map((model) => {
                const isSelected = model.id === activeModelId;
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      (useAiStore.getState() as any).setActiveModelId(model.id);
                      setShowModelDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[10px] font-mono flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-purple-500/10 text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`${isSelected ? 'font-semibold' : ''}`}>{model.name}</span>
                    {model.speedBadge && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded border font-semibold font-sans scale-90 bg-green-500/10 text-green-400 border-green-500/20">
                        {model.speedBadge} (i)
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* "AI may make mistakes" disclaimer text */}
      <span className="text-[9px] text-white/25 font-mono select-none">
        AI may make mistakes. Check all generated code.
      </span>
    </div>

    <PermissionModal />
  </div>
        </>
      )}
    </div>
  );
}
