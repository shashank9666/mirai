from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import aiofiles
import shutil
import asyncio
from services.watcher import notify_change

router = APIRouter()

class ReadDirRequest(BaseModel):
    dirPath: Optional[str] = None

@router.post("/readDir")
async def read_dir(req: ReadDirRequest):
    target_path = req.dirPath or os.getcwd()
    try:
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReadFileRequest(BaseModel):
    filePath: str

@router.post("/readFile")
async def read_file(req: ReadFileRequest):
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    try:
        async with aiofiles.open(req.filePath, mode='r', encoding='utf-8') as f:
            content = await f.read()
        return {"content": content}
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
        async with aiofiles.open(req.filePath, mode='w', encoding='utf-8') as f:
            await f.write(req.content)
        await notify_change('writeFile', req.filePath)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateFileRequest(BaseModel):
    filePath: str

@router.post("/createFile")
async def create_file(req: CreateFileRequest):
    try:
        os.makedirs(os.path.dirname(req.filePath), exist_ok=True)
        async with aiofiles.open(req.filePath, mode='w', encoding='utf-8') as f:
            await f.write('')
        await notify_change('createFile', req.filePath)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateDirRequest(BaseModel):
    dirPath: str

@router.post("/createDir")
async def create_dir(req: CreateDirRequest):
    try:
        os.makedirs(req.dirPath, exist_ok=True)
        await notify_change('createDir', req.dirPath)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RenameItemRequest(BaseModel):
    oldPath: str
    newPath: str

@router.post("/renameItem")
async def rename_item(req: RenameItemRequest):
    try:
        os.rename(req.oldPath, req.newPath)
        await notify_change('renameItem', req.oldPath, req.newPath)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteItemRequest(BaseModel):
    targetPath: str

@router.post("/deleteItem")
async def delete_item(req: DeleteItemRequest):
    try:
        if os.path.isdir(req.targetPath):
            shutil.rmtree(req.targetPath)
        else:
            os.remove(req.targetPath)
        await notify_change('deleteItem', req.targetPath)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SearchFilesRequest(BaseModel):
    dirPath: Optional[str] = None
    pattern: str

@router.post("/searchFiles")
async def search_files(req: SearchFilesRequest):
    import re
    target_path = req.dirPath or os.getcwd()
    try:
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
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if regex.search(content):
                            results.append(full_path)
                except Exception:
                    pass # skip binary files
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ListFilesRequest(BaseModel):
    dirPath: Optional[str] = None
    maxDepth: int = 3

@router.post("/listFiles")
async def list_files(req: ListFilesRequest):
    target_path = req.dirPath or os.getcwd()
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

    try:
        walk_dir(target_path, 1)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Backup/Rollback (Simplified)
MIRAI_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.mirai')
BACKUP_DIR = os.path.join(MIRAI_DIR, 'backups')
os.makedirs(BACKUP_DIR, exist_ok=True)

class BackupRequest(BaseModel):
    filePath: str

@router.post("/backup")
async def backup_file(req: BackupRequest):
    import urllib.parse
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    
    encoded_path = urllib.parse.quote(req.filePath, safe='')
    backup_path = os.path.join(BACKUP_DIR, encoded_path)
    
    exists = os.path.exists(req.filePath)
    if exists:
        shutil.copy2(req.filePath, backup_path)
        return {"success": True, "backupExists": True}
    else:
        with open(backup_path + '.newfile', 'w') as f:
            pass
        return {"success": True, "backupExists": False}

@router.post("/rollback")
async def rollback_file(req: BackupRequest):
    import urllib.parse
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    
    encoded_path = urllib.parse.quote(req.filePath, safe='')
    backup_path = os.path.join(BACKUP_DIR, encoded_path)
    new_file_marker = backup_path + '.newfile'
    
    if os.path.exists(new_file_marker):
        if os.path.exists(req.filePath):
            os.remove(req.filePath)
        os.remove(new_file_marker)
        return {"success": True, "rolledBack": "deleted"}
    else:
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, req.filePath)
            os.remove(backup_path)
            await notify_change('writeFile', req.filePath)
            return {"success": True, "rolledBack": "restored"}
        else:
            return {"success": False, "error": "No backup found"}

@router.post("/commit")
async def commit_file(req: BackupRequest):
    import urllib.parse
    if not req.filePath:
        raise HTTPException(status_code=400, detail="filePath is required")
    
    encoded_path = urllib.parse.quote(req.filePath, safe='')
    backup_path = os.path.join(BACKUP_DIR, encoded_path)
    new_file_marker = backup_path + '.newfile'
    
    if os.path.exists(backup_path):
        os.remove(backup_path)
    if os.path.exists(new_file_marker):
        os.remove(new_file_marker)
        
    return {"success": True}
