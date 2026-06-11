'use client';

import React from 'react';
import { Pin, Minus, Maximize2, Minimize2, X } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  isPinned?: boolean;
  isMinimized?: boolean;
  isMaximized?: boolean;
  onPin?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  children?: React.ReactNode; // Extra content in header (tabs, etc.)
  accentColor?: string;
  onDragStart?: (e: React.DragEvent) => void;
}

export default function PanelHeader({
  title,
  isPinned = false,
  isMinimized = false,
  isMaximized = false,
  onPin,
  onMinimize,
  onMaximize,
  onClose,
  children,
  accentColor,
  onDragStart,
}: PanelHeaderProps) {
  return (
    <div 
      draggable
      onDragStart={onDragStart}
      className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0 select-none cursor-grab active:cursor-grabbing"
      style={accentColor ? { borderTop: `2px solid ${accentColor}` } : undefined}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-mono text-[10px] text-white/40 tracking-widest uppercase truncate">
          {title}
        </span>
        {children}
      </div>

      <div className="flex items-center gap-0.5 ml-2">
        {onPin && (
          <button
            onClick={onPin}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${isPinned ? 'text-[var(--color-primary-accent)]' : 'text-white/30 hover:text-white/60'}`}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3 h-3" style={isPinned ? { transform: 'rotate(45deg)' } : undefined} />
          </button>
        )}
        {onMinimize && (
          <button
            onClick={onMinimize}
            className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
            title={isMinimized ? 'Restore' : 'Minimize'}
          >
            <Minus className="w-3 h-3" />
          </button>
        )}
        {onMaximize && (
          <button
            onClick={onMaximize}
            className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
