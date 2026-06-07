import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useWindowManagerStore } from '../../store/useWindowManagerStore';
import { Search, Loader2, ChevronRight, ChevronDown, FileCode, File } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '@/lib/utils';

interface SearchOccurrence {
  path: string;
  line: number;
  content: string;
}

interface GroupedResult {
  filePath: string;
  relativeDir: string;
  filename: string;
  occurrences: SearchOccurrence[];
}

export default function SearchPanel() {
  const { workspacePath, openFile } = useWorkspaceStore();
  const { ensureWindow } = useWindowManagerStore();
  
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GroupedResult[]>([]);
  const [matchedFiles, setMatchedFiles] = useState<string[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const executeSearch = React.useCallback(async (
    searchQuery: string,
    opts: { matchCase: boolean; wholeWord: boolean; isRegex: boolean }
  ) => {
    if (!searchQuery.trim() || !workspacePath) {
      setResults([]);
      setMatchedFiles([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.grepWorkspace(searchQuery, opts, workspacePath);
      
      // Group occurrences by file path
      const groups: Record<string, SearchOccurrence[]> = {};
      data.occurrences.forEach((occ) => {
        if (!groups[occ.path]) {
          groups[occ.path] = [];
        }
        groups[occ.path].push(occ);
      });

      const groupedResults: GroupedResult[] = Object.keys(groups).map((filePath) => {
        let relativeDir = '';
        const filename = filePath.split(/[/\\]/).pop() || '';
        
        if (filePath.startsWith(workspacePath)) {
          const relPath = filePath.substring(workspacePath.length).replace(/^[/\\]/, '');
          const parts = relPath.split(/[/\\]/);
          parts.pop(); // Remove filename
          relativeDir = parts.join('/');
        }

        return {
          filePath,
          relativeDir,
          filename,
          occurrences: groups[filePath],
        };
      });

      // Sort results so that files with more occurrences appear first
      groupedResults.sort((a, b) => b.occurrences.length - a.occurrences.length);

      setResults(groupedResults);
      setMatchedFiles(data.files || []);

      // Auto expand first 5 files
      const initialExpanded: Record<string, boolean> = {};
      groupedResults.slice(0, 5).forEach((group) => {
        initialExpanded[group.filePath] = true;
      });
      setExpandedFiles(initialExpanded);
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Search execution failed');
    } finally {
      setIsLoading(false);
    }
  }, [workspacePath]);

  // Trigger search from custom events (e.g. Find File References)
  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data && data.query) {
        setQuery(data.query);
        executeSearch(data.query, { matchCase, wholeWord, isRegex });
      }
    };
    window.addEventListener('mirai-search-trigger', handleTrigger);
    return () => window.removeEventListener('mirai-search-trigger', handleTrigger);
  }, [matchCase, wholeWord, isRegex, executeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, { matchCase, wholeWord, isRegex });
  };

  const toggleExpandFile = (filePath: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  const handleOccurrenceClick = async (filePath: string, lineNumber: number) => {
    try {
      const content = await api.readFile(filePath);
      // Determine language
      let language = 'plaintext';
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) language = 'typescript';
      else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) language = 'javascript';
      else if (filePath.endsWith('.json')) language = 'json';
      else if (filePath.endsWith('.html')) language = 'html';
      else if (filePath.endsWith('.css')) language = 'css';
      else if (filePath.endsWith('.md')) language = 'markdown';
      else if (filePath.endsWith('.py')) language = 'python';

      openFile({
        path: filePath,
        content,
        language,
        scrollTargetLine: lineNumber,
      });
      ensureWindow('editor', 'Code Editor');
    } catch (err) {
      console.error('Failed to open file from search results:', err);
    }
  };

  // Helper to highlight matching text in result snippet
  const renderHighlightedSnippet = (content: string, term: string) => {
    if (!term || isRegex) return <span>{content}</span>;

    const regex = new RegExp(`(${term.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')})`, matchCase ? 'g' : 'gi');
    const parts = content.split(regex);

    return (
      <span>
        {parts.map((part, idx) => 
          regex.test(part) ? (
            <mark key={idx} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-sidebar text-sidebar-foreground">
      {/* Search Input Area */}
      <form onSubmit={handleSearchSubmit} className="p-4 border-b border-border/40 flex flex-col gap-2 shrink-0">
        <div className="relative flex items-center bg-background border border-border rounded-md px-2 py-1.5 focus-within:ring-1 focus-within:ring-primary transition-all">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspace (IRS)..."
            className="bg-transparent border-none outline-none text-xs text-foreground flex-1 pr-6"
            autoFocus
          />
          <button type="submit" className="absolute right-2 text-muted-foreground hover:text-foreground">
            <Search size={14} />
          </button>
        </div>

        {/* Options Toggles */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
          <button
            type="button"
            onClick={() => setMatchCase(!matchCase)}
            className={cn(
              "px-2 py-0.5 rounded border transition-all",
              matchCase
                ? "bg-primary/20 text-primary border-primary/50"
                : "border-border hover:bg-white/5"
            )}
            title="Match Case (Aa)"
          >
            Aa
          </button>
          <button
            type="button"
            onClick={() => setWholeWord(!wholeWord)}
            className={cn(
              "px-2 py-0.5 rounded border transition-all",
              wholeWord
                ? "bg-primary/20 text-primary border-primary/50"
                : "border-border hover:bg-white/5"
            )}
            title="Match Whole Word (\b)"
          >
            {"ab"}
          </button>
          <button
            type="button"
            onClick={() => setIsRegex(!isRegex)}
            className={cn(
              "px-2 py-0.5 rounded border transition-all",
              isRegex
                ? "bg-primary/20 text-primary border-primary/50"
                : "border-border hover:bg-white/5"
            )}
            title="Use Regular Expression (.*)"
          >
            .*
          </button>
          
          {isLoading && (
            <Loader2 size={12} className="animate-spin text-primary ml-auto" />
          )}
        </div>
      </form>

      {/* Results View */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {error && (
          <div className="text-red-400 text-xs p-2 bg-red-500/10 rounded border border-red-500/20 mb-2">
            {error}
          </div>
        )}

        {!workspacePath ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            Open a workspace folder to search.
          </div>
        ) : query.trim() === '' ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            Enter a search term to find occurrences in files.
          </div>
        ) : !isLoading && results.length === 0 && matchedFiles.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            No results found.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Occurrences Section */}
            {results.length > 0 && (
              <div className="flex flex-col">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-2 mb-1.5">
                  Content Matches ({results.reduce((acc, r) => acc + r.occurrences.length, 0)})
                </div>
                {results.map((group) => {
                  const isExpanded = !!expandedFiles[group.filePath];
                  return (
                    <div key={group.filePath} className="flex flex-col text-xs">
                      {/* File Header */}
                      <div
                        onClick={() => toggleExpandFile(group.filePath)}
                        className="flex items-center gap-1 py-1 px-2 hover:bg-mirai-surface-hover cursor-pointer rounded text-foreground transition-colors group select-none"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {group.filename.endsWith('.ts') || group.filename.endsWith('.tsx') ? (
                          <FileCode size={13} className="text-blue-400 shrink-0" />
                        ) : (
                          <File size={13} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate font-semibold text-[13px]">{group.filename}</span>
                        {group.relativeDir && (
                          <span className="text-[10px] text-muted-foreground truncate opacity-70 ml-1">
                            {group.relativeDir}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.2 rounded-full text-muted-foreground font-semibold">
                          {group.occurrences.length}
                        </span>
                      </div>

                      {/* Occurrences List */}
                      {isExpanded && (
                        <div className="flex flex-col pl-4 mt-0.5 border-l border-border/40 ml-3.5 gap-0.5">
                          {group.occurrences.map((occ, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleOccurrenceClick(group.filePath, occ.line)}
                              className="flex items-center gap-2 py-0.5 px-2 hover:bg-mirai-surface-hover cursor-pointer rounded text-muted-foreground hover:text-foreground transition-colors font-mono text-[11px] truncate"
                            >
                              <span className="text-[10px] text-primary/70 select-none min-w-[20px] text-right font-semibold">
                                {occ.line}:
                              </span>
                              <span className="truncate">
                                {renderHighlightedSnippet(occ.content, query)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* File Names Section */}
            {matchedFiles.length > 0 && (
              <div className="flex flex-col">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-2 mb-1.5 border-t border-border/40 pt-2.5">
                  Matching File Names ({matchedFiles.length})
                </div>
                {matchedFiles.slice(0, 50).map((filePath) => {
                  const filename = filePath.split(/[/\\]/).pop() || '';
                  let relativePath = filePath;
                  if (workspacePath && filePath.startsWith(workspacePath)) {
                    relativePath = filePath.substring(workspacePath.length).replace(/^[/\\]/, '');
                  }
                  return (
                    <div
                      key={filePath}
                      onClick={() => handleOccurrenceClick(filePath, 1)}
                      className="flex items-center gap-1.5 py-1 px-2 hover:bg-mirai-surface-hover cursor-pointer rounded text-xs text-foreground transition-colors"
                    >
                      {filename.endsWith('.ts') || filename.endsWith('.tsx') ? (
                        <FileCode size={13} className="text-blue-400 shrink-0" />
                      ) : (
                        <File size={13} className="text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold text-[13px]">{filename}</span>
                      <span className="text-[10px] text-muted-foreground truncate opacity-70 ml-1">
                        {relativePath}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
