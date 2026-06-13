"""
Session Memory — persistent, resume-aware session storage.

When the IDE opens:
  - Recalls the last project, task, errors, and fixes
  - Allows the agent to resume where it left off
  - Stores conversation history, recent workflows, and file changes

Uses SQLite under ~/.mirai/sessions.db
"""

from __future__ import annotations
import os
import json
import sqlite3
import threading
import time
import uuid
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


MIRAI_DIR = os.path.join(os.path.expanduser("~"), '.mirai')
SESSION_DB_PATH = os.path.join(MIRAI_DIR, 'sessions.db')


@dataclass
class Session:
    """A persistent session representing a workspace + agent state."""
    id: str = field(default_factory=lambda: f"session-{uuid.uuid4().hex[:12]}")
    workspace_path: str = ""
    started_at: float = field(default_factory=time.time)
    last_active_at: float = field(default_factory=time.time)
    last_request: str = ""
    last_workflow_id: str = ""
    last_errors: List[str] = field(default_factory=list)
    last_fixes: List[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    is_active: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


class SessionMemory:
    """
    Manages persistent sessions with resume capability.
    Thread-safe with SQLite backend.
    """

    def __init__(self):
        os.makedirs(MIRAI_DIR, exist_ok=True)
        self.lock = threading.Lock()
        self._current_session: Optional[Session] = None
        self._init_db()

    def _init_db(self):
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    workspace_path TEXT NOT NULL DEFAULT '',
                    started_at REAL NOT NULL,
                    last_active_at REAL NOT NULL,
                    last_request TEXT DEFAULT '',
                    last_workflow_id TEXT DEFAULT '',
                    last_errors TEXT DEFAULT '[]',
                    last_fixes TEXT DEFAULT '[]',
                    metadata TEXT DEFAULT '{}',
                    is_active INTEGER DEFAULT 1
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS session_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    metadata TEXT DEFAULT '{}'
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_session
                ON session_messages(session_id, timestamp)
            """)
            conn.commit()
            conn.close()

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def start_session(self, workspace_path: str = "") -> Session:
        """Start a new session or resume the most recent one."""
        # Check if there's a recent active session for this workspace
        recent = self.get_recent_session(workspace_path)
        if recent:
            self._current_session = recent
            self._touch_session(recent.id)
            return recent

        # Create new session
        session = Session(workspace_path=workspace_path)
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute("""
                INSERT INTO sessions (id, workspace_path, started_at, last_active_at,
                                      last_request, last_workflow_id, last_errors,
                                      last_fixes, metadata, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session.id, session.workspace_path, session.started_at,
                session.last_active_at, session.last_request,
                session.last_workflow_id,
                json.dumps(session.last_errors),
                json.dumps(session.last_fixes),
                json.dumps(session.metadata),
                1
            ))
            conn.commit()
            conn.close()

        self._current_session = session
        return session

    def get_current_session(self) -> Optional[Session]:
        return self._current_session

    def get_recent_session(self, workspace_path: str = "") -> Optional[Session]:
        """Find the most recent active session, optionally for a workspace."""
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            if workspace_path:
                cursor = conn.execute(
                    "SELECT * FROM sessions WHERE workspace_path = ? AND is_active = 1 "
                    "ORDER BY last_active_at DESC LIMIT 1",
                    (workspace_path,)
                )
            else:
                cursor = conn.execute(
                    "SELECT * FROM sessions WHERE is_active = 1 "
                    "ORDER BY last_active_at DESC LIMIT 1"
                )
            row = cursor.fetchone()
            conn.close()

        if row:
            return self._row_to_session(row)
        return None

    def list_sessions(self, limit: int = 20) -> List[Session]:
        """List recent sessions."""
        sessions = []
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            cursor = conn.execute(
                "SELECT * FROM sessions ORDER BY last_active_at DESC LIMIT ?",
                (limit,)
            )
            for row in cursor.fetchall():
                sessions.append(self._row_to_session(row))
            conn.close()
        return sessions

    def _touch_session(self, session_id: str):
        """Update the last_active_at timestamp."""
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "UPDATE sessions SET last_active_at = ? WHERE id = ?",
                (time.time(), session_id)
            )
            conn.commit()
            conn.close()

    def close_session(self, session_id: Optional[str] = None):
        """Mark a session as inactive."""
        sid = session_id or (self._current_session.id if self._current_session else None)
        if not sid:
            return
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "UPDATE sessions SET is_active = 0, last_active_at = ? WHERE id = ?",
                (time.time(), sid)
            )
            conn.commit()
            conn.close()

        if self._current_session and self._current_session.id == sid:
            self._current_session = None

    # ------------------------------------------------------------------
    # Session data updates
    # ------------------------------------------------------------------

    def update_last_request(self, request: str):
        """Store the last user request for resume context."""
        session = self._current_session
        if not session:
            return
        session.last_request = request
        session.last_active_at = time.time()
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "UPDATE sessions SET last_request = ?, last_active_at = ? WHERE id = ?",
                (request, session.last_active_at, session.id)
            )
            conn.commit()
            conn.close()

    def update_last_workflow(self, workflow_id: str):
        """Track the last workflow run."""
        session = self._current_session
        if not session:
            return
        session.last_workflow_id = workflow_id
        session.last_active_at = time.time()
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "UPDATE sessions SET last_workflow_id = ?, last_active_at = ? WHERE id = ?",
                (workflow_id, session.last_active_at, session.id)
            )
            conn.commit()
            conn.close()

    def add_error(self, error: str):
        """Record an error for resume awareness."""
        session = self._current_session
        if not session:
            return
        session.last_errors.append(error)
        if len(session.last_errors) > 20:
            session.last_errors = session.last_errors[-20:]
        session.last_active_at = time.time()
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "UPDATE sessions SET last_errors = ?, last_active_at = ? WHERE id = ?",
                (json.dumps(session.last_errors), session.last_active_at, session.id)
            )
            conn.commit()
            conn.close()

    def add_fix(self, fix: str):
        """Record a fix applied."""
        session = self._current_session
        if not session:
            return
        session.last_fixes.append(fix)
        if len(session.last_fixes) > 20:
            session.last_fixes = session.last_fixes[-20:]
        session.last_active_at = time.time()
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "UPDATE sessions SET last_fixes = ?, last_active_at = ? WHERE id = ?",
                (json.dumps(session.last_fixes), session.last_active_at, session.id)
            )
            conn.commit()
            conn.close()

    def update_metadata(self, key: str, value: Any):
        """Store arbitrary metadata (e.g., last viewed file, current branch)."""
        session = self._current_session
        if not session:
            return
        session.metadata[key] = value
        session.last_active_at = time.time()
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "UPDATE sessions SET metadata = ?, last_active_at = ? WHERE id = ?",
                (json.dumps(session.metadata), session.last_active_at, session.id)
            )
            conn.commit()
            conn.close()

    # ------------------------------------------------------------------
    # Message history
    # ------------------------------------------------------------------

    def add_message(self, session_id: str, role: str, content: str,
                    metadata: Optional[dict] = None):
        """Store a conversation message."""
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute("""
                INSERT INTO session_messages (session_id, role, content, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, role, content, time.time(),
                  json.dumps(metadata or {})))
            conn.commit()
            conn.close()

    def get_messages(self, session_id: str, limit: int = 100) -> List[dict]:
        """Retrieve recent conversation messages."""
        messages = []
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            cursor = conn.execute(
                "SELECT role, content, timestamp, metadata FROM session_messages "
                "WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?",
                (session_id, limit)
            )
            for row in cursor.fetchall():
                messages.append({
                    "role": row[0],
                    "content": row[1],
                    "timestamp": row[2],
                    "metadata": json.loads(row[3] or '{}'),
                })
            conn.close()
        return list(reversed(messages))  # chronological order

    def clear_messages(self, session_id: str):
        """Clear all messages for a session."""
        with self.lock:
            conn = sqlite3.connect(SESSION_DB_PATH)
            conn.execute(
                "DELETE FROM session_messages WHERE session_id = ?",
                (session_id,)
            )
            conn.commit()
            conn.close()

    # ------------------------------------------------------------------
    # Resume data
    # ------------------------------------------------------------------

    def get_resume_context(self, workspace_path: str = "") -> dict:
        """
        Returns everything needed to resume a session.
        Used by the agent to get context on startup.
        """
        session = self.get_recent_session(workspace_path)
        if not session:
            return {"has_session": False}

        messages = self.get_messages(session.id, limit=20)
        return {
            "has_session": True,
            "session": session.to_dict(),
            "recent_messages": messages,
            "resume_prompt": self._build_resume_prompt(session),
        }

    def _build_resume_prompt(self, session: Session) -> str:
        """Build a natural language summary of where things left off."""
        parts = ["## Previous Session Context\n"]

        if session.last_request:
            parts.append(f"Last request: \"{session.last_request}\"")

        if session.last_workflow_id:
            parts.append(f"Last workflow: {session.last_workflow_id}")

        if session.last_errors:
            parts.append(f"Last errors ({len(session.last_errors)}):")
            for err in session.last_errors[-5:]:
                parts.append(f"  - {err[:200]}")

        if session.last_fixes:
            parts.append(f"Recent fixes ({len(session.last_fixes)}):")
            for fix in session.last_fixes[-5:]:
                parts.append(f"  - {fix[:200]}")

        if session.metadata:
            parts.append(f"Context: {json.dumps(session.metadata, indent=2)}")

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _row_to_session(row) -> Session:
        return Session(
            id=row[0],
            workspace_path=row[1],
            started_at=row[2],
            last_active_at=row[3],
            last_request=row[4],
            last_workflow_id=row[5],
            last_errors=json.loads(row[6] or '[]'),
            last_fixes=json.loads(row[7] or '[]'),
            metadata=json.loads(row[8] or '{}'),
            is_active=bool(row[9]),
        )


# Global singleton
session_memory = SessionMemory()