'use client';

import React from 'react';

export default function Waybar() {
  return (
    <div className="hypr-panel h-10 w-full px-4 flex items-center justify-between text-xs font-mono select-none">
      {/* Left: Workspaces */}
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white">1</div>
        <div className="w-6 h-6 rounded-full bg-transparent hover:bg-white/10 flex items-center justify-center text-white/50 cursor-pointer transition-colors">2</div>
        <div className="w-6 h-6 rounded-full bg-transparent hover:bg-white/10 flex items-center justify-center text-white/50 cursor-pointer transition-colors">3</div>
      </div>

      {/* Center: Window Title */}
      <div className="text-white/80 font-semibold tracking-wide hidden md:block">
        Mirai Workspace ~ /codes/mirai/frontend
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-4 text-white/60">
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="m9 18 3-3-3-3"/></svg>
          main
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4l3-9 5 18 3-9h5"/></svg>
          CPU 12%
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
          RAM 3.2G
        </div>
      </div>
    </div>
  );
}
