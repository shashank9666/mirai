import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Explorer from '../sidebar/Explorer';

interface SidebarProps {
  isOpen: boolean;
  activeView: 'explorer' | 'search' | 'scm';
}

export default function Sidebar({ isOpen, activeView }: SidebarProps) {
  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? 260 : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-border/50 overflow-hidden flex-shrink-0 relative",
        !isOpen && "border-none"
      )}
    >
      <div className="flex items-center px-4 h-10 border-b border-border/50 flex-shrink-0 drag-region uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
        {activeView === 'explorer' && "Explorer"}
        {activeView === 'search' && "Search"}
        {activeView === 'scm' && "Source Control"}
      </div>

      <div className="flex-1 overflow-hidden w-[260px] flex flex-col">
        {activeView === 'explorer' && <Explorer />}
        {activeView === 'search' && (
          <div className="flex-1 p-4 flex items-center justify-center text-sm text-muted-foreground">
            Search coming soon...
          </div>
        )}
        {activeView === 'scm' && (
          <div className="flex-1 p-4 flex items-center justify-center text-sm text-muted-foreground">
            Source Control coming soon...
          </div>
        )}
      </div>
    </motion.div>
  );
}
