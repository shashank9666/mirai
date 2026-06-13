import os
from langchain_core.tools import tool
from routers.fs_router import BASE_DIR

def _get_absolute_path(path: str) -> str:
    """Helper to resolve paths strictly within BASE_DIR (if needed) or just return absolute."""
    if not path:
        return BASE_DIR
    if os.path.isabs(path):
        return path
    return os.path.abspath(os.path.join(BASE_DIR, path))

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
    """Write or overwrite the contents of a file. Use this to modify code."""
    try:
        abs_path = _get_absolute_path(path)
        # Ensure directory exists
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file: {str(e)}"

def register_fs_tools():
    """Register all file system tools with the tool registry."""
    from core.tool_registry import tool_registry
    tool_registry.register(list_directory)
    tool_registry.register(read_file)
    tool_registry.register(write_file)
