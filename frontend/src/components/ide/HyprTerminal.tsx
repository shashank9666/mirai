'use client';

import React from 'react';

export default function HyprTerminal() {
  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden relative group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/0 via-purple-500/50 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col gap-1">
        <div className="text-white/40">Mirai Agent Terminal v2.0</div>
        <div className="flex gap-2">
          <span className="text-green-400">➜</span>
          <span className="text-blue-400">~/workspace</span>
          <span className="text-white/90">npm run dev</span>
        </div>
        <div className="text-white/60">  ▲ Next.js 15.0.0</div>
        <div className="text-white/60">  - Local:        http://localhost:3000</div>
        <div className="text-white/60">  - Environments: .env</div>
        <div className="text-green-400 mt-2">✓ Compiled /page in 1254ms (512 modules)</div>
        <div className="flex gap-2 mt-2">
          <span className="text-green-400">➜</span>
          <span className="text-blue-400">~/workspace</span>
          <span className="text-white/90 animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
}
