from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
import time
from typing import Any, Dict, Optional, List
import aiofiles
from fastapi.responses import StreamingResponse
import asyncio
import uuid
from services.watcher import notify_change
from core.agent import MiraiAgent
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage

router = APIRouter()

MIRAI_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.mirai')
SESSIONS_DIR = os.path.join(MIRAI_DIR, 'sessions')
APPROVALS_FILE = os.path.join(MIRAI_DIR, 'approvals.json')

os.makedirs(SESSIONS_DIR, exist_ok=True)

approvals = {}

def load_approvals():
    global approvals
    try:
        if os.path.exists(APPROVALS_FILE):
            with open(APPROVALS_FILE, 'r', encoding='utf-8') as f:
                approvals = json.load(f)
    except Exception:
        approvals = {}

def save_approvals():
    try:
        with open(APPROVALS_FILE, 'w', encoding='utf-8') as f:
            json.dump(approvals, f, indent=2)
    except Exception:
        pass

load_approvals()

class RegisterApprovalRequest(BaseModel):
    id: str
    toolName: str
    arguments: Dict[str, Any]
    oldContent: Optional[str] = None
    newContent: Optional[str] = None

@router.post("/approvals/register")
async def register_approval(req: RegisterApprovalRequest):
    approvals[req.id] = {
        "id": req.id,
        "toolName": req.toolName,
        "arguments": req.arguments,
        "oldContent": req.oldContent,
        "newContent": req.newContent,
        "status": "pending",
        "timestamp": int(time.time() * 1000)
    }
    save_approvals()
    # Ideally, we emit via websocket 'approval:pending' here
    return {"success": True}

class ReplyApprovalRequest(BaseModel):
    id: str
    approved: bool

@router.post("/approvals/reply")
async def reply_approval(req: ReplyApprovalRequest):
    if req.id not in approvals:
        raise HTTPException(status_code=404, detail="Approval request not found")
        
    approvals[req.id]["status"] = "approved" if req.approved else "rejected"
    save_approvals()
    # Ideally, we emit via websocket 'approval:resolved' here
    return {"success": True}

@router.get("/approvals/status/{id}")
async def get_approval_status(id: str):
    if id not in approvals:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return approvals[id]

@router.get("/approvals/pending")
async def get_pending_approvals():
    pending = next((a for a in approvals.values() if a["status"] == "pending"), None)
    return {"pending": pending}

class SessionSaveRequest(BaseModel):
    sessionId: str
    state: Dict[str, Any]

@router.post("/session/save")
async def save_session(req: SessionSaveRequest):
    session_file = os.path.join(SESSIONS_DIR, f"{req.sessionId}.json")
    try:
        async with aiofiles.open(session_file, mode='w', encoding='utf-8') as f:
            await f.write(json.dumps(req.state, indent=2))
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SessionLoadRequest(BaseModel):
    sessionId: str

@router.post("/session/load")
async def load_session(req: SessionLoadRequest):
    session_file = os.path.join(SESSIONS_DIR, f"{req.sessionId}.json")
    try:
        if os.path.exists(session_file):
            async with aiofiles.open(session_file, mode='r', encoding='utf-8') as f:
                data = await f.read()
            return {"success": True, "state": json.loads(data)}
        else:
            return {"success": True, "state": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatMessagePayload(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessagePayload]
    provider: str = "openai"
    model: str = "gpt-4o"
    apiKey: str = ""
    baseUrl: str = ""

@router.post("/chat")
async def agent_chat(req: ChatRequest):
    # Convert payload to LangChain message types
    lc_messages = []
    for msg in req.messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            lc_messages.append(SystemMessage(content=msg.content))
            
    agent = MiraiAgent(
        provider=req.provider,
        model=req.model,
        api_key=req.apiKey,
        base_url=req.baseUrl
    )
    
    session_id = str(uuid.uuid4())
    from core.event_bus import event_bus
    queue = event_bus.subscribe(session_id)
    
    async def run_agent():
        try:
            result = await agent.run(lc_messages, session_id=session_id)
            last_msg = result["messages"][-1]
            await event_bus.publish(session_id, {"type": "final", "content": last_msg.content})
        except Exception as e:
            await event_bus.publish(session_id, {"type": "error", "error": str(e)})
        finally:
            await event_bus.publish(session_id, {"type": "done"})
            
    async def stream_generator():
        task = asyncio.create_task(run_agent())
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") == "done":
                    break
        finally:
            event_bus.unsubscribe(session_id, queue)
            if not task.done():
                task.cancel()
                
    return StreamingResponse(stream_generator(), media_type="text/event-stream")
