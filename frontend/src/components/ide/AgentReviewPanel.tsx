'use client';

import { Check, FileCode, GitCompareArrows, ShieldCheck, X } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

export default function AgentReviewPanel() {
  const { pendingChanges, openDiffForReview, acceptChange, rejectChange, clearPendingChanges } = useEditorStore();
  const changes = pendingChanges
    .filter((change) => change.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt);

  if (changes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-white/80">No pending file changes</div>
          <div className="mt-1 text-[11px] font-mono leading-relaxed text-white/35">
            Agent edits will wait here until you review and approve them.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-3.5 w-3.5 text-emerald-300" />
          <span className="text-[11px] font-mono font-semibold text-white/75">
            {changes.length} pending change{changes.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          onClick={clearPendingChanges}
          className="rounded-md px-2 py-1 text-[10px] font-mono text-white/35 transition-colors hover:bg-white/5 hover:text-red-300"
        >
          Clear
        </button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-2">
          {changes.map((change) => (
            <div key={change.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-2">
              <button
                type="button"
                onClick={() => openDiffForReview(change.id)}
                className="flex w-full items-center gap-2 text-left"
              >
                <FileCode className="h-4 w-4 shrink-0 text-blue-300/80" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-mono font-semibold text-white/80">{change.fileName}</div>
                  <div className="truncate text-[10px] font-mono text-white/30">{change.filePath}</div>
                </div>
                <GitCompareArrows className="h-3.5 w-3.5 shrink-0 text-white/35" />
              </button>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDiffForReview(change.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-blue-400/20 bg-blue-500/10 px-2 py-1.5 text-[10px] font-mono text-blue-300 transition-colors hover:bg-blue-500/20"
                >
                  <GitCompareArrows className="h-3 w-3" />
                  Review
                </button>
                <button
                  type="button"
                  onClick={() => rejectChange(change.id)}
                  className="grid h-7 w-8 place-items-center rounded-md border border-red-400/20 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
                  title="Reject"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { void acceptChange(change.id); }}
                  className="grid h-7 w-8 place-items-center rounded-md border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 transition-colors hover:bg-emerald-500/20"
                  title="Accept"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
