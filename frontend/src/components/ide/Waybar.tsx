'use client';

import React from 'react';
import { useIdeStore } from '@/store/ideStore';
import { LayoutGrid, Search, Bell, Settings, User } from 'lucide-react';

export default function Waybar() {
  const { activeFile } = useIdeStore();

  const truncatePath = (path: string | null) => {
    if (!path) return 'Mirai Workspace ~ No File Open';
    return `Mirai Workspace ~ ${path.replace('c:\\Users\\shett\\Desktop\\Mirai', '')}`;
  };

  const [counter, setCounter] = React.useState(0);

  return (
    <div className="hypr-panel h-10 w-full px-4 flex items-center justify-between text-xs font-mono select-none" style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.1) 0%, rgba(59,130,246,0.1) 100%)', borderColor: 'rgba(124,58,237,0.2)' }}>
      {/* Left side */}
      <div className="flex items-center h-full gap-4 text-white/80">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[var(--color-primary-accent)] to-[var(--color-secondary-accent)] flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)]">
            <span className="text-white font-bold text-[10px]">M</span>
          </div>
          <span className="font-bold tracking-wider">MIRAI</span>
          <button 
            onClick={() => setCounter(c => c + 1)}
            className="ml-4 px-2 py-1 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/50 rounded transition-colors text-white"
          >
            Test UI: {counter}
          </button>
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 flex justify-center items-center">
        <span className="text-white/60 tracking-widest uppercase truncate max-w-xl">
          {truncatePath(activeFile)}
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center h-full gap-4 text-white/70">
        <div className="flex items-center gap-2 hover:text-white hover:bg-white/10 px-2 py-1 rounded cursor-pointer transition-colors border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span>
          GPT-5.5
        </div>
        <Search className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
        <Bell className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
        <Settings className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
        <User className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
      </div>
    </div>
  );
}
