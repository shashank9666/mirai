'use client';

export default function AgentOverlay() {
  return (
    <aside className="w-80 glass-panel border-l border-white/10 p-4 flex flex-col m-4 ml-0 shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold tracking-widest text-primary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Agent Mirai
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto pb-4 space-y-4 pr-2 custom-scrollbar">
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl text-sm text-foreground shadow-sm">
          <p className="font-medium text-primary mb-1">Mirai</p>
          Hello! I&apos;m ready to assist you. What would you like to build today?
        </div>
      </div>
      <div className="relative mt-2">
        <input
          type="text"
          placeholder="Ask Mirai..."
          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary hover:bg-primary/90 rounded-lg text-white transition-colors shadow-md active:scale-95">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </button>
      </div>
    </aside>
  );
}
