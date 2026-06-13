from flask import Blueprint, request, jsonify
import subprocess
import threading
import os
import uuid
import sys
from services.workspace import workspace_manager
from services.notifications import notify_user

bp = Blueprint("tasks", __name__)

tasks = {}

@bp.route("/executeCommand", methods=["POST"])
def execute_command():
    data = request.get_json() or {}
    command = data.get("command")
    cwd = data.get("cwd")
    if not command:
        return jsonify({"detail": "command is required"}), 400

    try:
        target_cwd = workspace_manager.resolve_path(cwd) if cwd else workspace_manager.workspace_root
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    
    is_long_running = any(k in command for k in ['dev', 'start', 'watch', 'serve', 'nodemon', 'server'])
    
    if is_long_running:
        task_id = "task-" + str(uuid.uuid4())[:8]
        
        shell = "powershell.exe" if sys.platform == "win32" else "bash"
        shell_args = ["-Command", command] if sys.platform == "win32" else ["-c", command]
        
        process = subprocess.Popen(
            [shell] + shell_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=target_cwd,
            text=False
        )
        
        tasks[task_id] = {
            "id": task_id,
            "command": command,
            "cwd": target_cwd,
            "status": "running",
            "logs": "",
            "process": process
        }
        
        def read_stream(stream, tid):
            try:
                for chunk in iter(lambda: stream.read(1024), b''):
                    if not chunk:
                        break
                    text = chunk.decode('utf-8', errors='replace')
                    tasks[tid]["logs"] += text
                    if len(tasks[tid]["logs"]) > 50000:
                        tasks[tid]["logs"] = tasks[tid]["logs"][-50000:]
            except Exception:
                pass

        def wait_process(proc, tid):
            code = proc.wait()
            status = "completed" if code == 0 else "failed"
            tasks[tid]["status"] = status
            tasks[tid]["logs"] += f"\n[Process exited with code {code}]"
            
            # Send notification
            command_preview = tasks[tid]["command"][:30] + ("..." if len(tasks[tid]["command"]) > 30 else "")
            notify_user(
                title=f"Task {status.capitalize()}",
                message=f"Command '{command_preview}' exited with code {code}."
            )
            
        threading.Thread(target=read_stream, args=(process.stdout, task_id), daemon=True).start()
        threading.Thread(target=read_stream, args=(process.stderr, task_id), daemon=True).start()
        threading.Thread(target=wait_process, args=(process, task_id), daemon=True).start()
        
        return jsonify({
            "success": True,
            "stdout": f"Command started in the background (Task ID: {task_id}).\nYou can view logs and manage it in the Tasks panel.",
            "stderr": "",
            "code": 0
        })
    else:
        shell = "powershell.exe" if sys.platform == "win32" else "bash"
        shell_args = ["-Command", command] if sys.platform == "win32" else ["-c", command]
        
        process = subprocess.Popen(
            [shell] + shell_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=target_cwd,
            text=False
        )
        
        stdout, stderr = process.communicate()
        return jsonify({
            "success": process.returncode == 0,
            "stdout": stdout.decode('utf-8', errors='replace'),
            "stderr": stderr.decode('utf-8', errors='replace'),
            "code": process.returncode
        })

@bp.route("/list", methods=["GET"])
def list_tasks():
    list_res = []
    for t in tasks.values():
        list_res.append({
            "id": t["id"],
            "command": t["command"],
            "cwd": t["cwd"],
            "status": t["status"],
            "logs": t["logs"]
        })
    return jsonify({"success": True, "tasks": list_res})

@bp.route("/kill", methods=["POST"])
def kill_task():
    data = request.get_json() or {}
    task_id = data.get("id")
    if not task_id:
        return jsonify({"detail": "id is required"}), 400
        
    task = tasks.get(task_id)
    if not task:
        return jsonify({"detail": "Task not found"}), 404
        
    if task["status"] == "running" and task["process"]:
        try:
            task["process"].kill()
            task["status"] = "killed"
            task["logs"] += "\n[Process killed by user]"
        except Exception as e:
            return jsonify({"detail": str(e)}), 500
            
    return jsonify({"success": True})
