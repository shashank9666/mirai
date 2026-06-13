import os
from typing import Optional

class WorkspaceManager:
    def __init__(self, workspace_root: Optional[str] = None):
        self._workspace_root = os.path.abspath(workspace_root or os.getcwd())
        os.makedirs(self._workspace_root, exist_ok=True)
    
    @property
    def workspace_root(self) -> str:
        return self._workspace_root
    
    def set_workspace_root(self, path: str) -> None:
        self._workspace_root = os.path.abspath(path)
        os.makedirs(self._workspace_root, exist_ok=True)
    
    def resolve_path(self, path: str) -> str:
        """Resolve a path relative to workspace root, ensuring it stays within bounds."""
        if os.path.isabs(path):
            resolved = os.path.abspath(path)
        else:
            resolved = os.path.abspath(os.path.join(self._workspace_root, path))
        
        try:
            root_norm = os.path.normpath(os.path.normcase(os.path.abspath(self._workspace_root)))
            res_norm = os.path.normpath(os.path.normcase(os.path.abspath(resolved)))
            if not root_norm.endswith(os.sep):
                root_norm += os.sep
            if not res_norm.startswith(root_norm) and res_norm + os.sep != root_norm:
                raise ValueError(f"Path '{path}' attempts to escape workspace root. (Root: {root_norm}, Res: {res_norm})")
        except Exception as e:
            if "attempts to escape" in str(e):
                raise
            raise ValueError(f"Path '{path}' validation failed: {str(e)}")
        
        return resolved
    
    def is_within_workspace(self, path: str) -> bool:
        """Check if a path is within the workspace root."""
        try:
            root_norm = os.path.normpath(os.path.normcase(os.path.abspath(self._workspace_root)))
            res_norm = os.path.normpath(os.path.normcase(os.path.abspath(path)))
            if not root_norm.endswith(os.sep):
                root_norm += os.sep
            return res_norm.startswith(root_norm) or res_norm + os.sep == root_norm
        except Exception:
            return False
    
    def get_relative_path(self, path: str) -> str:
        """Get the relative path from workspace root."""
        resolved = self.resolve_path(path)
        return os.path.relpath(resolved, self._workspace_root)

workspace_manager = WorkspaceManager()