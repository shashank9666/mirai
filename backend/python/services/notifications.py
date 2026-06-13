import json
import threading

class NotificationManager:
    def __init__(self):
        self.clients = set()
        self.lock = threading.Lock()

    def add_client(self, ws):
        with self.lock:
            self.clients.add(ws)

    def remove_client(self, ws):
        with self.lock:
            if ws in self.clients:
                self.clients.remove(ws)

    def notify(self, title, message):
        payload = json.dumps({"title": title, "message": message})
        with self.lock:
            dead_clients = set()
            for ws in self.clients:
                try:
                    ws.send(payload)
                except Exception:
                    dead_clients.add(ws)
            
            for ws in dead_clients:
                self.clients.remove(ws)

notification_manager = NotificationManager()

def notify_user(title: str, message: str):
    notification_manager.notify(title, message)

def setup_notifications_websockets(sock):
    @sock.route("/ws/notifications")
    def notifications_endpoint(ws):
        notification_manager.add_client(ws)
        try:
            while True:
                # Keep connection alive, though we only send.
                # If client disconnects, receive() will raise or return None
                data = ws.receive()
                if data is None:
                    break
        except Exception:
            pass
        finally:
            notification_manager.remove_client(ws)
