"""
Proactive Events Router — Endpoints for workspace events.

Endpoints:
  GET  /api/events              — Get recent events
  POST /api/events/emit         — Emit a new event
  POST /api/events/ack/:id      — Acknowledge an event
  GET  /api/events/unacknowledged-count — Get unacknowledged count
  POST /api/events/clear        — Clear all events
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify
from services.proactive_events import proactive_events
from services.proactive_events import parse_terminal_output, parse_git_output

bp = Blueprint("proactive", __name__)


@bp.route("/events", methods=["GET"])
def get_events():
    limit = request.args.get("limit", 20, type=int)
    unack = request.args.get("unacknowledged", "false").lower() == "true"
    events = proactive_events.get_events(limit=limit, unacknowledged_only=unack)
    return jsonify({"events": events, "count": len(events)})


@bp.route("/events/emit", methods=["POST"])
def emit_event():
    data = request.get_json(silent=True) or {}
    event_type = data.get("type")
    description = data.get("description", "")
    file_path = data.get("file_path", "")
    metadata = data.get("metadata", {})

    if not event_type:
        return jsonify({"error": "Event type required"}), 400

    event = proactive_events.emit(event_type, description, file_path, metadata)
    return jsonify({"success": True, "event": event.to_dict()})


@bp.route("/events/ack/<event_id>", methods=["POST"])
def ack_event(event_id: str):
    ok = proactive_events.acknowledge(event_id)
    if ok:
        return jsonify({"success": True})
    return jsonify({"error": "Event not found"}), 404


@bp.route("/events/responded/<event_id>", methods=["POST"])
def mark_responded(event_id: str):
    ok = proactive_events.mark_agent_responded(event_id)
    if ok:
        return jsonify({"success": True})
    return jsonify({"error": "Event not found"}), 404


@bp.route("/events/unacknowledged-count", methods=["GET"])
def unack_count():
    count = proactive_events.get_unacknowledged_count()
    return jsonify({"count": count})


@bp.route("/events/clear", methods=["POST"])
def clear_events():
    proactive_events.clear()
    return jsonify({"success": True})


@bp.route("/events/parse-terminal", methods=["POST"])
def parse_terminal():
    """
    Parse terminal output and emit events if actionable patterns detected.
    Body: { "output": str, "cwd": str }
    """
    data = request.get_json(silent=True) or {}
    output = data.get("output", "")
    cwd = data.get("cwd", "")

    event = parse_terminal_output(output, cwd)
    if event:
        ev = proactive_events.emit(
            event["type"], event["description"],
            event.get("file_path", ""), event,
        )
        return jsonify({"event": ev.to_dict(), "detected": True})
    return jsonify({"detected": False})


@bp.route("/events/parse-git", methods=["POST"])
def parse_git():
    """
    Parse git output and emit events if actionable patterns detected.
    Body: { "output": str }
    """
    data = request.get_json(silent=True) or {}
    output = data.get("output", "")

    event = parse_git_output(output)
    if event:
        ev = proactive_events.emit(
            event["type"], event["description"],
            event.get("file_path", ""), event,
        )
        return jsonify({"event": ev.to_dict(), "detected": True})
    return jsonify({"detected": False})