'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useHistoryStore } from '@/store/useHistoryStore';
import { Terminal, Trash2, RefreshCw, Clock, PlayCircle, AlertCircle, CheckCircle, Ban, History as HistoryIcon, FileEdit, FilePlus, FileX, FileInput, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Task {
  id: string;
  command: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startedAt: string;
  logs: string;
}

const changeIcons: Record<string, React.ReactNode> = {
  writeFile: <FilePlus size={14} className="text-emerald-400 shrink-0" />,
  replaceInFile: <FileEdit size={14} className="text-blue-400 shrink-0" />,
  deleteItem: <FileX size={14} className="text-red-400 shrink-0" />,
  renameItem: <FileInput size={14} className="text-yellow-400 shrink-0" />,
};

function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const list = await api.listTasks();
      setTasks(list as Task[]);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTasks();
    const interval = setInterval(fetchTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleKill = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to stop this task?')) {
      try {
        await api.killTask(id);
        await fetchTasks();
      } catch {
        alert('Failed to kill task');
      }
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'running':
        return <PlayCircle className="text-blue-400 animate-pulse" size={16} />;
      case 'completed':
        return <CheckCircle className="text-emerald-400" size={16} />;
      case 'failed':
        return <AlertCircle className="text-red-400" size={16} />;
      case 'killed':
        return <Ban className="text-gray-400" size={16} />;
    }
  };

  const getStatusClass = (status: Task['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'killed':
        return 'bg-white/5 text-gray-400 border border-white/10';
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <RefreshCw className="animate-spin text-mirai-accent mr-2" size={18} />
        Loading tasks...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-8 gap-3">
        <Terminal size={32} className="opacity-20" />
        <p className="text-sm">No background tasks</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
      <AnimatePresence>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
            className="bg-card border border-border/50 hover:border-border/80 transition-colors rounded-lg p-3 cursor-pointer flex flex-col gap-2 select-none"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                <span className="font-mono text-xs font-semibold truncate text-foreground/90">{task.command}</span>
                <span className="text-[10px] text-muted-foreground truncate">{task.cwd}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full flex items-center gap-1 ${getStatusClass(task.status)}`}>
                  {getStatusIcon(task.status)}
                  {task.status}
                </span>
                {task.status === 'running' && (
                  <button
                    onClick={(e) => handleKill(task.id, e)}
                    className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/20"
                    title="Kill Task"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {new Date(task.startedAt).toLocaleTimeString()}
              </span>
            </div>

            {expandedTaskId === task.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-[11px] text-white/70 max-h-40 overflow-y-auto custom-scrollbar select-text whitespace-pre-wrap break-all mt-1">
                  {task.logs ? task.logs : '[No logs available]'}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function HistoryView() {
  const { sessions, currentSessionId, setCurrentSession, setSessionTitle } = useHistoryStore();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2">
        <HistoryIcon size={32} className="opacity-20 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No history yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={`rounded-lg border transition-colors ${
            currentSessionId === session.id
              ? 'border-mirai-accent/40 bg-mirai-accent/5'
              : 'border-border/50 hover:border-border bg-card/30'
          }`}
        >
          <div
            onClick={() => {
              if (expandedSessionId === session.id) {
                setExpandedSessionId(null);
              } else {
                setExpandedSessionId(session.id);
                setCurrentSession(session.id);
              }
            }}
            className="flex items-start gap-2 p-2 cursor-pointer"
          >
            <div className="mt-0.5 shrink-0">
              {expandedSessionId === session.id
                ? <ChevronDown size={13} className="text-muted-foreground" />
                : <ChevronRight size={13} className="text-muted-foreground" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {editingTitle === session.id ? (
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onBlur={() => {
                      if (newTitle.trim()) setSessionTitle(newTitle.trim());
                      setEditingTitle(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (newTitle.trim()) setSessionTitle(newTitle.trim());
                        setEditingTitle(null);
                      }
                    }}
                    className="text-[11px] font-semibold bg-black/20 rounded px-1 py-0.5 w-full outline-none border border-mirai-accent/50"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="text-[11px] font-semibold truncate flex-1 cursor-pointer hover:text-foreground text-foreground/80"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTitle(session.id);
                      setNewTitle(session.title);
                    }}
                  >
                    {session.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {session.fileChanges.length} changes
                </span>
              </div>
            </div>
          </div>

          {expandedSessionId === session.id && (
            <div className="pb-2 px-2 space-y-0.5 border-t border-border/30 pt-1 mt-0">
              {session.fileChanges.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60 px-2 py-1">No file changes</p>
              ) : (
                session.fileChanges.map((change) => (
                  <div key={change.id} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/50 text-[11px]">
                    {changeIcons[change.type] || <FileEdit size={12} className="text-muted-foreground shrink-0" />}
                    <span className="truncate text-muted-foreground flex-1">{change.filePath}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {new Date(change.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HistoryTasksPanel() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'history'>('tasks');
  const { startNewSession, clearHistory } = useHistoryStore();

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Header with tabs */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
              activeTab === 'tasks'
                ? 'text-foreground bg-muted'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Terminal size={13} />
              Tasks
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
              activeTab === 'history'
                ? 'text-foreground bg-muted'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <HistoryIcon size={13} />
              History
            </span>
          </button>
        </div>
        {activeTab === 'history' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => startNewSession()}
              className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors text-[10px] font-semibold"
              title="New Session"
            >
              + New
            </button>
            <button
              onClick={clearHistory}
              className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-red-400 transition-colors"
              title="Clear All"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
        {activeTab === 'tasks' && (
          <button
            title="Refresh"
            className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Split panel: tasks on top, history on bottom */}
      <div className="flex-1 flex flex-col overflow-hidden divide-y divide-border/50">
        <div className="flex flex-col overflow-hidden min-h-0" style={{ flex: activeTab === 'tasks' ? 1 : 0.4 }}>
          {activeTab === 'history' && (
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Background Tasks</div>
          )}
          <TasksView />
        </div>
        <div className="flex flex-col overflow-hidden min-h-0" style={{ flex: activeTab === 'history' ? 1 : 0.4 }}>
          {activeTab === 'tasks' && (
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Session History</div>
          )}
          <HistoryView />
        </div>
      </div>
    </div>
  );
}
