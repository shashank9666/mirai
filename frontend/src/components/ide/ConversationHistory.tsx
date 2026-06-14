'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore, Conversation } from '@/store/chatStore';
import { Search, Trash2, X, Clock, Play, AlertCircle, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConversationHistoryProps {
  onClose: () => void;
}

export default function ConversationHistory({ onClose }: ConversationHistoryProps) {
  const {
    conversations = [],
    activeConversationId,
    switchConversation,
    deleteConversation,
    migrateLegacyMessages
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Run migration on open to capture any legacy single-session messages
  useEffect(() => {
    migrateLegacyMessages();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [migrateLegacyMessages]);

  const filteredConversations = conversations.filter((c) => {
    const titleMatch = c.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const workspaceMatch = c.workspaceName?.toLowerCase().includes(searchQuery.toLowerCase());
    const messagesMatch = c.messages?.some((m) =>
      m.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return titleMatch || workspaceMatch || messagesMatch;
  });

  // Helper for formatting relative time
  const formatTimeAgo = (timestamp: number) => {
    if (!now) return 'just now';
    const diff = now - timestamp;
    if (diff < 60000) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  };

  // Grouping
  const blockedConvos = filteredConversations.filter((c) => c.status === 'blocked');
  const runningConvos = filteredConversations.filter((c) => c.status === 'running');
  const completedConvos = filteredConversations.filter(
    (c) => c.status === 'completed' || !c.status
  );

  const handleSelect = (id: string) => {
    switchConversation(id);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      deleteConversation(id);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const renderConvoItem = (convo: Conversation) => {
    const isActive = convo.id === activeConversationId;
    return (
      <div
        key={convo.id}
        onClick={() => handleSelect(convo.id)}
        className={`group relative flex flex-col gap-1.5 p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${isActive
            ? 'bg-blue-500/15 border-blue-500/50 hover:bg-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.1)]'
            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
          }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {convo.status === 'running' && (
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
            {convo.status === 'blocked' && (
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
            <span className="font-medium text-xs text-white/90 truncate">
              {convo.title || 'New Chat'}
            </span>
          </div>
          <button
            onClick={(e) => handleDelete(e, convo.id)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 text-white/40 rounded transition-all duration-150 shrink-0"
            title="Delete chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-white/40 font-mono mt-0.5">
          <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-white/50 truncate max-w-[150px]">
            {convo.workspaceName || 'Unknown Workspace'}
          </span>
          <span>{formatTimeAgo(convo.updatedAt)}</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#0d0f12] border-r border-white/5 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-xs text-white/90">Chat History</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-white/40 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-white/30" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search all convos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.02] border border-white/5 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors font-sans"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 custom-scrollbar">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-white/30 gap-2">
            <MessageSquare className="w-8 h-8 text-white/10" />
            <p className="text-xs">No conversations yet</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-white/30">
            <p className="text-xs">No matches found for &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <>
            {/* Blocked Section */}
            {blockedConvos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider font-semibold font-mono text-amber-400">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Blocked on Your Input ({blockedConvos.length})
                </div>
                <div className="flex flex-col gap-2">
                  {blockedConvos.map(renderConvoItem)}
                </div>
              </div>
            )}

            {/* Running Section */}
            {runningConvos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider font-semibold font-mono text-green-400">
                  <Play className="w-3 h-3 shrink-0 animate-pulse" />
                  Running ({runningConvos.length})
                </div>
                <div className="flex flex-col gap-2">
                  {runningConvos.map(renderConvoItem)}
                </div>
              </div>
            )}

            {/* Completed/Idle Section */}
            {completedConvos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {(blockedConvos.length > 0 || runningConvos.length > 0) && (
                  <div className="px-1 text-[10px] uppercase tracking-wider font-semibold font-mono text-white/30">
                    Recent Chats ({completedConvos.length})
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {completedConvos.map(renderConvoItem)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer / Shortcuts */}
      <div className="p-3 border-t border-white/5 text-[9px] text-white/30 font-mono flex items-center justify-between">
        <span>ESC to close</span>
        <span>Click to switch chat</span>
      </div>
    </motion.div>
  );
}
