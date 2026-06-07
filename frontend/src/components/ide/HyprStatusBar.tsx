'use client';

import React from 'react';

export default function HyprStatusBar() {
  return (
    <div className="hypr-panel h-8 w-full px-3 flex items-center justify-between text-[11px] font-mono select-none" style={{ background: 'linear-gradient(90deg, rgba(14,165,233,0.1) 0%, rgba(99,102,241,0.1) 100%)', borderColor: 'rgba(56,189,248,0.2)' }}>
      {/* Left side */}
      <div className="flex items-center h-full gap-4 text-white/80">
        <div className="flex items-center gap-1.5 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
          main*
        </div>
        <div className="flex items-center gap-1.5 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Launchpad
        </div>
        <div className="flex items-center gap-1.5 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-red-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          0
        </div>
        <div className="flex items-center gap-1.5 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-yellow-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          0
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center h-full gap-4 text-white/70">
        <div className="flex items-center gap-2 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></span>
          Credits: 1,000
        </div>
        <div className="flex items-center gap-2 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_5px_#eab308]"></span>
          Gemini Flash: 20%
        </div>
        <div className="flex items-center gap-2 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_5px_#fb923c]"></span>
          Gemini Pro: 20%
        </div>
        <div className="flex items-center gap-2 hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_5px_#2dd4bf]"></span>
          Claude: 40%
        </div>
        <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          Mirai - Settings
        </div>
        <div className="hover:text-white hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
      </div>
    </div>
  );
}
