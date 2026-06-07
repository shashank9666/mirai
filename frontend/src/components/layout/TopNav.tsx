import React from 'react';
import { ChevronDown, PanelLeft, PanelBottom, PanelRight } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';

interface TopNavProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onToggleAiPanel?: () => void;
  isAiPanelOpen?: boolean;
  onToggleBottomPanel?: () => void;
  isBottomPanelOpen?: boolean;
}

export default function TopNav({ 
  onToggleSidebar, 
  isSidebarOpen, 
  onToggleAiPanel, 
  isAiPanelOpen = true,
  onToggleBottomPanel,
  isBottomPanelOpen = true
}: TopNavProps) {
  const { aiProvider } = useSettingsStore();

  const providerNames: Record<string, string> = {
    openai: 'OpenAI GPT-4o',
    anthropic: 'Claude 3.5 Sonnet',
    gemini: 'Gemini 2.5 Pro',
    grok: 'xAI Grok'
  };

  return (
    <div className="h-14 w-full flex-shrink-0 drag-region flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-2 no-drag">
        <div className="flex items-center gap-2 group cursor-pointer px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <span className="font-medium text-[15px] text-foreground">
            {providerNames[aiProvider] || 'OpenAI GPT-4o'}
          </span>
          <ChevronDown size={14} className="text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 no-drag text-sm text-muted-foreground pr-4 mr-[140px]">
        <button 
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-md transition-colors ${isSidebarOpen ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-50 hover:opacity-100'}`}
          title="Toggle Primary Side Bar"
        >
          <PanelLeft size={18} strokeWidth={1.5} />
        </button>
        <button 
          onClick={onToggleBottomPanel}
          className={`p-1.5 rounded-md transition-colors ${isBottomPanelOpen ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-50 hover:opacity-100'}`}
          title="Toggle Panel"
        >
          <PanelBottom size={18} strokeWidth={1.5} />
        </button>
        <button 
          onClick={onToggleAiPanel}
          className={`p-1.5 rounded-md transition-colors ${isAiPanelOpen ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-50 hover:opacity-100'}`}
          title="Toggle Secondary Side Bar"
        >
          <PanelRight size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
