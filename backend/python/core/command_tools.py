import json
import subprocess
import sys
from langchain_core.tools import tool
from services.workspace import workspace_manager

SAFE_COMMAND_PREFIXES = (
    "npm test",
    "npm run test",
    "npm run lint",
    "npm run build",
    "npx tsc",
    "pytest",
    "python -m pytest",
    "git status",
    "git diff",
    "git log",
)

BLOCKED_TOKENS = (
    " rm ",
    " del ",
    " rmdir ",
    " remove-item",
    " git reset",
    " git checkout --",
    " format ",
    " shutdown",
)


def _is_safe_command(command: str) -> bool:
    normalized = " ".join(command.strip().lower().split())
    padded = f" {normalized} "
    if any(token in padded for token in BLOCKED_TOKENS):
        return False
    return any(normalized == prefix or normalized.startswith(prefix + " ") for prefix in SAFE_COMMAND_PREFIXES)


@tool
def execute_command(command: str, cwd: str = "") -> str:
    """Run a workspace command when settings allow it, otherwise return an approval request."""
    try:
        from core.agent import auto_approve_settings_var

        settings = auto_approve_settings_var.get()
        target_cwd = workspace_manager.resolve_path(cwd) if cwd else workspace_manager.workspace_root
        is_safe = _is_safe_command(command)
        can_execute = settings.get("executeAllCommands", False) or (
            is_safe and settings.get("executeSafeCommands", False)
        )

        if not can_execute:
            from core.approval_helper import request_and_wait_for_approval
            approved = request_and_wait_for_approval("execute_command", {
                "command": command,
                "cwd": workspace_manager.get_relative_path(target_cwd),
                "safe": is_safe
            })
            if not approved:
                return f"Error: Command execution '{command}' denied by user."

        shell = "powershell.exe" if sys.platform == "win32" else "bash"
        shell_args = ["-Command", command] if sys.platform == "win32" else ["-c", command]
        process = subprocess.Popen(
            [shell] + shell_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=target_cwd,
            text=True,
        )
        stdout, stderr = process.communicate(timeout=120)
        return json.dumps({
            "tool": "execute_command",
            "command": command,
            "cwd": workspace_manager.get_relative_path(target_cwd),
            "code": process.returncode,
            "stdout": stdout[-12000:],
            "stderr": stderr[-12000:],
            "success": process.returncode == 0,
        })
    except subprocess.TimeoutExpired:
        return json.dumps({
            "tool": "execute_command",
            "command": command,
            "error": "Command timed out after 120 seconds. Use a terminal/task for long-running commands."
        })
    except Exception as e:
        return f"Error executing command: {str(e)}"


def register_command_tools():
    """Register command tools with the tool registry."""
    from core.tool_registry import tool_registry
    tool_registry.register(execute_command)
