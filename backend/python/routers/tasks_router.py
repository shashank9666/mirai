from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import os
import uuid
import sys
from typing import Optional

router = APIRouter()

tasks = {}

class ExecuteCommandRequest(BaseModel):
    command: str
    cwd: Optional[str] = None

@router.post("/executeCommand")
async def execute_command(req: ExecuteCommandRequest):
    target_cwd = req.cwd or os.getcwd()
    
    is_long_running = any(k in req.command for k in ['dev', 'start', 'watch', 'serve', 'nodemon', 'server'])
    
    if is_long_running:
        task_id = "task-" + str(uuid.uuid4())[:8]
        
        shell = "powershell.exe" if sys.platform == "win32" else "bash"
        shell_args = ["-Command", req.command] if sys.platform == "win32" else ["-c", req.command]
        
        process = await asyncio.create_subprocess_exec(
            shell, *shell_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=target_cwd
        )
        
        tasks[task_id] = {
            "id": task_id,
            "command": req.command,
            "cwd": target_cwd,
            "status": "running",
            "logs": "",
            "process": process
        }
        
        async def read_stream(stream, task_id):
            while True:
                line = await stream.read(1024)
                if not line:
                    break
                text = line.decode('utf-8', errors='replace')
                tasks[task_id]["logs"] += text
                if len(tasks[task_id]["logs"]) > 50000:
                    tasks[task_id]["logs"] = tasks[task_id]["logs"][-50000:]
                    
        async def wait_process(process, task_id):
            code = await process.wait()
            tasks[task_id]["status"] = "completed" if code == 0 else "failed"
            tasks[task_id]["logs"] += f"\n[Process exited with code {code}]"
            
        asyncio.create_task(read_stream(process.stdout, task_id))
        asyncio.create_task(read_stream(process.stderr, task_id))
        asyncio.create_task(wait_process(process, task_id))
        
        return {
            "success": True,
            "stdout": f"Command started in the background (Task ID: {task_id}).\nYou can view logs and manage it in the Tasks panel.",
            "stderr": "",
            "code": 0
        }
    else:
        shell = "powershell.exe" if sys.platform == "win32" else "bash"
        shell_args = ["-Command", req.command] if sys.platform == "win32" else ["-c", req.command]
        
        process = await asyncio.create_subprocess_exec(
            shell, *shell_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=target_cwd
        )
        
        stdout, stderr = await process.communicate()
        return {
            "success": process.returncode == 0,
            "stdout": stdout.decode('utf-8', errors='replace'),
            "stderr": stderr.decode('utf-8', errors='replace'),
            "code": process.returncode
        }

@router.get("/list")
async def list_tasks():
    list_res = []
    for t in tasks.values():
        list_res.append({
            "id": t["id"],
            "command": t["command"],
            "cwd": t["cwd"],
            "status": t["status"],
            "logs": t["logs"]
        })
    return {"success": True, "tasks": list_res}

class KillTaskRequest(BaseModel):
    id: str

@router.post("/kill")
async def kill_task(req: KillTaskRequest):
    task = tasks.get(req.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task["status"] == "running" and task["process"]:
        try:
            task["process"].kill()
            task["status"] = "killed"
            task["logs"] += "\n[Process killed by user]"
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    return {"success": True}
