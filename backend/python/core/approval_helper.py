import uuid
import time
from routers.agent_router import approvals, save_approvals

def request_and_wait_for_approval(tool_name: str, arguments: dict) -> bool:
    """
    Registers an approval request for a tool call and blocks the current 
    execution thread until the status is approved or rejected by the user.
    """
    req_id = f"appr_{uuid.uuid4()}"
    approvals[req_id] = {
        "id": req_id,
        "toolName": tool_name,
        "arguments": arguments,
        "status": "pending",
        "timestamp": int(time.time() * 1000)
    }
    save_approvals()
    
    while True:
        time.sleep(0.5)
        from routers.agent_router import load_approvals
        load_approvals()
        status = approvals.get(req_id, {}).get("status", "pending")
        if status == "approved":
            return True
        elif status == "rejected":
            return False
