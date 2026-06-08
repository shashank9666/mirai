from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import string
from services.workspace import workspace_manager

router = APIRouter()


class SetWorkspaceRequest(BaseModel):
    path: str


@router.get("/current")
async def get_workspace():
    root = workspace_manager.workspace_root
    return {"path": root, "name": os.path.basename(root) if root else None}


@router.post("/set")
async def set_workspace(req: SetWorkspaceRequest):
    resolved = os.path.abspath(req.path)
    if not os.path.isdir(resolved):
        raise HTTPException(status_code=400, detail="Path is not a valid directory")
    workspace_manager.set_workspace_root(resolved)
    return {"path": resolved, "name": os.path.basename(resolved)}


@router.get("/listDrives")
async def list_drives():
    if os.name == "nt":
        drives = []
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                drives.append({"name": drive, "label": f"Local Disk ({drive})"})
        return {"drives": drives}
    else:
        return {"drives": [{"name": "/", "label": "Root (/)", "type": "directory"}]}


@router.post("/listDirectory")
async def list_directory(req: SetWorkspaceRequest):
    path = req.path
    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="Invalid directory")
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
        return {"path": path, "entries": entries}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
