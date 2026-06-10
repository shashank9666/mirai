from flask import Blueprint, request, jsonify
import subprocess
import os
from services.workspace import workspace_manager

bp = Blueprint("git", __name__)

def _get_cwd(cwd: str = None) -> str:
    try:
        return workspace_manager.resolve_path(cwd) if cwd else workspace_manager.workspace_root
    except ValueError as e:
        raise ValueError(str(e))

def _run_git(args: list, cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=30)

@bp.route("/branch", methods=["POST"])
def git_branch():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)
        if result.returncode != 0:
            return jsonify({"branch": None, "error": "Not a git repository"})
        branch = result.stdout.strip()
        status_result = _run_git(["status", "--porcelain"], cwd)
        is_dirty = len(status_result.stdout.strip()) > 0
        return jsonify({"branch": branch, "dirty": is_dirty})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/diff", methods=["POST"])
def git_diff():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["diff"], cwd)
        return jsonify({"diff": result.stdout})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/diffStaged", methods=["POST"])
def git_diff_staged():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["diff", "--cached"], cwd)
        return jsonify({"diff": result.stdout})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/status", methods=["POST"])
def git_status():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["status", "--porcelain"], cwd)
        files = []
        for line in result.stdout.strip().splitlines():
            if len(line) >= 3:
                status_code = line[:2].strip()
                file_path = line[3:]
                files.append({"path": file_path, "status": status_code})
        return jsonify({"files": files})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/log", methods=["POST"])
def git_log():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["log", "--oneline", "-20"], cwd)
        commits = []
        for line in result.stdout.strip().splitlines():
            if ' ' in line:
                sha, message = line.split(' ', 1)
                commits.append({"sha": sha, "message": message})
        return jsonify({"commits": commits})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/commit", methods=["POST"])
def git_commit():
    data = request.get_json() or {}
    message = data.get("message", "")
    if not message.strip():
        return jsonify({"detail": "Commit message is required"}), 400
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["commit", "-m", message], cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/push", methods=["POST"])
def git_push():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["push"], cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/pull", methods=["POST"])
def git_pull():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["pull"], cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/stash", methods=["POST"])
def git_stash():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["stash"], cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout.strip()})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/stashPop", methods=["POST"])
def git_stash_pop():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["stash", "pop"], cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/branches", methods=["POST"])
def git_branches():
    data = request.get_json() or {}
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["branch", "--list"], cwd)
        branches = [b.lstrip('* ').strip() for b in result.stdout.strip().splitlines() if b.strip()]
        return jsonify({"branches": branches})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/checkout", methods=["POST"])
def git_checkout():
    data = request.get_json() or {}
    branch = data.get("branch")
    if not branch:
        return jsonify({"detail": "branch is required"}), 400
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["checkout", branch], cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/newBranch", methods=["POST"])
def git_new_branch():
    data = request.get_json() or {}
    branch = data.get("branch")
    if not branch:
        return jsonify({"detail": "branch is required"}), 400
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["checkout", "-b", branch], cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/add", methods=["POST"])
def git_add():
    data = request.get_json() or {}
    files = data.get("files", ".")
    try:
        cwd = _get_cwd(data.get("cwd"))
        result = _run_git(["add"] + files.split(), cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/addPatch", methods=["POST"])
def git_add_patch():
    data = request.get_json() or {}
    file = data.get("file", "")
    try:
        cwd = _get_cwd(data.get("cwd"))
        args = ["add", "-p"] + ([file] if file else [])
        result = _run_git(args, cwd)
        return jsonify({"success": result.returncode == 0, "output": result.stdout + result.stderr})
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": str(e)}), 500
