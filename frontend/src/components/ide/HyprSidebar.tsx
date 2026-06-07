'use client';

import React, { useState, useEffect } from 'react';
import { readDirectory, readFileContent, FileNode } from '@/app/actions/fs';
import { useIdeStore } from '@/store/ideStore';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';

const TreeItem = ({ node }: { node: FileNode }) => {
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
        className={`flex items-center py-1 px-2 cursor-pointer text-sm font-mono whitespace-nowrap transition-colors
          ${isSelected ? 'bg-[var(--color-primary-accent)]/20 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}
        onClick={handleToggle}
      >
        <span className="mr-1 w-4 h-4 flex items-center justify-center">
          {node.type === 'directory' ? (
            isOpen ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />
          ) : null}
        </span>
        <span className="mr-2">
          {node.type === 'directory' ? (
            <Folder className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <File className="w-3.5 h-3.5 text-gray-400" />
          )}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      
      {isOpen && children.length > 0 && (
        <div className="pl-4 border-l border-white/5 ml-3">
          {children.map((child) => (
            <TreeItem key={child.path} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function HyprSidebar() {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);

  useEffect(() => {
    // Load initial root directory
    readDirectory().then(setRootNodes);
  }, []);

  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 font-mono text-xs text-white/40 tracking-widest uppercase flex items-center justify-between shrink-0">
        Project Tree
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {rootNodes.map(node => (
          <TreeItem key={node.path} node={node} />
        ))}
        {rootNodes.length === 0 && (
          <div className="text-white/30 text-xs px-4 py-2 font-mono animate-pulse">Loading...</div>
        )}
      </div>
    </div>
  );
}
