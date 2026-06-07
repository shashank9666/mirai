import asyncio
from typing import Any, Dict, List, Callable, Awaitable
import uuid

class EventBus:
    """
    A simple async event bus for pub/sub messaging.
    Allows decoupling the agent's runtime from the streaming mechanisms (like SSE or WebSockets).
    """
    def __init__(self):
        self.subscribers: Dict[str, List[asyncio.Queue]] = {}

    def subscribe(self, topic: str) -> asyncio.Queue:
        """
        Subscribe to a specific topic. Returns an asyncio.Queue that will receive events.
        """
        if topic not in self.subscribers:
            self.subscribers[topic] = []
        
        queue = asyncio.Queue()
        self.subscribers[topic].append(queue)
        return queue

    def unsubscribe(self, topic: str, queue: asyncio.Queue):
        """
        Remove a subscription queue.
        """
        if topic in self.subscribers:
            if queue in self.subscribers[topic]:
                self.subscribers[topic].remove(queue)
            if not self.subscribers[topic]:
                del self.subscribers[topic]

    async def publish(self, topic: str, event: Any):
        """
        Publish an event to all subscribers of a topic.
        """
        if topic in self.subscribers:
            for queue in self.subscribers[topic]:
                await queue.put(event)

# Global singleton event bus
event_bus = EventBus()
