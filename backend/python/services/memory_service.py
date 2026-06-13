"""
Memory Service — User preferences, project context, and conversation memory.

Stores:
  - User preferences (provider, language, theme, etc.)
  - Project context (recent files, git branch, last activity)
  - Conversation summaries
  - Greeting context (what was the user working on last)

Persists to JSON file in the workspace directory.
"""

from __future__ import annotations

import os
import json
import time
from typing import Optional, Dict, Any, List
from pathlib import Path
from datetime import datetime


class MemoryService:
    """Persistent memory for the Mirai assistant."""

    def __init__(self, workspace_path: str = ""):
        self.workspace_path = workspace_path
        self._memory_dir = os.path.join(
            workspace_path, ".mirai", "memory"
        ) if workspace_path else ""
        self._preferences_file = os.path.join(
            self._memory_dir, "preferences.json"
        ) if self._memory_dir else ""
        self._context_file = os.path.join(
            self._memory_dir, "context.json"
        ) if self._memory_dir else ""
        self._history_file = os.path.join(
            self._memory_dir, "history.json"
        ) if self._memory_dir else ""

    def _ensure_dir(self):
        if self._memory_dir and not os.path.exists(self._memory_dir):
            os.makedirs(self._memory_dir, exist_ok=True)

    def _load_json(self, path: str) -> dict:
        if not path or not os.path.exists(path):
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}

    def _save_json(self, path: str, data: dict):
        self._ensure_dir()
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    # -----------------------------------------------------------------------
    # Preferences
    # -----------------------------------------------------------------------

    def get_preferences(self) -> Dict[str, Any]:
        """Get all user preferences."""
        prefs = self._load_json(self._preferences_file)
        return {
            "preferred_provider": prefs.get("preferred_provider", "openai"),
            "preferred_model": prefs.get("preferred_model", "gpt-4o"),
            "favorite_language": prefs.get("favorite_language", ""),
            "tts_provider": prefs.get("tts_provider", "gtts"),
            "tts_voice": prefs.get("tts_voice", "onyx"),
            "stt_provider": prefs.get("stt_provider", "openai"),
            "theme": prefs.get("theme", "dark"),
            "wake_word": prefs.get("wake_word", "mirai"),
            "voice_enabled": prefs.get("voice_enabled", False),
            "auto_tts": prefs.get("auto_tts", False),
            "custom": prefs.get("custom", {}),
        }

    def set_preferences(self, updates: Dict[str, Any]):
        """Update user preferences."""
        prefs = self._load_json(self._preferences_file)
        prefs.update(updates)
        prefs["updated_at"] = time.time()
        self._save_json(self._preferences_file, prefs)

    # -----------------------------------------------------------------------
    # Project Context
    # -----------------------------------------------------------------------

    def get_project_context(self) -> Dict[str, Any]:
        """Get current project context."""
        ctx = self._load_json(self._context_file)
        return {
            "current_project": ctx.get("current_project", ""),
            "project_path": ctx.get("project_path", ""),
            "git_branch": ctx.get("git_branch", ""),
            "last_activity": ctx.get("last_activity", ""),
            "last_file_opened": ctx.get("last_file_opened", ""),
            "recent_files": ctx.get("recent_files", [])[:10],
            "recent_errors": ctx.get("recent_errors", [])[:5],
            "session_count": ctx.get("session_count", 0),
        }

    def update_project_context(self, updates: Dict[str, Any]):
        """Update project context."""
        ctx = self._load_json(self._context_file)
        ctx.update(updates)

        # Track recent files (keep last 20)
        if "last_file_opened" in updates:
            recent = ctx.get("recent_files", [])
            filepath = updates["last_file_opened"]
            if filepath in recent:
                recent.remove(filepath)
            recent.insert(0, filepath)
            ctx["recent_files"] = recent[:20]

        ctx["updated_at"] = time.time()
        self._save_json(self._context_file, ctx)

    def increment_session(self):
        """Increment session count."""
        ctx = self._load_json(self._context_file)
        ctx["session_count"] = ctx.get("session_count", 0) + 1
        ctx["last_session_time"] = time.time()
        self._save_json(self._context_file, ctx)

    # -----------------------------------------------------------------------
    # Conversation History (summaries)
    # -----------------------------------------------------------------------

    def add_conversation_summary(self, summary: str, topic: str = ""):
        """Store a summary of a conversation."""
        history = self._load_json(self._history_file)
        summaries = history.get("summaries", [])
        summaries.append({
            "summary": summary,
            "topic": topic,
            "timestamp": time.time(),
            "date": datetime.now().isoformat(),
        })
        # Keep last 50 summaries
        history["summaries"] = summaries[-50:]
        self._save_json(self._history_file, history)

    def get_recent_summaries(self, limit: int = 10) -> List[Dict]:
        """Get recent conversation summaries."""
        history = self._load_json(self._history_file)
        return history.get("summaries", [])[-limit:]

    # -----------------------------------------------------------------------
    # Greeting Context
    # -----------------------------------------------------------------------

    def get_greeting_context(self) -> Dict[str, Any]:
        """
        Build a greeting context for when the user starts a new session.
        Returns info like "You were working on X yesterday" etc.
        """
        prefs = self.get_preferences()
        ctx = self.get_project_context()
        summaries = self.get_recent_summaries(3)

        greeting = {
            "session_count": ctx.get("session_count", 0),
            "project_name": ctx.get("current_project", ""),
            "last_activity": ctx.get("last_activity", ""),
            "recent_files": ctx.get("recent_files", [])[:5],
            "recent_summaries": [
                s.get("summary", "") for s in summaries
            ],
        }

        return greeting

    def add_activity(self, activity_type: str, description: str,
                     metadata: Optional[Dict] = None):
        """Record an activity for the greeting context."""
        ctx = self._load_json(self._context_file)
        activities = ctx.get("recent_activities", [])
        activities.append({
            "type": activity_type,
            "description": description,
            "timestamp": time.time(),
            "metadata": metadata or {},
        })
        ctx["recent_activities"] = activities[-20:]
        ctx["last_activity"] = description
        self._save_json(self._context_file, ctx)


# Singleton per workspace
_memory_instances: Dict[str, MemoryService] = {}


def get_memory_service(workspace_path: str = "") -> MemoryService:
    """Get or create a MemoryService for the given workspace."""
    if workspace_path not in _memory_instances:
        _memory_instances[workspace_path] = MemoryService(workspace_path)
    return _memory_instances[workspace_path]