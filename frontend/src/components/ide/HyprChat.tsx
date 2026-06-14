'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PanelHeader from './PanelHeader';
import TokenOptimizationTips from './TokenOptimizationTips';
import { useAiStore } from '@/store/aiStore';
import { useChatStore } from '@/store/chatStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useEditorStore } from '@/store/editorStore';

import { WifiOff, Mic, MicOff, Plus, ChevronRight, Paperclip, FileCode, X, Settings2, Trash2, MessageSquarePlus, GitCompareArrows, FilePlus2, Headphones, Check, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import SimpleBar from 'simplebar-react';
import { formatTokens } from '@/lib/agent/policies';
import AgentPreferencesPanel from './AgentPreferencesPanel';
import { DEFAULT_AGENT_PREFERENCES } from '@/lib/agent/policies';
import { useVoiceStore } from '@/store/voiceStore';
import VoiceOrb from './VoiceOrb';
import AgentReviewPanel from './AgentReviewPanel';
import PermissionModal from './PermissionModal';

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

For code tasks, behave like an IDE coding agent:
1. Inspect relevant files before proposing edits.
2. State a concise plan when the task spans multiple files.
3. Propose complete file changes through reviewable edits.
4. Do not claim files were changed unless a tool confirmed it or the user approved the pending change.
5. If approval is required, stop after proposing the change and wait for the user's review.

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
  const filepath = match && match[2] ? match[2] : '';

  return (
    <div className="my-2 border border-white/10 rounded-md bg-black/40 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-2">
        <ChevronRight className="w-4 h-4 text-white/50" />
        <FileCode className="w-3 h-3 text-blue-400" />
        <span className="text-[11px] font-mono text-white/80">Edited {lang.toUpperCase()} <span className="text-white font-semibold">{filepath}</span></span>
        <span className="text-[10px] font-mono text-emerald-400 ml-2">+{codeString.split('\n').filter(l => l.trim()).length}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); handleReviewChange(filepath, codeString); }}
        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-[10px] font-mono transition-colors border border-emerald-500/30"
      >
        <GitCompareArrows className="w-3 h-3" />
        Review
      </button>
    </div>
  );
}

function AgentSteps({ steps }: { steps?: import('@/store/chatStore').AgentStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-2 flex flex-col gap-3 px-1">
      {steps.map((step) => (
        <div key={step.id} className="flex flex-col gap-1">
          <div className="flex items-center text-[12px] font-mono tracking-wide text-white/80">
            <div className="flex items-center gap-2">
              <span className={step.status === 'running' ? 'text-blue-300' : step.status === 'waiting_approval' ? 'text-amber-300' : 'text-white/80'}>
                {step.title}
              </span>
            </div>
            {step.status === 'running' && <span className="ml-2 text-[10px] text-white/30 uppercase tracking-widest animate-pulse">Working...</span>}
            <ChevronRight className="w-3.5 h-3.5 text-white/30 ml-auto" />
          </div>
          {step.detail && typeof step.detail === 'string' && (
            <div className="text-[11px] font-mono text-white/40 truncate max-w-[90%] opacity-70">
              {step.detail}
            </div>
          )}
        </div>
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

export default function HyprChat({ isPinned, isMinimized, onPin, onMinimize, onClose, onDragStart }: ChatPanelProps) {
  const { activeAiProviderId, aiProviders, autoApproveSettings, setAutoApproveSettings } = useAiStore();
  const {
    messages: chatMessages,
    addMessage,
    updateMessage,
    clearMessages,
  } = useChatStore();
  const isPlaying = useVoiceStore(s => s.isPlaying);
  const hasPendingChanges = useEditorStore(state => state.pendingChanges.some(c => c.status === 'pending'));

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [showAgentPrefs, setShowAgentPrefs] = useState(false);

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
          const transcript = (await voiceSTT(blob)).trim();
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
      const sep = workspacePath.includes('\\') ? '\\' : '/';
      const absPath = filepath.startsWith('/') || filepath.match(/^[a-zA-Z]:[\\/]/) ? filepath : `${workspacePath}${sep}${filepath}`;

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
      const activeProvider = aiProviders.find(p => p.id === activeAiProviderId);
      const activeModelName = activeProvider?.model || 'gpt-4o';

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
                    voiceTTS(accumulatedContent).then((blob: Blob) => {
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
    clearMessages();
    const { pendingChanges, rejectChange } = useEditorStore.getState();
    pendingChanges.forEach(c => {
      if (c.status === 'pending') rejectChange(c.id);
    });
    setInput('');
    inputRef.current?.focus();
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

      <PanelHeader
        title="AI Assistant"
        isPinned={isPinned}
        isMinimized={isMinimized}
        onPin={onPin}
        onMinimize={onMinimize}
        onClose={onClose}
        onDragStart={onDragStart}
        accentColor="#7C3AED"
      >
        <div className="flex items-center gap-2 ml-auto">
          <div className={`w-1.5 h-1.5 rounded-full ${backendIndicator}`} title={backendAvailable ? 'Backend connected' : backendAvailable === null ? 'Checking...' : 'Backend offline'} />
          {isStreaming && (
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_#a855f7]" />
          )}
        </div>
      </PanelHeader>

      {!isMinimized && (
        <>
          {/* Agent Preferences Modal */}
          <AnimatePresence>
            {showAgentPrefs && (
              <motion.div
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-40 bg-[var(--panel-bg)] backdrop-blur-[var(--panel-backdrop,blur(16px))]"
              >
                <AgentPreferencesPanel
                  prefs={DEFAULT_AGENT_PREFERENCES}
                  onSave={(prefs) => {
                    console.log('Agent preferences saved:', prefs);
                    setShowAgentPrefs(false);
                  }}
                  onClose={() => setShowAgentPrefs(false)}
                  selectedModel={activeProvider?.model}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top Bar */}
          <div className="flex px-2 py-1.5 gap-1 border-b border-white/5 shrink-0 overflow-visible justify-between items-center relative z-20">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const newState = !isConvoMode;
                  setIsConvoMode(newState);
                  if (newState && !isListeningRef.current) toggleVoiceMode();
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-all ${isConvoMode ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
              >
                <Headphones className="w-3.5 h-3.5" />
                Convo Mode
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-all ${showSettingsMenu ? 'bg-[var(--color-primary-accent)]/20 text-purple-300' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Agent Settings
                </button>
                <AnimatePresence>
                  {showSettingsMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-[260px] bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl py-2 z-50 flex flex-col gap-1"
                    >
                      <div className="px-3 pb-2 border-b border-white/5 mb-1 text-[11px] font-semibold text-white/80 text-center">
                        Agent Settings
                      </div>
                      <button
                        onClick={() => { setShowSettingsMenu(false); setShowAgentPrefs(true); }}
                        className="w-full text-left px-3 py-1.5 text-[10px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        Agent Preferences
                      </button>
                      <div className="border-t border-white/5 my-1" />
                      <div className="px-3 pb-1 text-[11px] font-semibold text-white/60">
                        Auto-approve settings
                      </div>
                      {[
                        { id: 'readProjectFiles', label: 'Read project files' },
                        { id: 'readAllFiles', label: 'Read all files' },
                        { id: 'editProjectFiles', label: 'Edit project files' },
                        { id: 'executeSafeCommands', label: 'Execute safe commands' },
                        { id: 'executeAllCommands', label: 'Execute all commands' },
                        { id: 'useBrowser', label: 'Use the browser' },
                        { id: 'useMcpServers', label: 'Use MCP servers' }
                      ].map((setting) => (
                        <label key={setting.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 group">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 checked:bg-[var(--color-primary-accent)] checked:border-transparent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            checked={autoApproveSettings[setting.id as keyof typeof autoApproveSettings]}
                            onChange={(e) => setAutoApproveSettings({ [setting.id]: e.target.checked })}
                          />
                          <span className="text-[11px] font-mono text-white/60 group-hover:text-white/90 transition-colors">
                            {setting.label}
                          </span>
                        </label>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleClearChat}
                disabled={chatMessages.length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                title="Clear Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear              </button>

              <button
                onClick={handleNewChat}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono text-white/40 hover:text-green-400 hover:bg-green-500/10 transition-all"
                title="New Chat"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                New Chat              </button>
            </div>

          </div>

          

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
                  <div className="flex-1 flex items-center justify-center flex-col gap-2">
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">
                      {backendAvailable === false
                        ? 'Backend offline. Start the server to chat.'
                        : `Start a conversation...`}
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

  {/* Token Optimization Tips */ }
  <TokenOptimizationTips />

  {/* Input */ }
  <div className="p-2 border-t border-white/5 shrink-0 relative">
    <AnimatePresence>
      {showActionMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-2 mb-2 w-48 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-1 z-50"
        >
          <button onClick={handleAddActiveFile} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <FilePlus2 className="w-3.5 h-3.5 text-blue-400/70" /> Add Active File                  </button>
          <button onClick={handleUploadMedia} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors">
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
          <div className="w-2 h-2 bg-white rounded-[2px]" />
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

    <PermissionModal />
  </div>
        </>
      )
}
    </div >
  );
}
