from flask import Blueprint, request, jsonify
import os
import string
from services.workspace import workspace_manager

bp = Blueprint("workspace", __name__)


@bp.route("/current", methods=["GET"])
def get_workspace():
    root = workspace_manager.workspace_root
    return jsonify({"path": root, "name": os.path.basename(root) if root else None})


@bp.route("/set", methods=["POST"])
def set_workspace():
    data = request.get_json() or {}
    path = data.get("path")
    if not path:
        return jsonify({"detail": "Missing path"}), 400
        
    resolved = os.path.abspath(path)
    if not os.path.isdir(resolved):
        return jsonify({"detail": "Path is not a valid directory"}), 400
        
    workspace_manager.set_workspace_root(resolved)
    return jsonify({"path": resolved, "name": os.path.basename(resolved)})

@bp.route("/pick", methods=["POST"])
def pick_workspace():
    import tkinter as tk
    from tkinter import filedialog
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder_path = filedialog.askdirectory(parent=root, title="Select Workspace Folder")
        root.destroy()
        if folder_path:
            resolved = os.path.abspath(folder_path)
            workspace_manager.set_workspace_root(resolved)
            return jsonify({"path": resolved, "name": os.path.basename(resolved)})
        return jsonify({"detail": "No folder selected"}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500


@bp.route("/listDrives", methods=["GET"])
def list_drives():
    if os.name == "nt":
        drives = []
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                drives.append({"name": drive, "label": f"Local Disk ({drive})"})
        return jsonify({"drives": drives})
    else:
        return jsonify({"drives": [{"name": "/", "label": "Root (/)", "type": "directory"}]})


@bp.route("/listDirectory", methods=["POST"])
def list_directory():
    data = request.get_json() or {}
    path = data.get("path")
    if not path:
        return jsonify({"detail": "Missing path"}), 400
        
    if not os.path.isdir(path):
        return jsonify({"detail": "Invalid directory"}), 400
    try:
        entries = []
        with os.scandir(path) as it:
            for entry in it:
                if entry.name.startswith("."):
                    continue
                entries.append({
                    "name": entry.name,
                    "isDirectory": entry.is_dir(),
                    "path": entry.path,
                })
        entries.sort(key=lambda x: (not x["isDirectory"], x["name"].lower()))
        return jsonify({"path": path, "entries": entries})
    except PermissionError:
        return jsonify({"detail": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"detail": str(e)}), 500
