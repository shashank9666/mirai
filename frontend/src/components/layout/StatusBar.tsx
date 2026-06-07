'use client';

import React, { useEffect, useState, useRef } from 'react';
import { GitBranch, XCircle, AlertTriangle, CheckCheck, MessageSquare } from 'lucide-react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useChatStore } from '@/store/useChatStore';
import { api } from '@/lib/api';
import { countMessagesTokens, getContextWindow, formatTokenCount } from '@/lib/stats';

export default function StatusBar() {
  const { editorGroups, activeGroupId, workspacePath } = useWorkspaceStore();
  const { aiProvider, providerConfigs } = useSettingsStore();
  const sessions = useChatStore(s => s.sessions);
  const activeChatId = useChatStore(s => s.activeChatId);
  const messages = sessions.find(s => s.id === activeChatId)?.messages || [];

  const [gitBranch, setGitBranch] = useState<string>('main');
  const [gitDirty, setGitDirty] = useState(false);
  const [eslintErrors, setEslintErrors] = useState(0);
  const [eslintWarnings, setEslintWarnings] = useState(0);

  const activeGroup = editorGroups.find(g => g.id === activeGroupId) || editorGroups[0];
  const activeFile = activeGroup && activeGroup.activeFileIndex >= 0 ? activeGroup.openFiles[activeGroup.activeFileIndex] : null;

  const model = providerConfigs[aiProvider]?.model || '';
  const contextWindow = getContextWindow(model);
  const tokenCount = countMessagesTokens(messages);

  // Poll git branch
  useEffect(() => {
    const fetchGit = async () => {
      if (!workspacePath) { setGitBranch('no repo'); return; }
      try {
        const result = await api.getGitBranch(workspacePath);
        if (result.branch) {
          setGitBranch(result.branch);
          setGitDirty(result.dirty);
        } else {
          setGitBranch('no repo');
        }
      } catch { setGitBranch('no repo'); }
    };
    fetchGit();
    const interval = setInterval(fetchGit, 10000);
    return () => clearInterval(interval);
  }, [workspacePath]);

  // Poll eslint periodically (debounced)
  const eslintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const runEslint = async () => {
      if (!workspacePath) return;
      try {
        const result = await api.getEslintResults(workspacePath);
        setEslintErrors(result.errors);
        setEslintWarnings(result.warnings);
      } catch {}
    };
    // Debounce: run 2s after last file change
    const debounced = () => {
      clearTimeout(eslintTimerRef.current);
      eslintTimerRef.current = setTimeout(runEslint, 2000);
    };
    debounced();
    const interval = setInterval(runEslint, 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(eslintTimerRef.current);
    };
  }, [workspacePath, editorGroups]);

  return (
    <div className="w-full h-7 bg-activitybar border-t border-border flex items-center justify-between px-2 text-[11px] text-muted-foreground shrink-0 z-40">
      <div className="flex items-center h-full gap-1">
        <div className="flex items-center gap-1 hover:bg-muted px-2 h-full rounded transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
          <GitBranch size={13} />
          <span>{gitBranch}{gitDirty ? ' *' : ''}</span>
        </div>
        
        <div className="flex items-center gap-1.5 hover:bg-muted px-2 h-full rounded transition-colors cursor-pointer">
          <div className="flex items-center gap-1"><XCircle size={11} className="text-red-400" /> {eslintErrors}</div>
          <div className="flex items-center gap-1"><AlertTriangle size={11} className="text-yellow-400" /> {eslintWarnings}</div>
        </div>
      </div>

      <div className="flex items-center h-full gap-1">
        <div className="hover:bg-muted px-2 h-full flex items-center rounded transition-colors cursor-pointer text-muted-foreground">
          <MessageSquare size={11} className="mr-1" />
          {formatTokenCount(tokenCount)} / {formatTokenCount(contextWindow)}
        </div>

        {activeFile && (
          <>
            <div className="hover:bg-muted px-2 h-full flex items-center rounded transition-colors cursor-pointer text-muted-foreground">
              Ln {activeFile.cursorPosition?.line || 1}, Col {activeFile.cursorPosition?.column || 1}
            </div>
            <div className="hover:bg-muted px-2 h-full flex items-center rounded transition-colors cursor-pointer uppercase text-muted-foreground">
              {activeFile.language}
            </div>
          </>
        )}

        <div className="flex items-center gap-1 hover:bg-muted px-2 h-full rounded transition-colors cursor-pointer text-primary font-medium">
          <CheckCheck size={13} />
          <span>{aiProvider}</span>
        </div>
      </div>
    </div>
  );
}
