'use client';


export default function HyprChat() {
  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden relative">
      <div className="px-5 py-4 border-b border-white/5 font-mono text-xs text-white/40 tracking-widest uppercase flex items-center justify-between">
        <span>AI Assistant</span>
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_10px_#a855f7]" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
        <div className="flex flex-col gap-1 max-w-[85%]">
          <span className="text-[10px] font-mono text-purple-400 ml-1">GPT-5.5</span>
          <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 p-3 rounded-2xl rounded-tl-sm text-sm text-white/90 shadow-md">
            I&apos;m ready! The new Hyprland aesthetic is fully loaded. What shall we build next?
          </div>
        </div>

        {/* Animated Thinking Indicator */}
        <div className="flex flex-col gap-1 max-w-[85%]">
          <span className="text-[10px] font-mono text-white/40 ml-1">Thinking</span>
          <div className="bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-sm text-sm shadow-md flex items-center gap-2 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>

      <div className="p-3 bg-black/20 backdrop-blur-xl border-t border-white/5">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask AI..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors shadow-inner placeholder:text-white/30"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-white shadow-lg active:scale-95 transition-transform">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
        </div>
        <div className="flex justify-between items-center mt-2 px-1">
          <span className="text-[10px] font-mono text-white/30">Tokens: 1,420</span>
          <span className="text-[10px] font-mono text-white/30">⌘ K</span>
        </div>
      </div>
    </div>
  );
}
