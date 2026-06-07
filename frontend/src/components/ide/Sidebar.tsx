'use client';

import React from 'react';

export default function Sidebar() {
  return (
    <div className="w-[250px] h-full flex flex-col border-r border-[var(--color-border)]" style={{ backgroundColor: 'var(--color-sidebar)' }}>
      <div className="px-5 py-3 text-[11px] tracking-widest font-medium uppercase text-[var(--color-text-normal)]">
        Explorer
      </div>
      
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Placeholder file tree */}
        <div className="py-2 text-center text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-light)] rounded mx-2 mt-2">
          No Folder Opened
        </div>
        
        <div className="mt-4 px-2">
          <button className="w-full py-1.5 px-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs rounded transition-colors">
            Open Folder
          </button>
        </div>
      </div>
    </div>
  );
}
