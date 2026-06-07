import { FolderSearch, Plus, Terminal, Settings } from 'lucide-react';
import { useWindowManagerStore } from '@/store/useWindowManagerStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

export default function WelcomeScreen() {
  const { spawnWindow } = useWindowManagerStore();
  const { setCommandPaletteOpen } = useWorkspaceStore();

  const handleOpenTerminal = () => {
    spawnWindow('terminal', 'Terminal');
  };

  const handleOpenSettings = () => {
    spawnWindow('settings', 'Settings');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-center px-4 relative z-0">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-3">Mirai IDE</h1>
          <p className="text-muted-foreground text-lg">Your AI-powered development environment.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <FolderSearch size={24} />
            </div>
            <div className="text-sm font-medium text-foreground">Open Folder</div>
            <div className="text-xs text-muted-foreground">Ctrl+P</div>
          </button>

          <button
            onClick={handleOpenTerminal}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
              <Terminal size={24} />
            </div>
            <div className="text-sm font-medium text-foreground">New Terminal</div>
            <div className="text-xs text-muted-foreground">Ctrl+J</div>
          </button>

          <button
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <div className="text-sm font-medium text-foreground">New File</div>
            <div className="text-xs text-muted-foreground">Ctrl+N</div>
          </button>

          <button
            onClick={handleOpenSettings}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center text-gray-400 group-hover:scale-110 transition-transform">
              <Settings size={24} />
            </div>
            <div className="text-sm font-medium text-foreground">Settings</div>
            <div className="text-xs text-muted-foreground">Configure AI</div>
          </button>
        </div>
      </div>
    </div>
  );
}
