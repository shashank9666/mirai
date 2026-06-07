'use client';

import React, { useRef, useEffect, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useWindowManagerStore } from '@/store/useWindowManagerStore';

import { api } from '../../lib/api';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  path?: string;
  originalValue?: string;
  groupId: string;
}

export default function MonacoEditor({ value, language, onChange, path, originalValue, groupId }: MonacoEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [monaco, setMonaco] = useState<any>(null);
  const pathRef = useRef(path);
  const { themeMode, codeAutocomplete, accentColor, editorMinimapEnabled, editorWordWrap } = useSettingsStore();
  const updateCursorPosition = useWorkspaceStore((state) => state.updateCursorPosition);

  // Monitor scrollTargetLine for this specific file in the active workspace
  const scrollTargetLine = useWorkspaceStore((state) => {
    const group = state.editorGroups.find(g => g.id === groupId);
    if (!group) return undefined;
    const file = group.openFiles.find(f => f.path === path);
    return file?.scrollTargetLine;
  });

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  // Effect to scroll to line when scrollTargetLine changes
  useEffect(() => {
    if (editorRef.current && scrollTargetLine && scrollTargetLine > 0) {
      const editor = editorRef.current;
      editor.setPosition({ lineNumber: scrollTargetLine, column: 1 });
      editor.revealLineInCenter(scrollTargetLine);
      editor.focus();

      // Clear scrollTargetLine after scrolling is complete
      useWorkspaceStore.setState((state) => {
        const groupIndex = state.editorGroups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return {};
        const group = state.editorGroups[groupIndex];
        const newFiles = group.openFiles.map(f => {
          if (f.path === path) {
            return { ...f, scrollTargetLine: undefined };
          }
          return f;
        });
        const newGroups = [...state.editorGroups];
        newGroups[groupIndex] = { ...group, openFiles: newFiles };
        return { editorGroups: newGroups };
      });
    }
  }, [scrollTargetLine, path, groupId]);

  // Effect to handle TitleBar menu commands (Undo, Redo, Select All)
  useEffect(() => {
    const handleUndo = () => {
      const activeGroupId = useWorkspaceStore.getState().activeGroupId;
      if (editorRef.current && activeGroupId === groupId) {
        editorRef.current.trigger('keyboard', 'undo', null);
      }
    };
    const handleRedo = () => {
      const activeGroupId = useWorkspaceStore.getState().activeGroupId;
      if (editorRef.current && activeGroupId === groupId) {
        editorRef.current.trigger('keyboard', 'redo', null);
      }
    };
    const handleSelectAll = () => {
      const activeGroupId = useWorkspaceStore.getState().activeGroupId;
      if (editorRef.current && activeGroupId === groupId) {
        editorRef.current.trigger('keyboard', 'editor.action.selectAll', null);
      }
    };

    window.addEventListener('mirai-undo', handleUndo);
    window.addEventListener('mirai-redo', handleRedo);
    window.addEventListener('mirai-select-all', handleSelectAll);

    return () => {
      window.removeEventListener('mirai-undo', handleUndo);
      window.removeEventListener('mirai-redo', handleRedo);
      window.removeEventListener('mirai-select-all', handleSelectAll);
    };
  }, [groupId]);

  useEffect(() => {
    const handleFormat = () => {
      const activeGroupId = useWorkspaceStore.getState().activeGroupId;
      if (editorRef.current && activeGroupId === groupId) {
        editorRef.current.getAction('editor.action.formatDocument')?.run();
      }
    };
    window.addEventListener('mirai-format-document', handleFormat);
    return () => {
      window.removeEventListener('mirai-format-document', handleFormat);
    };
  }, [groupId]);

  // Autosave Effect
  useEffect(() => {
    const currentPath = pathRef.current;
    if (!currentPath || !editorRef.current) return;
    
    const timeoutId = setTimeout(async () => {
      const currentEditor = editorRef.current;
      if (!currentEditor || typeof currentEditor.getValue !== 'function') return;
      
      const currentContent = currentEditor.getValue();
      const workspaceStore = useWorkspaceStore.getState();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fileInStore: any = null;
      
      workspaceStore.editorGroups.forEach(g => {
        const found = g.openFiles.find(f => f.path === currentPath);
        if (found) {
          fileInStore = found;
        }
      });
      
      if (fileInStore && fileInStore.content !== fileInStore.originalContent) {
        try {
          await api.writeFile(currentPath, currentContent);
          workspaceStore.updateOpenFileContent(currentPath, currentContent);
        } catch (e) {
          console.error('Autosave failed:', e);
        }
      }
    }, 1500); // 1.5 seconds after last keystroke

    return () => clearTimeout(timeoutId);
  }, [value, path]);

  useEffect(() => {
    if (!monaco) return;

    const getSelectionColor = (hex: string) => {
      if (!hex || hex === '#ffffff' || hex === '#000000') return themeMode === 'dark' ? '#264f78' : '#add6ff';
      return hex.startsWith('#') ? `${hex}40` : hex;
    };
    const getHighlightColor = (hex: string) => {
      if (!hex || hex === '#ffffff' || hex === '#000000') return themeMode === 'dark' ? '#add6ff26' : '#add6ff40';
      return hex.startsWith('#') ? `${hex}20` : hex;
    };
    const selectionColor = getSelectionColor(accentColor);
    const highlightColor = getHighlightColor(accentColor);
    const primaryAccent = accentColor && accentColor !== '#ffffff' && accentColor !== '#000000' ? accentColor : '#007acc';

    monaco.editor.defineTheme('mirai-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2a2d2e',
        'editor.selectionBackground': selectionColor,
        'editor.inactiveSelectionBackground': selectionColor + 'aa',
        'editorCursor.foreground': primaryAccent,
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': primaryAccent,
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': primaryAccent,
        'editor.selectionHighlightBackground': highlightColor,
        'editorBracketMatch.background': '#0d3a58',
        'editorBracketMatch.border': primaryAccent,
        'editorWidget.background': '#252526',
        'editorWidget.border': '#454545',
        'editorSuggestWidget.background': '#252526',
        'editorSuggestWidget.border': '#454545',
        'editorSuggestWidget.selectedBackground': selectionColor,
        'minimap.background': '#1e1e1e',
        'minimapSlider.background': '#ffffff20',
        'scrollbarSlider.background': '#ffffff30',
        'scrollbarSlider.hoverBackground': '#ffffff40',
        'scrollbarSlider.activeBackground': '#ffffff50',
      }
    });

    monaco.editor.defineTheme('mirai-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editor.lineHighlightBackground': '#efeff2',
        'editor.selectionBackground': selectionColor,
        'editor.inactiveSelectionBackground': selectionColor + 'aa',
        'editorCursor.foreground': primaryAccent,
        'editorLineNumber.foreground': '#999999',
        'editorLineNumber.activeForeground': primaryAccent,
        'editorIndentGuide.background': '#d3d3d3',
        'editorIndentGuide.activeBackground': primaryAccent,
        'editor.selectionHighlightBackground': highlightColor,
        'editorBracketMatch.background': '#e6f0ff',
        'editorBracketMatch.border': primaryAccent,
        'editorWidget.background': '#f3f3f3',
        'editorWidget.border': '#d4d4d4',
        'editorSuggestWidget.background': '#f3f3f3',
        'editorSuggestWidget.border': '#d4d4d4',
        'editorSuggestWidget.selectedBackground': selectionColor,
        'minimap.background': '#ffffff',
        'minimapSlider.background': '#00000020',
        'scrollbarSlider.background': '#00000030',
        'scrollbarSlider.hoverBackground': '#00000040',
        'scrollbarSlider.activeBackground': '#00000050',
      }
    });

    monaco.editor.setTheme(themeMode === 'dark' ? 'mirai-dark' : 'mirai-light');
  }, [monaco, themeMode, accentColor]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    // Note: for DiffEditor, the `editor` argument is the diff editor instance
    // `editor.getModifiedEditor()` gets the actual modified editor
    const actualEditor = editor.getModifiedEditor ? editor.getModifiedEditor() : editor;
    editorRef.current = actualEditor;
    setMonaco(monacoInstance);
    
    // Track Cursor Position
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actualEditor.onDidChangeCursorPosition((e: any) => {
      const position = { line: e.position.lineNumber, column: e.position.column };
      updateCursorPosition(groupId, pathRef.current || '', position);
    });

    // Focus handler to set active group and window
    actualEditor.onDidFocusEditorText(() => {
      useWorkspaceStore.getState().setActiveGroup(groupId);
      useWindowManagerStore.getState().focusWindow(groupId);
    });

    // Add Save Command (Ctrl+S / Cmd+S)
    actualEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, async () => {
      if (useSettingsStore.getState().formatOnSave) {
        await actualEditor.getAction('editor.action.formatDocument').run();
      }
      const currentPath = pathRef.current;
      const currentContent = actualEditor.getValue();
      if (currentPath) {
        try {
          await api.writeFile(currentPath, currentContent);
          console.log('File saved successfully:', currentPath);
        } catch (err) {
          console.error('Error saving file:', err);
        }
      }
    });

    // Add Format Command (Ctrl+Shift+F)
    actualEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF, async () => {
      await actualEditor.getAction('editor.action.formatDocument').run();
    });

    // Add Redo Command (Ctrl+R)
    actualEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyR, () => {
      actualEditor.trigger('keyboard', 'redo', null);
    });

    // --- Prettier Formatting Provider ---
    const formattingLanguages = [
      'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
      'css', 'scss', 'less', 'html', 'json', 'jsonc', 'markdown',
      'yaml', 'graphql', 'vue', 'svelte',
    ];
    formattingLanguages.forEach((lang) => {
      monacoInstance.languages.registerDocumentFormattingEditProvider(lang, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provideDocumentFormattingEdits: async (model: any) => {
          try {
            const currentContent = model.getValue();
            const currentPath = pathRef.current || '';
            const formatted = await api.formatFile(currentPath, currentContent);
            if (formatted && formatted !== currentContent) {
              return [{
                range: model.getFullModelRange(),
                text: formatted,
              }];
            }
          } catch {
            // Silently ignore formatting errors
          }
          return [];
        },
      });
    });

    // --- ESLint Linting (debounced on content change) ---
    let lintTimeout: ReturnType<typeof setTimeout> | null = null;
    const lintableExts = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'];

    const runLint = async () => {
      const currentPath = pathRef.current;
      if (!currentPath) return;
      const ext = currentPath.substring(currentPath.lastIndexOf('.')).toLowerCase();
      if (!lintableExts.includes(ext)) return;

      const currentContent = actualEditor.getValue();
      try {
        const diagnostics = await api.lintFile(currentPath, currentContent);
        const model = actualEditor.getModel();
        if (!model) return;

        const markers = diagnostics.map((d: { startLine: number; startColumn: number; endLine: number; endColumn: number; message: string; severity: string; ruleId: string | null }) => ({
          startLineNumber: d.startLine,
          startColumn: d.startColumn,
          endLineNumber: d.endLine,
          endColumn: d.endColumn,
          message: d.ruleId ? `${d.message} (${d.ruleId})` : d.message,
          severity: d.severity === 'error'
            ? monacoInstance.MarkerSeverity.Error
            : monacoInstance.MarkerSeverity.Warning,
          source: 'eslint',
        }));

        monacoInstance.editor.setModelMarkers(model, 'eslint', markers);
      } catch {
        // Silently ignore lint failures
      }
    };

    actualEditor.onDidChangeModelContent(() => {
      if (lintTimeout) clearTimeout(lintTimeout);
      lintTimeout = setTimeout(runLint, 800);
    });

    // Run initial lint
    setTimeout(runLint, 500);
  };

  const editorOptions = {
    minimap: { enabled: editorMinimapEnabled },
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    wordWrap: (editorWordWrap ? 'on' : 'off') as 'on' | 'off',
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    formatOnPaste: true,
    formatOnType: true,
    bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
    'semanticHighlighting.enabled': true,
    stickyScroll: { enabled: true },
    quickSuggestions: codeAutocomplete,
    suggestOnTriggerCharacters: codeAutocomplete,
    inlineSuggest: { enabled: codeAutocomplete },
  };

  return (
    <div className="h-full w-full relative group">


      {originalValue !== undefined ? (() => {
        const filename = path ? path.split(/[/\\]/).pop() || 'file.txt' : 'file.txt';
        return (
          <DiffEditor
            height="100%"
            language={language}
            original={originalValue}
            modified={value}
            originalModelPath={path ? `file:///original-${filename}` : undefined}
            modifiedModelPath={path ? `file:///modified-${filename}` : undefined}
            theme={themeMode === 'dark' ? 'mirai-dark' : 'mirai-light'}
            onMount={handleEditorDidMount}
            options={{
              ...editorOptions,
              renderSideBySide: false
            }}
          />
        );
      })() : (
        <Editor
          height="100%"
          language={language}
          path={path}
          value={value}
          onChange={onChange}
          theme={themeMode === 'dark' ? 'mirai-dark' : 'mirai-light'}
          onMount={handleEditorDidMount}
          options={editorOptions}
        />
      )}
    </div>
  );
}
