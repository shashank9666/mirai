'use client';

import React, { useState, useEffect } from 'react';
import { useIdeStore } from '@/store/ideStore';
import { api } from '@/lib/api';

export default function HyprStatusBar() {
  const { activeGroupId, getActiveGroup, editorSettings, groups } = useIdeStore();
  const group = getActiveGroup();
  const activeFile = group?.activeFile || null;
  const activeFileContent = group?.activeFileContent || '';
  const tabs = group?.tabs || [];
  const dirtyCount = tabs.filter(t => t.dirty).length;

  const linesOfCode = activeFileContent ? activeFileContent.split('\n').length : 0;
  const [gitInfo, setGitInfo] = useState<{ branch: string | null; dirty: boolean }>({ branch: null, dirty: false });

  useEffect(() => {
    api.gitBranch().then(setGitInfo).catch(() => {});
  }, []);

  const fileName = activeFile ? activeFile.split(/[\\/]/).pop() : '';
  const ext = fileName ? '.' + fileName.split('.').pop() : '';

  return (
    <div className="hypr-panel h-8 w-full px-3 flex items-center justify-between text-[11px] font-mono select-none" style={{ background: 'var(--panel-bg, linear-gradient(90deg, rgba(14,165,233,0.1) 0%, rgba(99,102,241,0.1) 100%))', backdropFilter: 'var(--panel-backdrop, blur(16px))', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center h-full gap-3 text-white/80">
        {gitInfo.branch && (
          <div className="flex items-center gap-1.5 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
            {gitInfo.branch}{gitInfo.dirty ? '*' : ''}
          </div>
        )}
        {ext && (
          <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-white/50">
            {ext}
          </div>
        )}
        <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-blue-300">
          Ln {linesOfCode}
        </div>
        <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-white/40">
          Spaces: {editorSettings.tabSize}
        </div>
        <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-white/40">
          UTF-8
        </div>
        {editorSettings.wordWrap === 'on' && (
          <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-white/40">
            Wrap
          </div>
        )}
        {dirtyCount > 0 && (
          <div className="flex items-center gap-1.5 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-orange-400">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            {dirtyCount} unsaved
          </div>
        )}
        {groups.length > 1 && (
          <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-purple-400">
            {groups.length} groups
          </div>
        )}
      </div>

      <div className="flex items-center h-full gap-3 text-white/70">


      </div>
    </div>
  );
}
