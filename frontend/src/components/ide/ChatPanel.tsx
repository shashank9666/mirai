'use client';

import React from 'react';

export default function ChatPanel() {
  return (
    <div className="w-[320px] h-full flex flex-col border-l border-[var(--color-border)]" style={{ backgroundColor: 'var(--color-sidebar)' }}>
      {/* Header */}
      <div className="h-[38px] flex items-center px-4 border-b border-[var(--color-border)]">
        <span className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-normal)]">Mirai Chat</span>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
        <div className="bg-[var(--color-activity-bar)] p-3 rounded text-[13px] text-[var(--color-text-normal)] border border-[var(--color-border)]">
          <div className="font-semibold text-[var(--color-text-active)] mb-1 text-xs">Mirai AI</div>
          I am ready to help you write code!
        </div>
      </div>
      
      {/* Input */}
      <div className="p-4 pt-2">
        <div className="relative border border-[var(--color-border)] rounded overflow-hidden focus-within:border-[var(--color-accent)] transition-colors">
          <textarea 
            placeholder="Ask Mirai..." 
            className="w-full bg-[var(--color-activity-bar)] text-[13px] text-[var(--color-text-active)] p-3 pb-8 resize-none focus:outline-none custom-scrollbar"
            rows={3}
          />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button className="w-6 h-6 flex items-center justify-center text-[var(--color-text-muted)] hover:text-white rounded hover:bg-white/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button className="w-6 h-6 flex items-center justify-center text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-0.5">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
