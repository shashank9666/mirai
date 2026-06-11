from flask import Blueprint, request, jsonify
import os
import shutil
import urllib.parse
from services.watcher import notify_change
from services.workspace import workspace_manager

bp = Blueprint("fs", __name__)

def resolve_safe_path(path: str) -> str:
    """Resolve path through WorkspaceManager, ensuring workspace safety."""
    return workspace_manager.resolve_path(path or '')

@bp.route("/readDir", methods=["POST"])
def read_dir():
    data = request.get_json() or {}
    dir_path = data.get("dirPath")
    try:
        target_path = resolve_safe_path(dir_path)
        entries = []
        with os.scandir(target_path) as it:
            for entry in it:
                entries.append({
                    "name": entry.name,
                    "isDirectory": entry.is_dir(),
                    "path": entry.path
                })
        
        entries.sort(key=lambda x: (not x["isDirectory"], x["name"].lower()))
        return jsonify({"path": target_path, "entries": entries})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/readFile", methods=["POST"])
def read_file():
    data = request.get_json() or {}
    file_path = data.get("filePath")
    if not file_path:
        return jsonify({"detail": "filePath is required"}), 400
    try:
        safe_path = resolve_safe_path(file_path)
        with open(safe_path, mode='r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"content": content})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except FileNotFoundError:
        return jsonify({"detail": "File not found"}), 404
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/writeFile", methods=["POST"])
def write_file():
    data = request.get_json() or {}
    file_path = data.get("filePath")
    content = data.get("content", "")
    if not file_path:
        return jsonify({"detail": "filePath is required"}), 400
    try:
        safe_path = resolve_safe_path(file_path)
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, mode='w', encoding='utf-8') as f:
            f.write(content)
        notify_change('writeFile', safe_path)
        return jsonify({"success": True})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/createFile", methods=["POST"])
def create_file():
    data = request.get_json() or {}
    file_path = data.get("filePath")
    if not file_path:
        return jsonify({"detail": "filePath is required"}), 400
    try:
        safe_path = resolve_safe_path(file_path)
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, mode='w', encoding='utf-8') as f:
            f.write('')
        notify_change('createFile', safe_path)
        return jsonify({"success": True})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/createDir", methods=["POST"])
def create_dir():
    data = request.get_json() or {}
    dir_path = data.get("dirPath")
    if not dir_path:
        return jsonify({"detail": "dirPath is required"}), 400
    try:
        safe_path = resolve_safe_path(dir_path)
        os.makedirs(safe_path, exist_ok=True)
        notify_change('createDir', safe_path)
        return jsonify({"success": True})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/renameItem", methods=["POST"])
def rename_item():
    data = request.get_json() or {}
    old_path = data.get("oldPath")
    new_path = data.get("newPath")
    if not old_path or not new_path:
        return jsonify({"detail": "oldPath and newPath are required"}), 400
    try:
        old_safe = resolve_safe_path(old_path)
        new_safe = resolve_safe_path(new_path)
        os.makedirs(os.path.dirname(new_safe), exist_ok=True)
        os.rename(old_safe, new_safe)
        notify_change('renameItem', old_safe, new_safe)
        return jsonify({"success": True})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/deleteItem", methods=["POST"])
def delete_item():
    data = request.get_json() or {}
    target_path = data.get("targetPath")
    if not target_path:
        return jsonify({"detail": "targetPath is required"}), 400
    try:
        safe_path = resolve_safe_path(target_path)
        if os.path.isdir(safe_path):
            shutil.rmtree(safe_path)
        else:
            os.remove(safe_path)
        notify_change('deleteItem', safe_path)
        return jsonify({"success": True})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/searchFiles", methods=["POST"])
def search_files():
    import re
    import fnmatch
    data = request.get_json() or {}
    dir_path = data.get("dirPath")
    pattern = data.get("pattern")
    includes = data.get("includes", "")
    
    if not pattern:
        return jsonify({"detail": "pattern is required"}), 400
        
    try:
        target_path = resolve_safe_path(dir_path)
        regex = re.compile(pattern, re.IGNORECASE)
        results = []
        
        # Parse includes (comma separated globs)
        include_patterns = [p.strip() for p in includes.split(",")] if includes else []
        
        binary_extensions = {
            '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.zip', '.tar', '.gz',
            '.mp3', '.mp4', '.avi', '.mkv', '.exe', '.dll', '.so', '.dylib', '.pyc', '.class', '.ttf', '.woff', '.woff2'
        }

        for root, dirs, files in os.walk(target_path):
            # Ignore common heavy directories
            ignored_dirs = {'node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'coverage', '.mirai'}
            dirs[:] = [d for d in dirs if d not in ignored_dirs]

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in binary_extensions:
                    continue
                    
                # Check includes filter
                if include_patterns:
                    if not any(fnmatch.fnmatch(file, p) for p in include_patterns):
                        continue

                full_path = os.path.join(root, file)
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        matches = []
                        for i, line in enumerate(lines, 1):
                            if regex.search(line):
                                matches.append({"line": i, "text": line.rstrip()[:200]}) # Limit text length to prevent giant lines
                        if matches:
                            results.append({
                                "path": os.path.relpath(full_path, workspace_manager.workspace_root),
                                "matches": matches,
                            })
                except UnicodeDecodeError:
                    pass # Likely a binary file we didn't catch
                except Exception:
                    pass
        return jsonify({"success": True, "results": results})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/listFiles", methods=["POST"])
def list_files():
    data = request.get_json() or {}
    dir_path = data.get("dirPath")
    max_depth = data.get("maxDepth", 3)
    try:
        target_path = resolve_safe_path(dir_path)
        results = []
        
        def walk_dir(current_path, current_depth):
            if current_depth > max_depth:
                return
            try:
                with os.scandir(current_path) as it:
                    for entry in it:
                        if entry.name in ['node_modules', '.git']:
                            continue
                        results.append(entry.path)
                        if entry.is_dir():
                            walk_dir(entry.path, current_depth + 1)
            except Exception:
                pass
        
        walk_dir(target_path, 1)
        return jsonify({"success": True, "results": results})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

MIRAI_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.mirai')
BACKUP_DIR = os.path.join(MIRAI_DIR, 'backups')
os.makedirs(BACKUP_DIR, exist_ok=True)

@bp.route("/backup", methods=["POST"])
def backup_file():
    data = request.get_json() or {}
    file_path = data.get("filePath")
    if not file_path:
        return jsonify({"detail": "filePath is required"}), 400
    
    try:
        safe_path = resolve_safe_path(file_path)
        encoded_path = urllib.parse.quote(file_path, safe='')
        backup_path = os.path.join(BACKUP_DIR, encoded_path)
        
        exists = os.path.exists(safe_path)
        if exists:
            shutil.copy2(safe_path, backup_path)
            return jsonify({"success": True, "backupExists": True})
        else:
            with open(backup_path + '.newfile', 'w') as f:
                pass
            return jsonify({"success": True, "backupExists": False})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/rollback", methods=["POST"])
def rollback_file():
    data = request.get_json() or {}
    file_path = data.get("filePath")
    if not file_path:
        return jsonify({"detail": "filePath is required"}), 400
    
    try:
        safe_path = resolve_safe_path(file_path)
        encoded_path = urllib.parse.quote(file_path, safe='')
        backup_path = os.path.join(BACKUP_DIR, encoded_path)
        new_file_marker = backup_path + '.newfile'
        
        if os.path.exists(new_file_marker):
            if os.path.exists(safe_path):
                os.remove(safe_path)
            os.remove(new_file_marker)
            return jsonify({"success": True, "rolledBack": "deleted"})
        else:
            if os.path.exists(backup_path):
                shutil.copy2(backup_path, safe_path)
                os.remove(backup_path)
                notify_change('writeFile', safe_path)
                return jsonify({"success": True, "rolledBack": "restored"})
            else:
                return jsonify({"success": False, "error": "No backup found"})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/commit", methods=["POST"])
def commit_file():
    data = request.get_json() or {}
    file_path = data.get("filePath")
    if not file_path:
        return jsonify({"detail": "filePath is required"}), 400
    
    try:
        encoded_path = urllib.parse.quote(file_path, safe='')
        backup_path = os.path.join(BACKUP_DIR, encoded_path)
        new_file_marker = backup_path + '.newfile'
        
        if os.path.exists(backup_path):
            os.remove(backup_path)
        if os.path.exists(new_file_marker):
            os.remove(new_file_marker)
            
        return jsonify({"success": True})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500