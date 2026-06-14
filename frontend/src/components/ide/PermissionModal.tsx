import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';

interface ApprovalRequest {
  id: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  oldContent?: string;
  newContent?: string;
  status: string;
  timestamp: number;
}

export default function PermissionModal() {
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);

  useEffect(() => {
    // Poll for pending approvals every 1.5s
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/approvals/pending');
        if (res.ok) {
          const data = await res.json();
          setPendingApproval(data.pending || null);
        }
      } catch {
        // Silent fail
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleReply = async (approved: boolean) => {
    if (!pendingApproval) return;
    try {
      await fetch('http://127.0.0.1:8000/api/approvals/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingApproval.id, approved }),
      });
      setPendingApproval(null);
    } catch (err) {
      console.error('Failed to reply to approval', err);
    }
  };

  if (!pendingApproval) return null;

  // Render the command or tool arguments
  const commandText = String(pendingApproval.arguments?.CommandLine || pendingApproval.arguments?.command || JSON.stringify(pendingApproval.arguments, null, 2) || '');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="absolute bottom-4 left-4 right-4 z-[100] bg-[#1E1E1E] border border-white/10 rounded-xl shadow-2xl p-4 font-sans text-white/90"
      >
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-sm">Allow running this tool?</span>
          <span className="ml-auto text-xs text-white/40">{pendingApproval.toolName}</span>
        </div>

        <div className="bg-[#151515] p-3 rounded-lg border border-white/5 font-mono text-[11px] text-white/80 whitespace-pre-wrap break-all max-h-32 overflow-y-auto mb-4">
          {commandText}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleReply(true)}
            className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-emerald-500/20 text-white hover:text-emerald-300 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30 text-xs font-medium"
          >
            <span><span className="opacity-50 font-mono mr-2">1</span> Yes, allow this time</span>
          </button>
          <button
            onClick={() => handleReply(false)}
            className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-red-500/20 text-white hover:text-red-300 rounded-lg transition-colors border border-transparent hover:border-red-500/30 text-xs font-medium"
          >
            <span><span className="opacity-50 font-mono mr-2">2</span> No (reject)</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-white/5">
          <button
            onClick={() => setPendingApproval(null)}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => handleReply(true)}
            className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Submit
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
