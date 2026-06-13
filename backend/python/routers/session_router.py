"""
Session Router — REST API for session management and resume.
"""

from flask import Blueprint, request, jsonify
from core.session_memory import session_memory
from services.workspace import workspace_manager

bp = Blueprint("session", __name__)


@bp.route("/session/start", methods=["POST"])
def api_start_session():
    """Start or resume a session."""
    data = request.get_json() or {}
    workspace_path = data.get("workspace_path", workspace_manager.workspace_root or "")
    session = session_memory.start_session(workspace_path)
    return jsonify({"success": True, "session": session.to_dict()}), 201


@bp.route("/session/current", methods=["GET"])
def api_current_session():
    """Get the current active session."""
    session = session_memory.get_current_session()
    if not session:
        # Auto-start a session
        session = session_memory.start_session(workspace_manager.workspace_root or "")
    return jsonify({"success": True, "session": session.to_dict()})


@bp.route("/session/resume", methods=["GET"])
def api_resume_context():
    """Get resume context for the current workspace."""
    workspace_path = workspace_manager.workspace_root or ""
    context = session_memory.get_resume_context(workspace_path)
    return jsonify({"success": True, **context})


@bp.route("/session/<session_id>/close", methods=["POST"])
def api_close_session(session_id):
    """Close a session."""
    session_memory.close_session(session_id)
    return jsonify({"success": True})


@bp.route("/session/request", methods=["POST"])
def api_update_request():
    """Update the last user request."""
    data = request.get_json() or {}
    request_text = data.get("request", "")
    session_memory.update_last_request(request_text)
    return jsonify({"success": True})


@bp.route("/session/workflow", methods=["POST"])
def api_update_workflow():
    """Update the last workflow ID."""
    data = request.get_json() or {}
    workflow_id = data.get("workflow_id", "")
    session_memory.update_last_workflow(workflow_id)
    return jsonify({"success": True})


@bp.route("/session/error", methods=["POST"])
def api_add_error():
    """Record an error."""
    data = request.get_json() or {}
    error = data.get("error", "")
    if error:
        session_memory.add_error(error)
    return jsonify({"success": True})


@bp.route("/session/fix", methods=["POST"])
def api_add_fix():
    """Record a fix."""
    data = request.get_json() or {}
    fix = data.get("fix", "")
    if fix:
        session_memory.add_fix(fix)
    return jsonify({"success": True})


@bp.route("/session/message", methods=["POST"])
def api_add_message():
    """Store a conversation message."""
    data = request.get_json() or {}
    session_id = data.get("session_id", "")
    role = data.get("role", "")
    content = data.get("content", "")
    metadata = data.get("metadata", {})
    if session_id and role and content:
        session_memory.add_message(session_id, role, content, metadata)
    return jsonify({"success": True})


@bp.route("/session/<session_id>/messages", methods=["GET"])
def api_get_messages(session_id):
    """Get conversation messages for a session."""
    limit = request.args.get("limit", 100, type=int)
    messages = session_memory.get_messages(session_id, limit)
    return jsonify({"success": True, "messages": messages})


@bp.route("/sessions", methods=["GET"])
def api_list_sessions():
    """List recent sessions."""
    sessions = session_memory.list_sessions()
    return jsonify({
        "success": True,
        "sessions": [s.to_dict() for s in sessions]
    })


@bp.route("/session/metadata", methods=["POST"])
def api_update_metadata():
    """Update session metadata."""
    data = request.get_json() or {}
    key = data.get("key", "")
    value = data.get("value")
    if key:
        session_memory.update_metadata(key, value)
    return jsonify({"success": True})