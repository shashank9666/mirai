import os
import json
import difflib
from langchain_core.tools import tool
from services.workspace import workspace_manager

def _get_absolute_path(path: str) -> str:
    """Resolve a tool path strictly inside the active workspace."""
    return workspace_manager.resolve_path(path or "")

@tool
def list_directory(path: str = "") -> str:
    """List the contents of a directory. Returns a list of files and folders."""
    try:
        abs_path = _get_absolute_path(path)
        if not os.path.exists(abs_path):
            return f"Error: Directory {path} does not exist."
        if not os.path.isdir(abs_path):
            return f"Error: {path} is not a directory."
        
        entries = os.listdir(abs_path)
        return f"Contents of {path}:\n" + "\n".join(entries)
    except Exception as e:
        return f"Error listing directory: {str(e)}"

@tool
def read_file(path: str) -> str:
    """Read the contents of a file. Use this to inspect code or text files."""
    try:
        abs_path = _get_absolute_path(path)
        if not os.path.exists(abs_path):
            return f"Error: File {path} does not exist."
        if not os.path.isfile(abs_path):
            return f"Error: {path} is a directory, not a file."
            
        with open(abs_path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        return f"Error: {path} appears to be a binary file."
    except Exception as e:
        return f"Error reading file: {str(e)}"

@tool
def write_file(path: str, content: str) -> str:
    """Request approval to write or overwrite a file. Direct writes are blocked."""
    try:
        abs_path = _get_absolute_path(path)
        old_content = ""
        if os.path.exists(abs_path):
            if not os.path.isfile(abs_path):
                return f"Error: {path} is not a file."
            with open(abs_path, 'r', encoding='utf-8') as f:
                old_content = f.read()

        diff = "\n".join(difflib.unified_diff(
            old_content.splitlines(),
            content.splitlines(),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
            lineterm=""
        ))
        return json.dumps({
            "approval_required": True,
            "tool": "write_file",
            "path": workspace_manager.get_relative_path(abs_path),
            "oldContent": old_content,
            "newContent": content,
            "diff": diff,
            "message": "Direct agent writes are blocked. Present this diff to the user and write only after explicit approval."
        })
    except UnicodeDecodeError:
        return f"Error: {path} appears to be a binary file."
    except ValueError as e:
        return f"Error: {str(e)}"
    except Exception as e:
        return f"Error writing file: {str(e)}"

def register_fs_tools():
    """Register all file system tools with the tool registry."""
    from core.tool_registry import tool_registry
    tool_registry.register(list_directory)
    tool_registry.register(read_file)
    tool_registry.register(write_file)
