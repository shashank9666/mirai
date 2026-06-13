"""
Activity Feed — real-time stream of workspace events for the Activity panel.

Instead of giant chat logs, the Activity panel shows:
  ✓ Indexed Workspace
  ✓ Found 12 Errors
  ✓ Generated Plan
  ✓ Fixed 9 Files
  ✓ Build Passed

Events are stored in-memory and broadcast via WebSocket.
"""

from __future__ import annotations
import time
import json
import threading
import uuid
from typing import List, Dict, Optional, Callable, Set
from dataclasses import dataclass, field, asdict


@dataclass
class ActivityEvent:
    """A single activity feed entry."""
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:10])
    type: str = ""          # "info", "success", "warning", "error", "progress"
    icon: str = ""          # "checkmark", "warning", "x", "gear", "search", "code", "git", etc.
    title: str = ""         # Short description (e.g., "Indexed Workspace")
    message: str = ""       # Longer details
    category: str = ""      # "workspace", "agent", "workflow", "git", "build", "file", "mcp"
    timestamp: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)
    dismissed: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


class ActivityFeed:
    """
    Tracks activity events and broadcasts them to connected WebSocket clients.
    """

    def __init__(self, max_events: int = 200):
        self.events: List[ActivityEvent] = []
        self.max_events = max_events
        self.lock = threading.Lock()
        self._listeners: Set[Callable[[ActivityEvent], None]] = set()

    def add_event(self, type: str, icon: str, title: str,
                  message: str = "", category: str = "",
                  metadata: Optional[dict] = None) -> ActivityEvent:
        """Add a new activity event and notify listeners."""
        event = ActivityEvent(
            type=type, icon=icon, title=title,
            message=message, category=category,
            metadata=metadata or {},
        )
        with self.lock:
            self.events.append(event)
            if len(self.events) > self.max_events:
                self.events = self.events[-self.max_events:]

        # Notify WebSocket listeners
        for listener in self._listeners:
            try:
                listener(event)
            except Exception:
                pass

        return event

    def add_info(self, title: str, message: str = "", category: str = "",
                 icon: str = "info") -> ActivityEvent:
        return self.add_event("info", icon, title, message, category)

    def add_success(self, title: str, message: str = "", category: str = "",
                    icon: str = "checkmark") -> ActivityEvent:
        return self.add_event("success", icon, title, message, category)

    def add_warning(self, title: str, message: str = "", category: str = "",
                    icon: str = "warning") -> ActivityEvent:
        return self.add_event("warning", icon, title, message, category)

    def add_error(self, title: str, message: str = "", category: str = "",
                  icon: str = "x") -> ActivityEvent:
        return self.add_event("error", icon, title, message, category)

    def add_progress(self, title: str, message: str = "", category: str = "",
                     icon: str = "gear") -> ActivityEvent:
        return self.add_event("progress", icon, title, message, category)

    def get_events(self, limit: int = 50, category: Optional[str] = None,
                   since: Optional[float] = None) -> List[dict]:
        """Get recent events, optionally filtered."""
        with self.lock:
            filtered = list(self.events)
            if category:
                filtered = [e for e in filtered if e.category == category]
            if since:
                filtered = [e for e in filtered if e.timestamp > since]
            filtered = filtered[-limit:]
            return [e.to_dict() for e in reversed(filtered)]

    def dismiss_event(self, event_id: str) -> bool:
        """Mark an event as dismissed."""
        with self.lock:
            for event in self.events:
                if event.id == event_id:
                    event.dismissed = True
                    return True
        return False

    def clear(self):
        """Clear all events."""
        with self.lock:
            self.events.clear()

    def subscribe(self, listener: Callable[[ActivityEvent], None]):
        """Register a callback for new events."""
        self._listeners.add(listener)

    def unsubscribe(self, listener: Callable[[ActivityEvent], None]):
        self._listeners.discard(listener)


# Global singleton
activity_feed = ActivityFeed()


def setup_activity_websockets(sock):
    """Register WebSocket endpoint for activity feed."""
    active_connections = set()
    connections_lock = threading.Lock()

    # Listen to new events and broadcast
    def broadcast_event(event: ActivityEvent):
        data = json.dumps({"event": "activity:new", "data": event.to_dict()})
        with connections_lock:
            disconnected = set()
            for ws in active_connections:
                try:
                    ws.send(data)
                except Exception:
                    disconnected.add(ws)
            for ws in disconnected:
                active_connections.discard(ws)

    activity_feed.subscribe(broadcast_event)

    @sock.route("/ws/activity")
    def activity_endpoint(ws):
        with connections_lock:
            active_connections.add(ws)
        try:
            while True:
                data = ws.receive()
                if data is None:
                    break
                try:
                    msg = json.loads(data)
                    if msg.get("event") == "get-events":
                        limit = msg.get("data", {}).get("limit", 50)
                        category = msg.get("data", {}).get("category")
                        events = activity_feed.get_events(limit, category)
                        ws.send(json.dumps({
                            "event": "activity:events",
                            "data": events
                        }))
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            with connections_lock:
                if ws in active_connections:
                    active_connections.remove(ws)