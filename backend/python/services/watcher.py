import asyncio
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from fastapi import WebSocket, WebSocketDisconnect
import json
import os

active_connections = set()

class WorkspaceHandler(FileSystemEventHandler):
    def on_created(self, event):
        asyncio.run(notify_change("createFile" if not event.is_directory else "createDir", event.src_path))
    
    def on_deleted(self, event):
        asyncio.run(notify_change("deleteItem", event.src_path))
        
    def on_modified(self, event):
        if not event.is_directory:
            asyncio.run(notify_change("writeFile", event.src_path))
            
    def on_moved(self, event):
        asyncio.run(notify_change("renameItem", event.src_path, event.dest_path))

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
    
    # Ignoring logic would be handled in the handler ideally, but simplified here
    observer.schedule(event_handler, workspace_path, recursive=True)
    observer.start()

async def notify_change(event_type, path, new_path=None):
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
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)
            
    for ws in disconnected:
        active_connections.remove(ws)

def setup_watcher_websockets(app):
    @app.websocket("/ws/watcher")
    async def watcher_endpoint(websocket: WebSocket):
        await websocket.accept()
        active_connections.add(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)
                if msg.get("event") == "watch-workspace":
                    workspace_path = msg.get("data", {}).get("workspacePath")
                    if workspace_path:
                        setup_watcher(workspace_path)
        except WebSocketDisconnect:
            active_connections.remove(websocket)
