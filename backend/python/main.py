from flask import Flask, jsonify
from flask_cors import CORS
from flask_sock import Sock
import os

from routers import fs_router, web_router, tasks_router, git_router, agent_router, settings_router, workspace_router, mcp_router
from services import terminal, watcher, notifications

app = Flask("Mirai Backend")

# Allow all origins for Electron + dev
# Electron's file:// protocol sends "null" as origin, and we need both localhost and 127.0.0.1
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

terminal.setup_terminal_websockets(sock)
watcher.setup_watcher_websockets(sock)
notifications.setup_notifications_websockets(sock)

# Register FS tools for agent
from core.fs_tools import register_fs_tools
register_fs_tools()

if __name__ == "__main__":
    # In a real production setup you might use waitress or gunicorn,
    # but for local IDE backend, the built-in server is usually fine.
    # We use threaded=True for simultaneous connections and websockets.
    # We disable use_reloader on Windows because it causes the socket to hang with flask-sock.
    app.run(host="127.0.0.1", port=8000, debug=True, use_reloader=False, threaded=True)
