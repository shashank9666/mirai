'use client';

import React from 'react';

export default function HeroEditor() {
  return (
    <section className="flex-1 flex flex-col relative glass-panel m-4 ml-0 shadow-2xl transition-all duration-300">
      <header className="h-12 border-b border-white/5 flex items-center px-4 bg-black/10 backdrop-blur-md rounded-t-2xl">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <div className="ml-4 text-xs font-mono text-muted-foreground">Welcome</div>
      </header>
      <div className="flex-1 p-8 flex items-center justify-center relative overflow-hidden bg-black/20 rounded-b-2xl">
        <div className="absolute inset-0 flex items-center justify-center text-primary/10 pointer-events-none">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 16 4-4-4-4"/>
            <path d="m6 8-4 4 4 4"/>
            <path d="m14.5 4-5 16"/>
          </svg>
        </div>
        <div className="text-center z-10">
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            Mirai IDE
          </h1>
          <p className="text-muted-foreground font-medium">The Premium Agentic Workspace</p>
        </div>
      </div>
    </section>
  );
}
