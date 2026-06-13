"""
Proactive Events Service — Monitor workspace for events the agent should act on.

Events:
  - build_failed: Build/compile errors detected
  - test_failed: Test failures
  - git_conflict: Merge conflicts
  - file_saved: File saved (for context tracking)
  - terminal_error: Error output in terminal
  - lint_error: Linting errors detected

The agent can respond proactively to these events.
"""

from __future__ import annotations

import time
import json
import threading
from typing import Optional, Dict, Any, List, Callable
from collections import deque


class ProactiveEvent:
    """A single proactive event."""

    def __init__(self, event_type: str, description: str,
                 file_path: str = "", metadata: Optional[Dict] = None):
        self.id = f"{event_type}_{int(time.time() * 1000)}"
        self.type = event_type
        self.description = description
        self.file_path = file_path
        self.metadata = metadata or {}
        self.timestamp = time.time()
        self.acknowledged = False
        self.agent_responded = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "description": self.description,
            "file_path": self.file_path,
            "metadata": self.metadata,
            "timestamp": self.timestamp,
            "acknowledged": self.acknowledged,
            "agent_responded": self.agent_responded,
        }


class ProactiveEventsService:
    """Manages proactive events from the workspace."""

    def __init__(self, max_events: int = 100):
        self._events: deque = deque(maxlen=max_events)
        self._listeners: List[Callable] = []
        self._lock = threading.Lock()

    def emit(self, event_type: str, description: str,
             file_path: str = "", metadata: Optional[Dict] = None) -> ProactiveEvent:
        """Emit a new proactive event."""
        event = ProactiveEvent(event_type, description, file_path, metadata)
        with self._lock:
            self._events.append(event)

        # Notify listeners
        for listener in self._listeners:
            try:
                listener(event)
            except Exception:
                pass

        return event

    def get_events(self, limit: int = 20,
                   unacknowledged_only: bool = False) -> List[Dict]:
        """Get recent events."""
        with self._lock:
            events = list(self._events)
        if unacknowledged_only:
            events = [e for e in events if not e.acknowledged]
        return [e.to_dict() for e in events[-limit:]]

    def acknowledge(self, event_id: str) -> bool:
        """Mark an event as acknowledged."""
        with self._lock:
            for event in self._events:
                if event.id == event_id:
                    event.acknowledged = True
                    return True
        return False

    def mark_agent_responded(self, event_id: str) -> bool:
        """Mark an event as having been responded to by the agent."""
        with self._lock:
            for event in self._events:
                if event.id == event_id:
                    event.agent_responded = True
                    return True
        return False

    def add_listener(self, callback: Callable):
        """Add a listener for new events."""
        self._listeners.append(callback)

    def remove_listener(self, callback: Callable):
        """Remove a listener."""
        self._listeners = [l for l in self._listeners if l != callback]

    def get_unacknowledged_count(self) -> int:
        """Get count of unacknowledged events."""
        with self._lock:
            return sum(1 for e in self._events if not e.acknowledged)

    def clear(self):
        """Clear all events."""
        with self._lock:
            self._events.clear()


# ---------------------------------------------------------------------------
# Event parsers — detect events from terminal output, git, etc.
# ---------------------------------------------------------------------------

def parse_terminal_output(output: str, cwd: str = "") -> Optional[Dict]:
    """
    Parse terminal output for actionable events.
    Returns event dict or None.
    """
    output_lower = output.lower()

    # Build errors (TypeScript, Python, etc.)
    build_errors = [
        ("error ts", "build_failed", "TypeScript build error"),
        ("build failed", "build_failed", "Build failed"),
        ("compilation error", "build_failed", "Compilation error"),
        ("syntaxerror", "build_failed", "Syntax error"),
        ("module not found", "build_failed", "Module not found"),
        ("cannot find module", "build_failed", "Module not found"),
    ]

    for pattern, etype, desc in build_errors:
        if pattern in output_lower:
            # Try to extract file path
            file_path = _extract_file_path(output)
            return {"type": etype, "description": desc,
                    "file_path": file_path, "output": output[:500]}

    # Test failures
    test_patterns = [
        ("test failed", "test_failed", "Test failed"),
        ("failures:", "test_failed", "Test failures detected"),
        ("expected ", "test_failed", "Test assertion failure"),
    ]
    for pattern, etype, desc in test_patterns:
        if pattern in output_lower:
            return {"type": etype, "description": desc,
                    "output": output[:500]}

    # Lint errors
    lint_patterns = [
        ("eslint error", "lint_error", "ESLint error"),
        ("lint error", "lint_error", "Lint error"),
        ("pylint error", "lint_error", "Pylint error"),
    ]
    for pattern, etype, desc in lint_patterns:
        if pattern in output_lower:
            file_path = _extract_file_path(output)
            return {"type": etype, "description": desc,
                    "file_path": file_path, "output": output[:500]}

    return None


def parse_git_output(output: str) -> Optional[Dict]:
    """Parse git output for events."""
    if "conflict" in output.lower():
        return {"type": "git_conflict", "description": "Merge conflict detected",
                "output": output[:500]}
    return None


def _extract_file_path(text: str) -> str:
    """Try to extract a file path from error output."""
    import re
    # Common patterns: file.ts:line:col, file.ts (line X)
    patterns = [
        r'([^\s:]+\.(?:ts|tsx|js|jsx|py|rs|go|java|css|html|json)):\d+',
        r'([^\s:]+\.(?:ts|tsx|js|jsx|py|rs|go|java|css|html|json))',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return ""


# Singleton
proactive_events = ProactiveEventsService()