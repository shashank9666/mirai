import React from 'react';
import { FolderSearch, MessageSquare, Settings, Terminal, Code, History, Search } from 'lucide-react';
import { useWindowManagerStore } from '@/store/useWindowManagerStore';

export default function ActivityBar() {
  const { spawnWindow } = useWindowManagerStore();

  return (
    <div className="w-12 h-full bg-activitybar border-r border-border flex flex-col items-center py-4 z-40 shrink-0">
      <div className="flex flex-col items-center gap-4 w-full">

        <button 
          onClick={() => { console.log('Button clicked: Explorer'); spawnWindow('explorer', 'Explorer'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Explorer"
        >
          <FolderSearch size={20} className="text-muted-foreground group-hover:text-foreground" />
        </button>

        <button 
          onClick={() => { console.log('Button clicked: Search'); spawnWindow('search', 'Search'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Search"
        >
          <Search size={20} className="text-muted-foreground group-hover:text-foreground" />
        </button>

        <button 
          onClick={() => { console.log('Button clicked: Code Editor'); spawnWindow('editor', 'Code Editor'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Code Editor"
        >
          <Code size={20} className="text-muted-foreground group-hover:text-foreground" />
        </button>
        
        <button 
          onClick={() => { console.log('Button clicked: Mirai AI'); spawnWindow('chat', 'Mirai AI'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="AI Chat"
        >
          <MessageSquare size={20} className="text-muted-foreground group-hover:text-foreground" />
        </button>

        <button 
          onClick={() => { console.log('Button clicked: Model Cookbook'); spawnWindow('cookbook', 'Model Cookbook'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Model Cookbook"
        >
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
          </div>
        </button>

        <button 
          onClick={() => { console.log('Button clicked: Compare Models'); spawnWindow('compare', 'Compare Models'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Compare Models"
        >
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground"><path d="M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.172-2.828l-5.657-5.657A4 4 0 0 1 4 2.343V2M12 22v-8.3a4 4 0 0 1 1.172-2.828l5.657-5.657A4 4 0 0 0 20 2.343V2"/></svg>
          </div>
        </button>

        <button 
          onClick={() => { console.log('Button clicked: Terminal'); spawnWindow('terminal', 'Terminal'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Terminal"
        >
          <Terminal size={20} className="text-muted-foreground group-hover:text-foreground" />
        </button>

        <button 
          onClick={() => { console.log('Button clicked: Chat History'); spawnWindow('history', 'Chat History'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Chat History"
        >
          <div className="relative">
            <History size={18} className="text-muted-foreground group-hover:text-foreground" />
          </div>
        </button>

      </div>
      
      <div className="mt-auto mb-2 flex flex-col items-center gap-4 w-full">
        <button 
          onClick={() => { console.log('Button clicked: Settings'); spawnWindow('settings', 'Settings'); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors tooltip-trigger group"
          title="Settings"
        >
          <Settings size={20} className="text-muted-foreground group-hover:text-foreground" />
        </button>
      </div>
    </div>
  );
}
