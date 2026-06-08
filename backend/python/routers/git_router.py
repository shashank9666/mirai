from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import os
from typing import Optional, List
from services.workspace import workspace_manager

router = APIRouter()

class GitCwdRequest(BaseModel):
    cwd: Optional[str] = None

def _get_cwd(cwd: Optional[str] = None) -> str:
    try:
        return workspace_manager.resolve_path(cwd) if cwd else workspace_manager.workspace_root
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

def _run_git(args: List[str], cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=30)

@router.post("/branch")
async def git_branch(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)
        if result.returncode != 0:
            return {"branch": None, "error": "Not a git repository"}
        branch = result.stdout.strip()
        status_result = _run_git(["status", "--porcelain"], cwd)
        is_dirty = len(status_result.stdout.strip()) > 0
        return {"branch": branch, "dirty": is_dirty}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/diff")
async def git_diff(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["diff"], cwd)
        return {"diff": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/diffStaged")
async def git_diff_staged(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["diff", "--cached"], cwd)
        return {"diff": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/status")
async def git_status(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["status", "--porcelain"], cwd)
        files = []
        for line in result.stdout.strip().splitlines():
            if len(line) >= 3:
                status_code = line[:2].strip()
                file_path = line[3:]
                files.append({"path": file_path, "status": status_code})
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/log")
async def git_log(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["log", "--oneline", "-20"], cwd)
        commits = []
        for line in result.stdout.strip().splitlines():
            if ' ' in line:
                sha, message = line.split(' ', 1)
                commits.append({"sha": sha, "message": message})
        return {"commits": commits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/commit")
async def git_commit(req: GitCwdRequest, message: str = ""):
    cwd = _get_cwd(req.cwd)
    if not message.strip():
        raise HTTPException(status_code=400, detail="Commit message is required")
    try:
        result = _run_git(["commit", "-m", message], cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/push")
async def git_push(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["push"], cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pull")
async def git_pull(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["pull"], cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stash")
async def git_stash(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["stash"], cwd)
        return {"success": result.returncode == 0, "output": result.stdout.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stashPop")
async def git_stash_pop(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["stash", "pop"], cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/branches")
async def git_branches(req: GitCwdRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["branch", "--list"], cwd)
        branches = [b.lstrip('* ').strip() for b in result.stdout.strip().splitlines() if b.strip()]
        return {"branches": branches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GitCheckoutRequest(BaseModel):
    branch: str
    cwd: Optional[str] = None

@router.post("/checkout")
async def git_checkout(req: GitCheckoutRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["checkout", req.branch], cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GitNewBranchRequest(BaseModel):
    branch: str
    cwd: Optional[str] = None

@router.post("/newBranch")
async def git_new_branch(req: GitNewBranchRequest):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["checkout", "-b", req.branch], cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add")
async def git_add(req: GitCwdRequest, files: str = "."):
    cwd = _get_cwd(req.cwd)
    try:
        result = _run_git(["add"] + files.split(), cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/addPatch")
async def git_add_patch(req: GitCwdRequest, file: str = ""):
    cwd = _get_cwd(req.cwd)
    try:
        args = ["add", "-p"] + ([file] if file else [])
        result = _run_git(args, cwd)
        return {"success": result.returncode == 0, "output": result.stdout + result.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
