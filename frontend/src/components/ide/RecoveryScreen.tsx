'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function RecoveryScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0c] text-white/90 select-none">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500/80" />
        <div className="space-y-1 mt-1">
          <h1 className="text-sm font-semibold tracking-wider font-mono uppercase text-white/95">
            Connecting
          </h1>
          <p className="text-[11px] font-mono text-white/40 leading-relaxed">
            Mirai is connecting to the backend server...
          </p>
        </div>
      </div>
    </div>
  );
}
