'use client';

import React from 'react';

export default function FloatingSidebar() {
  return (
    <aside className="w-64 glass-panel border-r border-white/10 p-4 flex flex-col gap-4 relative z-10 m-4 shadow-2xl transition-all duration-300 hover:shadow-primary/20">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-widest text-primary uppercase">Explorer</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-white/10 rounded-lg">
          No folder open
        </div>
        <button className="w-full mt-4 py-2 px-4 bg-primary/20 text-primary hover:bg-primary/40 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-95">
          Open Folder
        </button>
      </div>
    </aside>
  );
}
