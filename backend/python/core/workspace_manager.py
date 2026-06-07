import os
import aiofiles
from pathlib import Path
from typing import List, Optional

class WorkspaceManager:
    """
    Manages the workspace context, file operations, and safe AST edits.
    """
    def __init__(self, root_path: Optional[str] = None):
        self.root_path = root_path or os.getcwd()

    def set_root(self, path: str):
        if os.path.isdir(path):
            self.root_path = path
        else:
            raise ValueError(f"Invalid workspace path: {path}")

    def resolve_path(self, relative_path: str) -> str:
        """
        Safely resolve a path relative to the workspace root.
        Prevents directory traversal attacks.
        """
        full_path = os.path.abspath(os.path.join(self.root_path, relative_path))
        if not full_path.startswith(os.path.abspath(self.root_path)):
            raise PermissionError("Access denied: path is outside the workspace.")
        return full_path

    async def read_file(self, file_path: str) -> str:
        path = self.resolve_path(file_path)
        if not os.path.exists(path):
            raise FileNotFoundError(f"File not found: {path}")
            
        async with aiofiles.open(path, 'r', encoding='utf-8') as f:
            return await f.read()

    async def write_file(self, file_path: str, content: str):
        path = self.resolve_path(file_path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        async with aiofiles.open(path, 'w', encoding='utf-8') as f:
            await f.write(content)

    def list_files(self, directory: str = ".") -> List[str]:
        target = self.resolve_path(directory)
        results = []
        for root, dirs, files in os.walk(target):
            if '.git' in dirs: dirs.remove('.git')
            if 'node_modules' in dirs: dirs.remove('node_modules')
            for f in files:
                full_path = os.path.join(root, f)
                results.append(os.path.relpath(full_path, self.root_path))
        return results

# Global workspace manager instance
workspace_manager = WorkspaceManager()
