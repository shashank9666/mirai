from flask import Blueprint, request, jsonify, Response
import os
import json
import time
import queue as thread_queue
import threading
import asyncio
import uuid
from services.watcher import notify_change
from core.agent import MiraiAgent
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from services.notifications import notify_user
from core.llm import SUPPORTED_PROVIDERS
from core.event_bus import _json_safe

bp = Blueprint("agent", __name__)

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

@bp.route("/approvals/register", methods=["POST"])
def register_approval():
    data = request.get_json() or {}
    req_id = data.get("id") or data.get("callId")
    tool_name = data.get("toolName")
    arguments = data.get("arguments") or data.get("callArgs")
    old_content = data.get("oldContent")
    new_content = data.get("newContent")

    if not req_id:
        return jsonify({"detail": "id/callId is required"}), 400

    approvals[req_id] = {
        "id": req_id,
        "toolName": tool_name,
        "arguments": arguments,
        "oldContent": old_content,
        "newContent": new_content,
        "status": "pending",
        "timestamp": int(time.time() * 1000)
    }
    save_approvals()
    return jsonify({"success": True})

@bp.route("/approvals/reply", methods=["POST"])
def reply_approval():
    data = request.get_json() or {}
    req_id = data.get("id") or data.get("callId")
    approved = data.get("approved")

    if not req_id:
        return jsonify({"detail": "id/callId is required"}), 400

    if req_id not in approvals:
        return jsonify({"detail": "Approval request not found"}), 404
        
    approvals[req_id]["status"] = "approved" if approved else "rejected"
    save_approvals()
    return jsonify({"success": True})

@bp.route("/approvals/status/<id>", methods=["GET"])
def get_approval_status(id):
    if id not in approvals:
        return jsonify({"detail": "Approval request not found"}), 404
    return jsonify(approvals[id])

@bp.route("/approvals/pending", methods=["GET"])
def get_pending_approvals():
    pending = next((a for a in approvals.values() if a["status"] == "pending"), None)
    return jsonify({"pending": pending})

@bp.route("/session/save", methods=["POST"])
def save_session():
    data = request.get_json() or {}
    session_id = data.get("sessionId")
    state = data.get("state")

    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    try:
        with open(session_file, mode='w', encoding='utf-8') as f:
            f.write(json.dumps(state, indent=2))
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/session/load", methods=["POST"])
def load_session():
    data = request.get_json() or {}
    session_id = data.get("sessionId")

    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    try:
        if os.path.exists(session_file):
            with open(session_file, mode='r', encoding='utf-8') as f:
                content = f.read()
            return jsonify({"success": True, "state": json.loads(content)})
        else:
            return jsonify({"success": True, "state": None})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500

@bp.route("/chat", methods=["POST"])
def agent_chat():
    data = request.get_json() or {}
    messages = data.get("messages", [])
    
    while messages and messages[-1].get("role") == "assistant":
        messages.pop()
        
    print(f"--- [DEBUG agent_router.py] Raw messages count={len(messages)}")
    for idx, m in enumerate(messages):
        content_safe = repr(m.get('content')).encode('ascii', errors='backslashreplace').decode('ascii')
        print(f"  [{idx}] role={m.get('role')} content={content_safe[:100]}")

    provider = data.get("provider", "openai")
    model = data.get("model", "gpt-4o")
    api_key = data.get("apiKey", "")
    base_url = data.get("baseUrl", "")

    if provider not in SUPPORTED_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_PROVIDERS))
        return jsonify({"detail": f"Unsupported provider '{provider}'. Supported providers: {supported}"}), 400

    # Convert payload to LangChain message types and merge consecutive messages of the same type
    lc_messages = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        
        new_msg = None
        if role == "user":
            new_msg = HumanMessage(content=content)
        elif role == "assistant":
            new_msg = AIMessage(content=content)
        elif role == "system":
            new_msg = SystemMessage(content=content)
            
        if new_msg:
            # Merge consecutive messages of the same type to prevent Mistral 400 errors
            if lc_messages and type(lc_messages[-1]) == type(new_msg):
                lc_messages[-1].content += "\n\n" + new_msg.content
            else:
                lc_messages.append(new_msg)

    print(f"--- [DEBUG agent_router.py] Processed lc_messages count={len(lc_messages)}")
    for idx, m in enumerate(lc_messages):
        content_safe = repr(m.content).encode('ascii', errors='backslashreplace').decode('ascii')
        print(f"  [{idx}] type={type(m).__name__} content={content_safe[:100]}")

    agent = MiraiAgent(
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url
    )
    
    session_id = str(uuid.uuid4())
    from core.event_bus import event_bus
    
    q = thread_queue.Queue()

    def run_agent_in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Subscribe locally within this loop
        async_q = event_bus.subscribe(session_id)
        
        async def forward_events():
            while True:
                event = await async_q.get()
                q.put(event)
                if event.get("type") == "done":
                    break

        forward_task = loop.create_task(forward_events())

        async def _run():
            try:
                auto_approve_settings = data.get("autoApproveSettings", {})
                workspace_path = data.get("workspacePath")
                result = await agent.run(lc_messages, session_id=session_id, auto_approve_settings=auto_approve_settings, workspace_path=workspace_path)
                content = ""
                for msg in reversed(result["messages"]):
                    if isinstance(msg, AIMessage):
                        candidate = msg.content
                        if isinstance(candidate, list):
                            text_parts = [p.get("text", "") for p in candidate if isinstance(p, dict) and p.get("type") == "text"]
                            candidate = "".join(text_parts) if text_parts else str(candidate)
                        elif not isinstance(candidate, str):
                            candidate = str(candidate)

                        candidate = candidate.strip()
                        if candidate and candidate != "{}":
                            content = candidate
                            break

                if not content:
                    content = "I have processed your request. Let me know if you need anything else!"
                    
                await event_bus.publish(session_id, {"type": "final", "content": content})
            except Exception as e:
                await event_bus.publish(session_id, {"type": "error", "content": str(e), "error": str(e)})
                notify_user("Agent Error", f"Failed: {str(e)[:50]}...")
            finally:
                await event_bus.publish(session_id, {"type": "done"})

        loop.run_until_complete(asyncio.gather(_run(), forward_task))
        event_bus.unsubscribe(session_id, async_q)
        loop.close()

    threading.Thread(target=run_agent_in_thread, daemon=True).start()

    def stream_generator():
        while True:
            event = q.get()
            safe_event = _json_safe(event)
            yield f"data: {json.dumps(safe_event, default=str)}\n\n"
            if event.get("type") == "done":
                break

    return Response(stream_generator(), mimetype="text/event-stream")
