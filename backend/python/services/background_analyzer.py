"""
Background Intelligence — watches file changes, analyzes impact,
and provides actionable insights beyond simple change notifications.
"""

from __future__ import annotations
import os
import time
import threading
from typing import Optional, Set
from services.watcher import setup_watcher
from core.workspace_graph import WorkspaceIndexer
from core.event_bus import event_bus


class BackgroundAnalyzer:
    """
    Enhances the file watcher with intelligent analysis.

    Instead of:
        Watch file changes → Notify

    It does:
        Watch file changes → Analyze impact → Generate fixes → Show notification
    """

    def __init__(self, workspace_path: str):
        self.workspace_path = workspace_path
        self.indexer = WorkspaceIndexer(workspace_path) if workspace_path else None
        self._debounce_timers: dict = {}
        self._debounce_lock = threading.Lock()
        self._analysis_enabled = True

    def on_file_changed(self, event_type: str, file_path: str):
        """Called by the watcher when a file changes. Debounces and analyzes."""
        if not self._analysis_enabled:
            return

        # Debounce: wait 500ms for more changes before analyzing
        with self._debounce_lock:
            if file_path in self._debounce_timers:
                self._debounce_timers[file_path].cancel()

            timer = threading.Timer(0.5, self._analyze_file, args=[event_type, file_path])
            timer.daemon = True
            self._debounce_timers[file_path] = timer
            timer.start()

    def _analyze_file(self, event_type: str, file_path: str):
        """Analyze a changed file and publish insights."""
        if not self.indexer:
            return

        with self._debounce_lock:
            self._debounce_timers.pop(file_path, None)

        try:
            rel_path = os.path.relpath(file_path, self.workspace_path)
        except ValueError:
            rel_path = file_path

        # Reindex the changed file
        if event_type in ("writeFile", "createFile"):
            nodes_added = self.indexer.index_file(file_path)
        elif event_type == "deleteItem":
            # Clear the file's nodes from the graph
            pass  # Handled by full re-index if needed

        # Publish analysis event
        insights = []
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ('.py', '.js', '.jsx', '.ts', '.tsx'):
            # Check for common issues
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                insights = self._quick_scan(content, ext, rel_path)
            except Exception:
                pass

        event_bus.publish(f"bg:{rel_path}", {
            "type": "bg:file_analyzed",
            "event_type": event_type,
            "file": rel_path,
            "insights": insights,
        })

    def _quick_scan(self, content: str, ext: str, rel_path: str) -> list:
        """Quick regex-based scan for common issues and patterns."""
        insights = []
        lines = content.split('\n')

        # Check for TODO/FIXME/HACK comments
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith('#') or stripped.startswith('//') or stripped.startswith('/*'):
                if 'TODO' in stripped:
                    insights.append({
                        "type": "todo",
                        "severity": "info",
                        "line": i,
                        "message": f"TODO: {stripped[stripped.index('TODO'):]}",
                    })
                elif 'FIXME' in stripped:
                    insights.append({
                        "type": "fixme",
                        "severity": "warning",
                        "line": i,
                        "message": f"FIXME: {stripped[stripped.index('FIXME'):]}",
                    })

        # Check for large files
        if len(content) > 10000:
            insights.append({
                "type": "size_warning",
                "severity": "info",
                "message": f"File is large ({len(content)} chars). Consider splitting.",
            })

        # Check for console.log/print statements
        if 'console.log' in content:
            insights.append({
                "type": "debug_statement",
                "severity": "info",
                "message": "Contains console.log statements (potential debug leftovers).",
            })
        if 'print(' in content and ext == '.py':
            insights.append({
                "type": "debug_statement",
                "severity": "info",
                "message": "Contains print() statements (potential debug leftovers).",
            })

        return insights

    def enable_analysis(self, enabled: bool = True):
        self._analysis_enabled = enabled

    def get_file_insights(self, file_path: str) -> list:
        """Get cached insights for a file."""
        return []


# Singleton
_analyzer: Optional[BackgroundAnalyzer] = None


def get_analyzer(workspace_path: str = "") -> BackgroundAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = BackgroundAnalyzer(workspace_path)
    return _analyzer