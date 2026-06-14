from flask import Flask, jsonify
from flask_cors import CORS
from flask_sock import Sock
import os

from routers import fs_router, web_router, tasks_router, git_router, agent_router, settings_router, workspace_router, mcp_router
from routers import workflow_router, graph_router, session_router
from routers import voice_router, memory_router, proactive_router
from services import terminal, watcher, notifications, activity_feed
from services.background_analyzer import get_analyzer
from services.workspace import workspace_manager
from core.workflow_engine import set_on_update, list_workflows
from core.mcp_registry import registry as mcp_registry
from core.event_bus import event_bus
from core.memory_vector import MemoryVector
from core.session_memory import session_memory

app = Flask("Mirai Backend")

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Setup WebSockets
sock = Sock(app)

@app.route("/health", methods=["GET", "HEAD"])
def health():
    return jsonify({"status": "ok"})

app.register_blueprint(fs_router.bp, url_prefix="/api/fs")
app.register_blueprint(web_router.bp, url_prefix="/api/web")
app.register_blueprint(tasks_router.bp, url_prefix="/api/tasks")
app.register_blueprint(git_router.bp, url_prefix="/api/git")
app.register_blueprint(agent_router.bp, url_prefix="/api")
app.register_blueprint(settings_router.bp, url_prefix="/api/settings")
app.register_blueprint(workspace_router.bp, url_prefix="/api/workspace")
app.register_blueprint(mcp_router.bp, url_prefix="/api/mcp")
app.register_blueprint(workflow_router.bp, url_prefix="/api")
app.register_blueprint(graph_router.bp, url_prefix="/api")
app.register_blueprint(session_router.bp, url_prefix="/api")
app.register_blueprint(voice_router.bp, url_prefix="/api")
app.register_blueprint(memory_router.bp, url_prefix="/api")
app.register_blueprint(proactive_router.bp, url_prefix="/api")

terminal.setup_terminal_websockets(sock)
watcher.setup_watcher_websockets(sock)
notifications.setup_notifications_websockets(sock)
activity_feed.setup_activity_websockets(sock)

# Register FS tools for agent
from core.fs_tools import register_fs_tools
from core.command_tools import register_command_tools
register_fs_tools()
register_command_tools()

# -----------------------------------------------------------------------
# Initialize background systems (non-blocking)
# -----------------------------------------------------------------------
@app.before_request
def _initialize_extensions():
    """One-time initialization before first request."""
    if not getattr(app, '_initialized_extensions', False):
        app._initialized_extensions = True
        try:
            # Start session memory
            ws_path = workspace_manager.workspace_root or ""
            if ws_path:
                session_memory.start_session(ws_path)
                activity_feed.add_success(
                    "Session Restored",
                    f"Resumed workspace: {os.path.basename(ws_path)}",
                    category="workspace",
                    icon="checkmark"
                )
                # Connect enabled MCP servers
                results = mcp_registry.connect_all()
                for name, ok in results.items():
                    if ok:
                        activity_feed.add_info(
                            f"MCP Connected: {name}",
                            category="mcp",
                            icon="link"
                        )
        except Exception as e:
            print(f"[init] Non-blocking init error: {e}")

if __name__ == "__main__":
    # In a real production setup you might use waitress or gunicorn,
    # but for local IDE backend, the built-in server is usually fine.
    # We use threaded=True for simultaneous connections and websockets.
    # We disable use_reloader on Windows because it causes the socket to hang with flask-sock.
    app.run(host="0.0.0.0", port=8000, debug=True, use_reloader=False, threaded=True)
