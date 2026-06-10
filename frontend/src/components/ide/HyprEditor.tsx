'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import Editor, { type OnMount, type OnChange, loader } from '@monaco-editor/react';
import { X, ChevronRight, Pin } from 'lucide-react';
import { useIdeStore, type EditorGroup } from '@/store/ideStore';
import DiffEditorPanel from './DiffEditor';

loader.config({ paths: { vs: '/vs' } });

function Breadcrumbs({ filePath }: { filePath: string }) {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return (
    <div className="flex items-center gap-0.5 px-3 py-1 text-[10px] font-mono text-white/30 bg-[#0a0a0a]/20 border-b border-white/3 overflow-hidden">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-white/15 shrink-0" />}
          <span className={`truncate shrink-0 ${i === parts.length - 1 ? 'text-white/60' : 'hover:text-white/50 cursor-pointer'}`}>
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function EditorTabs({ group }: { group: EditorGroup }) {
  const { setActiveGroup, closeTab, reorderTabs, toggleTabPin, activeGroupId } = useIdeStore();

  const handleTabClick = (path: string, name: string, savedContent: string) => {
    setActiveGroup(group.id);
    useIdeStore.getState().setActiveFile(path, name, savedContent);
  };

  const handleDragStart = (e: React.DragEvent, tabPath: string) => {
    e.dataTransfer.setData('tabPath', tabPath);
    e.dataTransfer.setData('groupId', group.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, targetTabPath: string) => {
    e.preventDefault();
    const draggedPath = e.dataTransfer.getData('tabPath');
    const sourceGroupId = e.dataTransfer.getData('groupId');
    
    // We only support reordering within the same group for now, or we can move tab to this group if it's different.
    if (sourceGroupId === group.id && draggedPath) {
      reorderTabs(group.id, draggedPath, targetTabPath);
    } else if (sourceGroupId && sourceGroupId !== group.id && draggedPath) {
      useIdeStore.getState().moveTabToGroup(draggedPath, sourceGroupId, group.id);
      reorderTabs(group.id, draggedPath, targetTabPath);
    }
  };

  const isActive = group.id === activeGroupId;

  return (
    <div className="flex bg-[#0a0a0a]/50 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0">
      {group.tabs.length === 0 ? (
        <div className="px-4 py-2 text-[11px] font-mono text-white/25 italic">No editors open</div>
      ) : (
        group.tabs.map((tab) => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.path)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tab.path)}
            className={`flex items-center gap-2 px-3 py-[6px] border-r border-white/5 text-[11px] font-mono cursor-pointer transition-all duration-150 group ${
              group.activeFile === tab.path && isActive
                ? 'bg-white/5 text-white border-t-2 border-t-[var(--color-primary-accent)]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
            }`}
            onClick={() => handleTabClick(tab.path, tab.name, tab.savedContent)}
            onDoubleClick={() => toggleTabPin(group.id, tab.path)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeTab(tab.id);
              }
            }}
          >
            {tab.pinned && <Pin className="w-2.5 h-2.5 text-white/50 shrink-0 transform -rotate-45" />}
            {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
            <span>{tab.name}</span>
            <X
              className="w-3 h-3 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            />
          </div>
        ))
      )}
    </div>
  );
}

function EditorGroupPanel({ group }: { group: EditorGroup }) {
  const { activeGroupId, setActiveGroup, removeGroup, groups, editorSettings, updateFileContent, saveFile } = useIdeStore();
  const isActive = group.id === activeGroupId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);

  const handleEditorChange: OnChange = useCallback((value) => {
    if (value !== undefined && group.id === activeGroupId) {
      updateFileContent(value);
    }
  }, [updateFileContent, group.id, activeGroupId]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber);
      setCursorColumn(e.position.column);
    });

    // Register editor actions
    editor.addAction({
      id: 'editor.action.formatDocument',
      label: 'Format Document',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: (ed) => {
        ed.getAction('editor.action.formatDocument')?.run();
      },
    });

    editor.addAction({
      id: 'editor.action.foldAll',
      label: 'Fold All',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO],
      run: (ed) => {
        ed.getAction('editor.foldAll')?.run();
      },
    });

    editor.addAction({
      id: 'editor.action.unfoldAll',
      label: 'Unfold All',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyJ],
      run: (ed) => {
        ed.getAction('editor.unfoldAll')?.run();
      },
    });
  }, []);

  // Store editor ref for external access
  useEffect(() => {
    if (isActive && editorRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__miraiEditor = editorRef.current;
    }
  }, [isActive]);

  // Save with format on save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's' && isActive) {
        e.preventDefault();
        if (editorSettings.formatOnSave && editorRef.current) {
          editorRef.current.getAction('editor.action.formatDocument')?.run().then(() => {
            saveFile();
          });
        } else {
          saveFile();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, editorSettings.formatOnSave, saveFile]);

  const opts = editorSettings;

  const monacoOptions = {
    automaticLayout: opts.automaticLayout,
    minimap: {
      enabled: opts.minimap,
      scale: opts.minimapScale,
      renderCharacters: false,
      maxColumn: 80,
    },
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight,
    fontFamily: "'JetBrains Mono', monospace",
    fontLigatures: true,
    tabSize: opts.tabSize,
    padding: opts.padding,
    scrollBeyondLastLine: opts.scrollBeyondLastLine,
    wordWrap: opts.wordWrap,
    wordWrapColumn: opts.wordWrapColumn,
    renderWhitespace: opts.renderWhitespace,
    guides: {
      indentation: opts.showIndentGuides,
      bracketPairs: opts.bracketPairColorization,
    },
    'bracketPairColorization.enabled': opts.bracketPairColorization,
    stickyScroll: { enabled: opts.stickyScroll },
    smoothScrolling: opts.smoothScrolling,
    cursorBlinking: opts.cursorBlinking,
    cursorStyle: opts.cursorStyle,
    cursorWidth: opts.cursorWidth,
    renderLineHighlight: opts.renderLineHighlight,
    showFoldingControls: opts.showFoldingControls,
    folding: opts.folding,
    rulers: opts.rulers,
    links: opts.links,
    colorDecorators: opts.colorDecorators,
    contextmenu: opts.contextmenu,
    mouseWheelZoom: opts.mouseWheelZoom,
    quickSuggestions: opts.quickSuggestions,
    suggestOnTriggerCharacters: opts.suggestOnTriggerCharacters,
    acceptSuggestionOnEnter: opts.acceptSuggestionOnEnter,
    tabCompletion: opts.tabCompletion,
    wordBasedSuggestions: opts.wordBasedSuggestions,
    overviewRulerBorder: opts.overviewRulerBorder,
    hideCursorInOverviewRuler: opts.hideCursorInOverviewRuler,
    autoClosingBrackets: opts.autoClosingBrackets ? 'always' as const : 'never' as const,
    autoClosingQuotes: opts.autoClosingQuotes ? 'always' as const : 'never' as const,
    formatOnPaste: opts.formatOnPaste,
    formatOnType: false,
    suggest: {
      showKeywords: true,
      showSnippets: true,
      showFunctions: true,
      showVariables: true,
      showModules: true,
      showClasses: true,
      showInterfaces: true,
    },
    glyphMargin: false,
    inlineSuggest: { enabled: true },
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      onClick={() => setActiveGroup(group.id)}
      style={{ outline: isActive ? '1px solid rgba(124,58,237,0.15)' : 'none' }}
    >
      <EditorTabs group={group} />

      {group.activeFile && <Breadcrumbs filePath={group.activeFile} />}

      <div className="flex-1 relative min-h-0">
        {group.activeFile ? (
          <Editor
            height="100%"
            theme={editorSettings.theme}
            path={group.id + ':' + group.activeFile}
            value={group.activeFileContent}
            language={group.tabs.find(t => t.path === group.activeFile)?.language}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={monacoOptions}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative">
            {groups.length > 1 && (
              <button
                onClick={() => removeGroup(group.id)}
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors z-10"
                title="Close Editor Group"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex flex-col items-center gap-4 text-white/15">
              <svg className="w-20 h-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="font-mono text-sm">Mirai Workspace</span>
              <span className="text-[11px] font-mono text-white/10">Press Ctrl+K for Command Palette</span>
            </div>
          </div>
        )}
      </div>

      {/* Group info bar */}
      {isActive && (
        <div className="flex items-center justify-between px-2 py-0.5 bg-[#0a0a0a]/30 border-t border-white/5 text-[10px] font-mono text-white/25">
          <span>Ln {cursorLine}, Col {cursorColumn}</span>
          {groups.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }}
              className="hover:text-red-400 transition-colors"
            >
              Close Group
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HyprEditor() {
  const { groups, splitDirection, addGroup, diffMode } = useIdeStore();

  // Register global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+\ to split editor
      if (mod && e.key === '\\') {
        e.preventDefault();
        addGroup('horizontal');
      }

      // Alt+Z to toggle word wrap
      if (e.altKey && e.key === 'z') {
        e.preventDefault();
        useIdeStore.getState().toggleWordWrap();
      }

      // Ctrl+K Z to toggle zen mode
      if (mod && e.key === 'k') {
        // Handled by CommandPalette
      }

      // Ctrl+= / Ctrl+- for font size
      if (mod && e.key === '=') {
        e.preventDefault();
        useIdeStore.getState().increaseFontSize();
      }
      if (mod && e.key === '-') {
        e.preventDefault();
        useIdeStore.getState().decreaseFontSize();
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        useIdeStore.getState().resetFontSize();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addGroup]);



  if (diffMode) {
    return (
      <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
        <DiffEditorPanel />
      </div>
    );
  }

  return (
    <div className="hypr-panel w-full h-full flex flex-col overflow-hidden">
      {groups.length === 1 ? (
        <EditorGroupPanel group={groups[0]} />
      ) : (
        <div className={`flex-1 flex min-h-0 ${splitDirection === 'vertical' ? 'flex-col' : 'flex-row'}`}>
          {groups.map((group, idx) => (
            <React.Fragment key={group.id}>
              <div className="flex-1 min-w-0 overflow-hidden">
                <EditorGroupPanel group={group} />
              </div>
              {idx < groups.length - 1 && (
                <SplitHandle direction={splitDirection} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitHandle({ direction }: { direction: 'horizontal' | 'vertical' }) {
  const isDragging = useRef(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

    const handleMouseMove = () => {
      if (!isDragging.current) return;
      // Visual feedback handled by CSS
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center group transition-colors
        ${direction === 'horizontal'
          ? 'w-[5px] cursor-col-resize hover:bg-[var(--color-primary-accent)]/20'
          : 'h-[5px] cursor-row-resize hover:bg-[var(--color-primary-accent)]/20'}`}
      onMouseDown={handleMouseDown}
    >
      <div className={`rounded-full bg-white/10 group-hover:bg-[var(--color-primary-accent)] transition-colors
        ${direction === 'horizontal' ? 'w-[2px] h-6' : 'w-6 h-[2px]'}`}
      />
    </div>
  );
}
