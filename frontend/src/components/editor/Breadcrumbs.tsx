import React from 'react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ groupId }: { groupId: string }) {
  const { editorGroups } = useWorkspaceStore();
  const group = editorGroups.find(g => g.id === groupId);
  const activeFile = group && group.activeFileIndex >= 0 ? group.openFiles[group.activeFileIndex] : null;

  if (!activeFile) return null;

  // Split by slashes or backslashes
  const parts = activeFile.path.split(/[/\\]/).filter(Boolean);

  return (
    <div className="flex h-6 items-center bg-background px-4 overflow-hidden flex-shrink-0 border-b border-border/20">
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          <span className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors max-w-[150px] truncate">
            {part}
          </span>
          {idx < parts.length - 1 && (
            <ChevronRight size={14} className="text-muted-foreground mx-1 flex-shrink-0 opacity-50" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
