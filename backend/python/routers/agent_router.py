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
    req_id = data.get("id")
    tool_name = data.get("toolName")
    arguments = data.get("arguments")
    old_content = data.get("oldContent")
    new_content = data.get("newContent")

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
    req_id = data.get("id")
    approved = data.get("approved")

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
    provider = data.get("provider", "openai")
    model = data.get("model", "gpt-4o")
    api_key = data.get("apiKey", "")
    base_url = data.get("baseUrl", "")

    # Convert payload to LangChain message types
    lc_messages = []
    for msg in messages:
        if msg.get("role") == "user":
            lc_messages.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            lc_messages.append(AIMessage(content=msg.get("content", "")))
        elif msg.get("role") == "system":
            lc_messages.append(SystemMessage(content=msg.get("content", "")))
            
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
                result = await agent.run(lc_messages, session_id=session_id)
                last_msg = result["messages"][-1]
                
                content = last_msg.content
                if isinstance(content, list):
                    text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                    content = "".join(text_parts) if text_parts else str(content)
                elif not isinstance(content, str):
                    content = str(content)
                    
                await event_bus.publish(session_id, {"type": "final", "content": content})
            except Exception as e:
                await event_bus.publish(session_id, {"type": "error", "error": str(e)})
                notify_user("Agent Error", f"Failed: {str(e)[:50]}...")
            finally:
                await event_bus.publish(session_id, {"type": "done"})
                if "result" in locals():
                    notify_user("Agent Finished", "Your AI assistant has responded.")

        loop.run_until_complete(asyncio.gather(_run(), forward_task))
        event_bus.unsubscribe(session_id, async_q)
        loop.close()

    threading.Thread(target=run_agent_in_thread, daemon=True).start()

    def stream_generator():
        while True:
            event = q.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") == "done":
                break

    return Response(stream_generator(), mimetype="text/event-stream")
