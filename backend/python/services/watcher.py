import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import json
import os

active_connections = set()
connections_lock = threading.Lock()

def _schedule_notify(event_type, path, new_path=None):
    """Notify all connected websockets directly from the watchdog thread."""
    notify_change(event_type, path, new_path)

class WorkspaceHandler(FileSystemEventHandler):
    def on_created(self, event):
        _schedule_notify("createFile" if not event.is_directory else "createDir", event.src_path)
    
    def on_deleted(self, event):
        _schedule_notify("deleteItem", event.src_path)
        
    def on_modified(self, event):
        if not event.is_directory:
            _schedule_notify("writeFile", event.src_path)
            
    def on_moved(self, event):
        _schedule_notify("renameItem", event.src_path, event.dest_path)

observer = None

def setup_watcher(workspace_path):
    global observer
    if observer:
        observer.stop()
        observer.join()
        
    if not workspace_path:
        return
        
    observer = Observer()
    event_handler = WorkspaceHandler()
    
    observer.schedule(event_handler, workspace_path, recursive=True)
    observer.start()

def notify_change(event_type, path, new_path=None):
    with connections_lock:
        if not active_connections:
            return
        
        data = {"type": event_type, "path": path}
        if new_path:
            data["oldPath"] = path
            data["newPath"] = new_path
            
        message = json.dumps({"event": "workspace:change", "data": data})
        
        disconnected = set()
        for ws in active_connections:
            try:
                ws.send(message)
            except Exception:
                disconnected.add(ws)
                
        for ws in disconnected:
            active_connections.remove(ws)

def setup_watcher_websockets(sock):
    @sock.route("/ws/watcher")
    def watcher_endpoint(ws):
        with connections_lock:
            active_connections.add(ws)
        try:
            while True:
                data = ws.receive()
                if data is None:
                    break
                try:
                    msg = json.loads(data)
                except Exception:
                    continue
                
                if msg.get("event") == "watch-workspace":
                    workspace_path = msg.get("data", {}).get("workspacePath")
                    if workspace_path:
                        setup_watcher(workspace_path)
        except Exception:
            pass
        finally:
            with connections_lock:
                if ws in active_connections:
                    active_connections.remove(ws)
