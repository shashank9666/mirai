import asyncio
import threading
from typing import Any, Dict, List, Callable, Awaitable
import uuid
from datetime import datetime

def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if hasattr(value, "model_dump") and callable(value.model_dump):
        try:
            return _json_safe(value.model_dump())
        except Exception:
            return str(value)
    if hasattr(value, "dict") and callable(value.dict):
        try:
            return _json_safe(value.dict())
        except Exception:
            return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)

class EventBus:
    """
    A simple async event bus for pub/sub messaging.
    Allows decoupling the agent's runtime from the streaming mechanisms (like SSE or WebSockets).
    """
    def __init__(self):
        self.subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._lock = threading.RLock()

    def subscribe(self, topic: str) -> asyncio.Queue:
        """
        Subscribe to a specific topic. Returns an asyncio.Queue that will receive events.
        """
        queue = asyncio.Queue()
        with self._lock:
            if topic not in self.subscribers:
                self.subscribers[topic] = []
            self.subscribers[topic].append(queue)
        return queue

    def unsubscribe(self, topic: str, queue: asyncio.Queue):
        """
        Remove a subscription queue.
        """
        with self._lock:
            if topic in self.subscribers:
                if queue in self.subscribers[topic]:
                    self.subscribers[topic].remove(queue)
                if not self.subscribers[topic]:
                    del self.subscribers[topic]

    async def publish(self, topic: str, event: Any):
        """
        Publish an event to all subscribers of a topic.
        """
        event = _json_safe(event)
        with self._lock:
            queues = list(self.subscribers.get(topic, []))
        for queue in queues:
            await queue.put(event)

# Global singleton event bus
event_bus = EventBus()
