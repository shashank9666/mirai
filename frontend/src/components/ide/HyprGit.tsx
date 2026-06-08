'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, RefreshCw, Send, Plus, ArrowUp, ArrowDown, Download, Upload, GitCommit } from 'lucide-react';
import { api } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  M: 'bg-amber-400 text-black',
  A: 'bg-emerald-400 text-black',
  D: 'bg-red-400 text-black',
  '?': 'bg-white/20 text-white/60',
  R: 'bg-blue-400 text-black',
  C: 'bg-purple-400 text-black',
};

function getStatusColor(status: string) {
  const key = status.trim()[0];
  return STATUS_COLORS[key] || 'bg-white/10 text-white/50';
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    M: 'Modified',
    A: 'Added',
    D: 'Deleted',
    '??': 'Untracked',
    R: 'Renamed',
    C: 'Copied',
    MM: 'Modified',
    AM: 'Added',
    RM: 'Renamed',
    CM: 'Copied',
  };
  return map[status.trim()] || status.trim();
}

interface ChangedFile { status: string; path: string }

export default function HyprGit() {
  const [branchInfo, setBranchInfo] = useState<{ branch: string | null; dirty: boolean }>({ branch: null, dirty: false });
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [commits, setCommits] = useState<{ sha: string; message: string }[]>([]);
  const [diff, setDiff] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [branchRes, statusRes, logRes, branchesRes] = await Promise.allSettled([
        api.gitBranch(),
        api.gitStatus(),
        api.gitLog(),
        api.gitBranches(),
      ]);

      if (branchRes.status === 'fulfilled') {
        setBranchInfo({ branch: branchRes.value.branch, dirty: branchRes.value.dirty });
      }
      if (statusRes.status === 'fulfilled') {
        setChangedFiles(statusRes.value.files || []);
      }
      if (logRes.status === 'fulfilled') {
        setCommits(logRes.value.commits || []);
      }
      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.branches || []);
      }
    } catch {
      setChangedFiles([]);
      setBranches([]);
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setActionLoading(true);
    try {
      await api.gitAdd('.');
      const res = await api.gitCommit(commitMsg);
      setMessage(res.output);
      setCommitMsg('');
      fetchAll();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePush = async () => {
    setActionLoading(true);
    try {
      const res = await api.gitPush();
      setMessage(res.output);
      fetchAll();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePull = async () => {
    setActionLoading(true);
    try {
      const res = await api.gitPull();
      setMessage(res.output);
      fetchAll();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStash = async () => {
    setActionLoading(true);
    try {
      const res = await api.gitStash();
      setMessage(res.output);
      fetchAll();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStashPop = async () => {
    setActionLoading(true);
    try {
      const res = await api.gitStashPop();
      setMessage(res.output);
      fetchAll();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNewBranch = async () => {
    if (!newBranchName.trim()) return;
    setActionLoading(true);
    try {
      const res = await api.gitNewBranch(newBranchName.trim());
      setMessage(res.output);
      setNewBranchName('');
      setShowNewBranch(false);
      fetchAll();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async (branch: string) => {
    setActionLoading(true);
    try {
      const res = await api.gitCheckout(branch);
      setMessage(res.output);
      fetchAll();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const loadDiff = async () => {
    setDiffLoading(true);
    try {
      const res = await api.gitDiff();
      setDiff(res.diff || 'No changes');
    } catch (e: any) {
      setDiff(`Error: ${e.message}`);
    } finally {
      setDiffLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0 flex items-center justify-between">
        <span>Source Control</span>
        <button onClick={fetchAll} className="text-white/30 hover:text-white/70 transition-colors" title="Refresh">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {/* Branch info + actions */}
        <div className="px-4 py-3 border-b border-white/5 shrink-0">
          {branchInfo.branch ? (
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-[var(--color-primary-accent)]" />
              <span className="text-[12px] font-mono text-white/70">{branchInfo.branch}</span>
              <span className={`ml-auto w-2 h-2 rounded-full ${branchInfo.dirty ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            </div>
          ) : (
            <div className="text-[12px] font-mono text-white/30">Not a git repository</div>
          )}
          <div className="flex gap-1.5 mt-2">
            <button onClick={handlePush} disabled={actionLoading || !branchInfo.branch} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] font-mono text-white/50 hover:bg-white/10 transition-colors disabled:opacity-30">
              <ArrowUp className="w-3 h-3" /> Push
            </button>
            <button onClick={handlePull} disabled={actionLoading || !branchInfo.branch} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] font-mono text-white/50 hover:bg-white/10 transition-colors disabled:opacity-30">
              <ArrowDown className="w-3 h-3" /> Pull
            </button>
            <button onClick={handleStash} disabled={actionLoading || !branchInfo.branch} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] font-mono text-white/50 hover:bg-white/10 transition-colors disabled:opacity-30">
              <Download className="w-3 h-3" /> Stash
            </button>
            <button onClick={handleStashPop} disabled={actionLoading || !branchInfo.branch} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] font-mono text-white/50 hover:bg-white/10 transition-colors disabled:opacity-30">
              <Upload className="w-3 h-3" /> Pop
            </button>
          </div>
        </div>

        {/* Commit input */}
        <div className="px-3 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
              placeholder="Commit message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-mono outline-none focus:border-[var(--color-primary-accent)] placeholder:text-white/20"
            />
            <button
              onClick={handleCommit}
              disabled={!commitMsg.trim() || actionLoading}
              className="px-3 py-1.5 bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] rounded-lg hover:bg-[var(--color-primary-accent)]/30 transition-colors text-[11px] font-mono disabled:opacity-30 flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" /> Commit
            </button>
          </div>
          {message && (
            <div className="mt-2 px-2 py-1.5 bg-white/5 rounded text-[10px] font-mono text-white/40 max-h-16 overflow-y-auto custom-scrollbar">
              {message}
            </div>
          )}
        </div>

        {/* Changes */}
        <div className="border-b border-white/5">
          <div className="px-4 py-2 flex items-center gap-2 text-[10px] font-mono text-white/40 tracking-widest uppercase">
            <span>Changes</span>
            <span className="text-white/20">({changedFiles.length})</span>
          </div>
          <div className="px-4 pb-3">
            {loading ? (
              <div className="text-[11px] font-mono text-white/20 italic">Loading...</div>
            ) : changedFiles.length === 0 ? (
              <div className="text-[11px] font-mono text-white/20 italic">No changes</div>
            ) : (
              <div className="space-y-0.5">
                {changedFiles.map((file, idx) => (
                  <div key={`${file.path}-${idx}`} className="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-white/5 transition-colors group">
                    <span className={`text-[9px] font-mono font-bold px-1 rounded min-w-[18px] text-center ${getStatusColor(file.status)}`}>
                      {file.status.trim()[0]}
                    </span>
                    <span className="text-[11px] font-mono text-white/55 truncate">{file.path}</span>
                    <span className="ml-auto text-[9px] font-mono text-white/25 opacity-0 group-hover:opacity-100 transition-opacity">
                      {getStatusLabel(file.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Diff */}
        <div className="border-b border-white/5">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Diff</span>
            <button onClick={loadDiff} disabled={diffLoading} className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors">
              {diffLoading ? 'Loading...' : 'Load Diff'}
            </button>
          </div>
          {diff && (
            <div className="px-4 pb-3 max-h-40 overflow-y-auto custom-scrollbar">
              <pre className="text-[10px] font-mono text-white/40 whitespace-pre-wrap">{diff}</pre>
            </div>
          )}
        </div>

        {/* Branches */}
        <div className="border-b border-white/5">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Branches</span>
            <button onClick={() => setShowNewBranch(!showNewBranch)} className="text-white/30 hover:text-white/60 transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          {showNewBranch && (
            <div className="px-3 pb-2 flex gap-1.5">
              <input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNewBranch()}
                placeholder="Branch name..."
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white outline-none focus:border-[var(--color-primary-accent)] placeholder:text-white/20"
                autoFocus
              />
              <button onClick={handleNewBranch} disabled={!newBranchName.trim() || actionLoading} className="px-2 py-1 bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] rounded text-[10px] font-mono disabled:opacity-30">
                Create
              </button>
            </div>
          )}
          <div className="px-4 pb-3">
            {loading ? (
              <div className="text-[11px] font-mono text-white/20 italic">Loading...</div>
            ) : branches.length === 0 ? (
              <div className="text-[11px] font-mono text-white/20 italic">No branches</div>
            ) : (
              <div className="space-y-0.5">
                {branches.map((branch, idx) => {
                  const isCurrent = branchInfo.branch === branch;
                  return (
                    <button
                      key={`${branch}-${idx}`}
                      onClick={() => !isCurrent && handleCheckout(branch)}
                      disabled={isCurrent || actionLoading}
                      className={`w-full flex items-center gap-2 py-0.5 px-2 rounded transition-colors text-left ${
                        isCurrent ? 'bg-[var(--color-primary-accent)]/10 text-[var(--color-primary-accent)]' : 'text-white/50 hover:bg-white/5'
                      }`}
                    >
                      <GitBranch className="w-3 h-3 shrink-0" />
                      <span className="text-[11px] font-mono truncate">{branch}</span>
                      {isCurrent && <span className="ml-auto text-[9px] font-mono text-[var(--color-primary-accent)]/60 uppercase">current</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Log */}
        <div>
          <div className="px-4 py-2 flex items-center gap-2 text-[10px] font-mono text-white/40 tracking-widest uppercase">
            <span>Log</span>
            <span className="text-white/20">({commits.length})</span>
          </div>
          <div className="px-4 pb-3">
            {loading ? (
              <div className="text-[11px] font-mono text-white/20 italic">Loading...</div>
            ) : commits.length === 0 ? (
              <div className="text-[11px] font-mono text-white/20 italic">No history</div>
            ) : (
              <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {commits.map((c, idx) => (
                  <div key={`${c.sha}-${idx}`} className="flex items-start gap-2 py-0.5 px-2 rounded hover:bg-white/5 transition-colors">
                    <span className="text-[11px] font-mono text-[var(--color-primary-accent)]/70 shrink-0 tabular-nums">{c.sha}</span>
                    <span className="text-[11px] font-mono text-white/55 truncate" title={c.message}>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
