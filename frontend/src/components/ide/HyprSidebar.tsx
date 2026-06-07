'use client';

import React from 'react';

export default function HyprSidebar() {
  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 font-mono text-xs text-white/40 tracking-widest uppercase">
        Project Tree
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="flex items-center gap-2 text-sm text-white/80 py-1.5 px-2 hover:bg-white/5 rounded-md cursor-pointer transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="m22 13-10 5-10-5"/><path d="m22 17-10 5-10-5"/><path d="M12 2L2 7l10 5 10-5-10-5Z"/></svg>
          src/
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80 py-1.5 px-2 hover:bg-white/5 rounded-md cursor-pointer transition-colors ml-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          app.tsx
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80 py-1.5 px-2 hover:bg-white/5 rounded-md cursor-pointer transition-colors ml-4 bg-white/10 text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          page.tsx
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80 py-1.5 px-2 hover:bg-white/5 rounded-md cursor-pointer transition-colors ml-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          globals.css
        </div>
        
        <div className="mt-6">
          <button className="hypr-btn w-full py-2 px-4 text-xs font-mono text-white/80 hover:text-white flex items-center justify-center gap-2 shadow-lg shadow-black/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New File
          </button>
        </div>
      </div>
    </div>
  );
}
