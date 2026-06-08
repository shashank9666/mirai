from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import aiofiles
import shutil
import asyncio
import urllib.parse
from services.watcher import notify_change
from services.workspace import workspace_manager

router = APIRouter()

def resolve_safe_path(path: Optional[str]) -> str:
    """Resolve path through WorkspaceManager, ensuring workspace safety."""
    return workspace_manager.resolve_path(path or '')

class ReadDirRequest(BaseModel):
    dirPath: Optional[str] = None

@router.post("/readDir")
async def read_dir(req: ReadDirRequest):
    try:
        target_path = resolve_safe_path(req.dirPath)
        entries = []
        with os.scandir(target_path) as it:
            for entry in it:
                entries.append({
                    "name": entry.name,
                    "isDirectory": entry.is_dir(),
                    "path": entry.path
                })
        
        entries.sort(key=lambda x: (not x["isDirectory"], x["name"].lower()))
        return {"path": target_path, "entries": entries}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReadFileRequest(BaseModel):
    filePath: str

@router.post("/readFile")
async def read_file(req: ReadFileRequest):
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    try:
        safe_path = resolve_safe_path(req.filePath)
        async with aiofiles.open(safe_path, mode='r', encoding='utf-8') as f:
            content = await f.read()
        return {"content": content}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class WriteFileRequest(BaseModel):
    filePath: str
    content: str

@router.post("/writeFile")
async def write_file(req: WriteFileRequest):
    try:
        safe_path = resolve_safe_path(req.filePath)
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        async with aiofiles.open(safe_path, mode='w', encoding='utf-8') as f:
            await f.write(req.content)
        await notify_change('writeFile', safe_path)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateFileRequest(BaseModel):
    filePath: str

@router.post("/createFile")
async def create_file(req: CreateFileRequest):
    try:
        safe_path = resolve_safe_path(req.filePath)
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        async with aiofiles.open(safe_path, mode='w', encoding='utf-8') as f:
            await f.write('')
        await notify_change('createFile', safe_path)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateDirRequest(BaseModel):
    dirPath: str

@router.post("/createDir")
async def create_dir(req: CreateDirRequest):
    try:
        safe_path = resolve_safe_path(req.dirPath)
        os.makedirs(safe_path, exist_ok=True)
        await notify_change('createDir', safe_path)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RenameItemRequest(BaseModel):
    oldPath: str
    newPath: str

@router.post("/renameItem")
async def rename_item(req: RenameItemRequest):
    try:
        old_safe = resolve_safe_path(req.oldPath)
        new_safe = resolve_safe_path(req.newPath)
        os.makedirs(os.path.dirname(new_safe), exist_ok=True)
        os.rename(old_safe, new_safe)
        await notify_change('renameItem', old_safe, new_safe)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteItemRequest(BaseModel):
    targetPath: str

@router.post("/deleteItem")
async def delete_item(req: DeleteItemRequest):
    try:
        safe_path = resolve_safe_path(req.targetPath)
        if os.path.isdir(safe_path):
            shutil.rmtree(safe_path)
        else:
            os.remove(safe_path)
        await notify_change('deleteItem', safe_path)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SearchFilesRequest(BaseModel):
    dirPath: Optional[str] = None
    pattern: str

@router.post("/searchFiles")
async def search_files(req: SearchFilesRequest):
    import re
    try:
        target_path = resolve_safe_path(req.dirPath)
        regex = re.compile(req.pattern, re.IGNORECASE)
        results = []
        for root, dirs, files in os.walk(target_path):
            if 'node_modules' in dirs:
                dirs.remove('node_modules')
            if '.git' in dirs:
                dirs.remove('.git')

            for file in files:
                full_path = os.path.join(root, file)
                try:
                    async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
                        lines = await f.readlines()
                        matches = []
                        for i, line in enumerate(lines, 1):
                            if regex.search(line):
                                matches.append({"line": i, "text": line.rstrip()})
                        if matches:
                            results.append({
                                "path": os.path.relpath(full_path, workspace_manager.workspace_root),
                                "matches": matches,
                            })
                except Exception:
                    pass
        return {"success": True, "results": results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ListFilesRequest(BaseModel):
    dirPath: Optional[str] = None
    maxDepth: int = 3

@router.post("/listFiles")
async def list_files(req: ListFilesRequest):
    try:
        target_path = resolve_safe_path(req.dirPath)
        results = []
        
        def walk_dir(current_path, current_depth):
            if current_depth > req.maxDepth:
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
        return {"success": True, "results": results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

MIRAI_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.mirai')
BACKUP_DIR = os.path.join(MIRAI_DIR, 'backups')
os.makedirs(BACKUP_DIR, exist_ok=True)

class BackupRequest(BaseModel):
    filePath: str

@router.post("/backup")
async def backup_file(req: BackupRequest):
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    
    try:
        safe_path = resolve_safe_path(req.filePath)
        encoded_path = urllib.parse.quote(req.filePath, safe='')
        backup_path = os.path.join(BACKUP_DIR, encoded_path)
        
        exists = os.path.exists(safe_path)
        if exists:
            shutil.copy2(safe_path, backup_path)
            return {"success": True, "backupExists": True}
        else:
            with open(backup_path + '.newfile', 'w') as f:
                pass
            return {"success": True, "backupExists": False}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rollback")
async def rollback_file(req: BackupRequest):
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    
    try:
        safe_path = resolve_safe_path(req.filePath)
        encoded_path = urllib.parse.quote(req.filePath, safe='')
        backup_path = os.path.join(BACKUP_DIR, encoded_path)
        new_file_marker = backup_path + '.newfile'
        
        if os.path.exists(new_file_marker):
            if os.path.exists(safe_path):
                os.remove(safe_path)
            os.remove(new_file_marker)
            return {"success": True, "rolledBack": "deleted"}
        else:
            if os.path.exists(backup_path):
                shutil.copy2(backup_path, safe_path)
                os.remove(backup_path)
                await notify_change('writeFile', safe_path)
                return {"success": True, "rolledBack": "restored"}
            else:
                return {"success": False, "error": "No backup found"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/commit")
async def commit_file(req: BackupRequest):
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    
    try:
        encoded_path = urllib.parse.quote(req.filePath, safe='')
        backup_path = os.path.join(BACKUP_DIR, encoded_path)
        new_file_marker = backup_path + '.newfile'
        
        if os.path.exists(backup_path):
            os.remove(backup_path)
        if os.path.exists(new_file_marker):
            os.remove(new_file_marker)
            
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))