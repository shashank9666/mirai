"""
Memory Router — User preferences, project context, and greeting endpoints.

Endpoints:
  GET  /api/memory/preferences     — Get user preferences
  POST /api/memory/preferences     — Update user preferences
  GET  /api/memory/context         — Get project context
  POST /api/memory/context         — Update project context
  GET  /api/memory/greeting        — Get greeting context
  POST /api/memory/activity        — Record an activity
  GET  /api/memory/summaries       — Get conversation summaries
  POST /api/memory/summary         — Add conversation summary
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify
from services.memory_service import get_memory_service
from services.workspace import workspace_manager

bp = Blueprint("memory", __name__)


def _get_memory():
    ws = workspace_manager.workspace_root or ""
    return get_memory_service(ws)


@bp.route("/memory/preferences", methods=["GET"])
def get_prefs():
    mem = _get_memory()
    return jsonify(mem.get_preferences())


@bp.route("/memory/preferences", methods=["POST"])
def set_prefs():
    mem = _get_memory()
    data = request.get_json(silent=True) or {}
    mem.set_preferences(data)
    return jsonify({"success": True, "preferences": mem.get_preferences()})


@bp.route("/memory/context", methods=["GET"])
def get_ctx():
    mem = _get_memory()
    return jsonify(mem.get_project_context())


@bp.route("/memory/context", methods=["POST"])
def set_ctx():
    mem = _get_memory()
    data = request.get_json(silent=True) or {}
    mem.update_project_context(data)
    return jsonify({"success": True, "context": mem.get_project_context()})


@bp.route("/memory/greeting", methods=["GET"])
def greeting():
    mem = _get_memory()
    mem.increment_session()
    ctx = mem.get_greeting_context()
    return jsonify(ctx)


@bp.route("/memory/activity", methods=["POST"])
def add_activity():
    mem = _get_memory()
    data = request.get_json(silent=True) or {}
    mem.add_activity(
        data.get("type", "general"),
        data.get("description", ""),
        data.get("metadata"),
    )
    return jsonify({"success": True})


@bp.route("/memory/summaries", methods=["GET"])
def get_summaries():
    mem = _get_memory()
    limit = request.args.get("limit", 10, type=int)
    return jsonify(mem.get_recent_summaries(limit))


@bp.route("/memory/summary", methods=["POST"])
def add_summary():
    mem = _get_memory()
    data = request.get_json(silent=True) or {}
    mem.add_conversation_summary(
        data.get("summary", ""),
        data.get("topic", ""),
    )
    return jsonify({"success": True})