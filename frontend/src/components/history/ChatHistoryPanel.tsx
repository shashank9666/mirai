'use client';

import React, { useState } from 'react';
import { MessageSquare, Trash2, ChevronRight, Search } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useWindowManagerStore } from '@/store/useWindowManagerStore';

export default function ChatHistoryPanel() {
  const { sessions, switchChat, deleteChat } = useChatStore();
  const { spawnWindow } = useWindowManagerStore();
  const [search, setSearch] = useState('');

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleContinueChat = (sessionId: string) => {
    switchChat(sessionId);
    spawnWindow('chat', 'Mirai AI');
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground mb-2">Chat History</h2>
        <div className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="bg-transparent text-sm text-foreground outline-none w-full placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search ? 'No chats found' : 'No chat history yet'}
          </div>
        ) : (
          <div className="py-1">
            {filteredSessions.map(session => (
              <div
                key={session.id}
                className="group flex items-center gap-2 px-4 py-2.5 hover:bg-muted cursor-pointer transition-colors border-b border-border/30"
                onClick={() => handleContinueChat(session.id)}
              >
                <MessageSquare size={16} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {session.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {session.messages.length} messages
                    {session.messages.length > 0 && (
                      <> &middot; {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors flex items-center gap-1 shrink-0">
                  Continue <ChevronRight size={12} />
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteChat(session.id); }}
                  className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Delete chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
