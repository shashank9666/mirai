from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import os
from typing import Optional

router = APIRouter()

class GitBranchRequest(BaseModel):
    cwd: Optional[str] = None

@router.post("/branch")
async def git_branch(req: GitBranchRequest):
    target_cwd = req.cwd or os.getcwd()
    try:
        result = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=target_cwd, capture_output=True, text=True)
        if result.returncode != 0:
            return {"branch": None, "error": "Not a git repository"}
            
        branch = result.stdout.strip()
        
        status_result = subprocess.run(["git", "status", "--porcelain"], cwd=target_cwd, capture_output=True, text=True)
        is_dirty = len(status_result.stdout.strip()) > 0
        
        return {"branch": branch, "dirty": is_dirty}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
