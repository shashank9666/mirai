import React, { useState, useEffect } from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useWindowManagerStore, LayoutNode } from '@/store/useWindowManagerStore';
import { X, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import the specific window contents
import Explorer from '../sidebar/Explorer';
import ChatPanel from '@/components/chat/ChatPanel';
import Terminal from '@/components/terminal/Terminal';
import SettingsView from '@/components/settings/SettingsView';
import EditorContainer from '@/components/editor/EditorContainer';
import ChatHistoryPanel from '@/components/history/ChatHistoryPanel';
import SearchPanel from '../sidebar/SearchPanel';
import CookbookView from '@/components/cookbook/CookbookView';
import CompareView from '@/components/compare/CompareView';

interface TilingGridProps {
  node: LayoutNode;
}

export default function TilingGrid({ node }: TilingGridProps) {
  const { activeNodeId, focusWindow, closeWindow, moveNode } = useWindowManagerStore();
  const [resizeKey, setResizeKey] = useState(0);

  // Re-render panels on window resize (handles browser zoom Ctrl+/Ctrl-)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setResizeKey(k => k + 1), 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, []);

  // Drag and Drop State
  const [dragOverZone, setDragOverZone] = useState<'top' | 'bottom' | 'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (node.type === 'split') {
    const isHorizontal = node.direction === 'horizontal';
    return (
      <PanelGroup key={resizeKey} orientation={node.direction} className="w-full h-full overflow-hidden">
        {node.children.map((child, index) => (
          <React.Fragment key={child.id}>
            {index > 0 && (
              <PanelResizeHandle className={cn(
                "group transition-colors z-10 relative flex items-center justify-center",
                isHorizontal
                  ? "w-[6px] cursor-col-resize mx-[-1px]"
                  : "h-[6px] cursor-row-resize my-[-1px]"
              )}>
                <div className={cn(
                  "bg-border group-hover:bg-primary transition-colors rounded-full",
                  isHorizontal ? "w-[2px] h-8" : "h-[2px] w-8"
                )} />
              </PanelResizeHandle>
            )}
            <Panel id={child.id} minSize={10} className="flex overflow-hidden">
              <TilingGrid node={child} />
            </Panel>
          </React.Fragment>
        ))}
      </PanelGroup>
    );
  }

  // It's a leaf node.
  const isActive = activeNodeId === node.id;

  
  const renderContent = () => {
    switch (node.windowType) {
      case 'explorer':
        return <div className="h-full w-full bg-background overflow-hidden"><Explorer /></div>;
      case 'chat':
        return <div className="h-full w-full bg-background overflow-hidden"><ChatPanel /></div>;
      case 'settings':
        return <div className="h-full w-full bg-background overflow-hidden"><SettingsView /></div>;
      case 'terminal':
        return <div className="h-full w-full bg-background overflow-hidden flex items-center justify-center"><Terminal /></div>;
      case 'editor':
        return <div className="h-full w-full bg-background overflow-hidden flex flex-col"><EditorContainer nodeId={node.id} /></div>;
      case 'history':
        return <div className="h-full w-full bg-background overflow-hidden"><ChatHistoryPanel /></div>;
      case 'search':
        return <div className="h-full w-full bg-background overflow-hidden"><SearchPanel /></div>;
      case 'cookbook':
        return <div className="h-full w-full bg-background overflow-hidden"><CookbookView /></div>;
      case 'compare':
        return <div className="h-full w-full bg-background overflow-hidden"><CompareView /></div>;
      default:
        return <div className="text-muted-foreground p-4">Unknown Window Type</div>;
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverZone(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // Calculate drop zone based on mouse position within the element
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Determine which edge is closest
    const thresholds = {
      left: x,
      right: rect.width - x,
      top: y,
      bottom: rect.height - y
    };
    
    const min = Math.min(thresholds.left, thresholds.right, thresholds.top, thresholds.bottom);
    
    if (min === thresholds.left) setDragOverZone('left');
    else if (min === thresholds.right) setDragOverZone('right');
    else if (min === thresholds.top) setDragOverZone('top');
    else setDragOverZone('bottom');
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the element entirely (not entering a child)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverZone(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/plain');
    const targetId = node.id;
    
    if (sourceId && sourceId !== targetId && dragOverZone) {
      moveNode(sourceId, targetId, dragOverZone);
    }
    
    setDragOverZone(null);
    setIsDragging(false);
  };

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        focusWindow(node.id);
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      className={cn(
        "flex-1 flex flex-col w-full h-full bg-background overflow-hidden transition-all relative border-t-2",
        isActive ? "border-t-primary" : "border-t-transparent",
        isDragging && "opacity-50"
      )}
    >
      {/* Drop Zone Overlays */}
      {dragOverZone && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className={cn(
            "absolute bg-primary/25 border-2 border-primary transition-all duration-150 shadow-[0_0_15px_rgba(var(--primary),0.15)]",
            dragOverZone === 'left' && "inset-y-1 left-1 w-1/2 border-r-2 rounded-l-lg",
            dragOverZone === 'right' && "inset-y-1 right-1 w-1/2 border-l-2 rounded-r-lg",
            dragOverZone === 'top' && "inset-x-1 top-1 h-1/2 border-b-2 rounded-t-lg",
            dragOverZone === 'bottom' && "inset-x-1 bottom-1 h-1/2 border-t-2 rounded-b-lg"
          )} />
          <span className="text-xs font-semibold text-primary z-10 bg-background/80 px-2 py-1 rounded">
            Drop here
          </span>
        </div>
      )}

      {/* Tile Header (Draggable) */}
      <div 
        draggable
        onDragStart={handleDragStart}
        className="h-8 bg-muted/80 flex items-center justify-between px-3 shrink-0 group cursor-grab active:cursor-grabbing border-b border-border select-none"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <GripHorizontal size={14} className={cn(
            "shrink-0 transition-all",
            isDragging ? "text-white/70" : "text-white/20 group-hover:text-white/50"
          )} />
          <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider select-none truncate">
            {node.title}
          </span>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            closeWindow(node.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-muted-foreground transition-all shrink-0 ml-2"
        >
          <X size={12} />
        </button>
      </div>
      
      {/* Tile Content */}
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>
    </div>
  );
}
