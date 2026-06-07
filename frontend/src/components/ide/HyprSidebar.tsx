'use client';

import React, { useState, useEffect } from 'react';
import { readDirectory, readFileContent, FileNode } from '@/app/actions/fs';
import { useIdeStore } from '@/store/ideStore';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';

const FILE_ICONS: Record<string, string> = {
  '.tsx': '⚛️', '.ts': '🔷', '.js': '🟡', '.jsx': '⚛️',
  '.css': '🎨', '.json': '📋', '.md': '📝', '.py': '🐍',
  '.html': '🌐', '.env': '🔒', '.gitignore': '🙈',
};

const getFileIcon = (name: string) => {
  const ext = '.' + name.split('.').pop();
  return FILE_ICONS[ext] || '📄';
};

const TreeItem = ({ node, depth = 0 }: { node: FileNode; depth?: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const { setActiveFile, activeFile } = useIdeStore();

  const handleToggle = async () => {
    if (node.type === 'directory') {
      if (!isOpen && children.length === 0) {
        const loadedChildren = await readDirectory(node.path);
        setChildren(loadedChildren);
      }
      setIsOpen(!isOpen);
    } else {
      const content = await readFileContent(node.path);
      setActiveFile(node.path, node.name, content);
    }
  };

  const isSelected = activeFile === node.path;

  return (
    <div>
      <div
        className={`flex items-center py-[3px] cursor-pointer text-[12px] font-mono whitespace-nowrap transition-all duration-150 rounded-md mx-1
          ${isSelected 
            ? 'bg-[var(--color-primary-accent)]/15 text-white' 
            : 'text-white/55 hover:bg-white/5 hover:text-white/85'}`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleToggle}
      >
        <span className="mr-1 w-4 h-4 flex items-center justify-center shrink-0">
          {node.type === 'directory' ? (
            isOpen ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />
          ) : <span className="w-3" />}
        </span>
        <span className="mr-1.5 text-[11px] shrink-0">
          {node.type === 'directory' 
            ? (isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> : <Folder className="w-3.5 h-3.5 text-blue-400/70" />)
            : <span>{getFileIcon(node.name)}</span>
          }
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      
      {isOpen && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function HyprSidebar() {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);

  useEffect(() => {
    readDirectory().then(setRootNodes);
  }, []);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-widest uppercase shrink-0">
        Explorer
      </div>
      
      {/* File tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {rootNodes.map(node => (
          <TreeItem key={node.path} node={node} />
        ))}
        {rootNodes.length === 0 && (
          <div className="text-white/30 text-xs px-4 py-3 font-mono animate-pulse">Loading project...</div>
        )}
      </div>
    </div>
  );
}
