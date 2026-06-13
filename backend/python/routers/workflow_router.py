"""
Workflow Router — REST API for managing Workflows, Tasks, and Artifacts.
"""

from flask import Blueprint, request, jsonify
from core.workflow_engine import (
    create_workflow, get_workflow, list_workflows,
    update_task, add_artifact_to_task, cancel_workflow,
    create_artifact, Workflow, WorkflowTask, Artifact,
    WorkflowStatus, TaskStatus, set_on_update
)

bp = Blueprint("workflows", __name__)

# ---------------------------------------------------------------------------
# Workflow CRUD
# ---------------------------------------------------------------------------

@bp.route("/workflows", methods=["POST"])
def api_create_workflow():
    data = request.get_json() or {}
    title = data.get("title", "Untitled Workflow")
    description = data.get("description", "")
    tasks = data.get("tasks")
    metadata = data.get("metadata")
    wf = create_workflow(title, description, tasks, metadata)
    return jsonify({"success": True, "workflow": wf.to_dict()}), 201


@bp.route("/workflows", methods=["GET"])
def api_list_workflows():
    workflows = list_workflows()
    return jsonify({
        "success": True,
        "workflows": [w.to_dict() for w in workflows]
    })


@bp.route("/workflows/<wf_id>", methods=["GET"])
def api_get_workflow(wf_id):
    wf = get_workflow(wf_id)
    if not wf:
        return jsonify({"detail": "Workflow not found"}), 404
    return jsonify({"success": True, "workflow": wf.to_dict()})


@bp.route("/workflows/<wf_id>", methods=["DELETE"])
def api_cancel_workflow(wf_id):
    wf = cancel_workflow(wf_id)
    if not wf:
        return jsonify({"detail": "Workflow not found"}), 404
    return jsonify({"success": True, "workflow": wf.to_dict()})

# ---------------------------------------------------------------------------
# Task operations
# ---------------------------------------------------------------------------

@bp.route("/workflows/<wf_id>/tasks/<task_id>", methods=["PATCH"])
def api_update_task(wf_id, task_id):
    data = request.get_json() or {}
    allowed = {"status", "output_data", "error", "input_data"}
    kwargs = {k: v for k, v in data.items() if k in allowed}
    # Convert string status to enum
    if "status" in kwargs and isinstance(kwargs["status"], str):
        try:
            kwargs["status"] = TaskStatus(kwargs["status"])
        except ValueError:
            return jsonify({"detail": f"Invalid status: {kwargs['status']}"}), 400
    wf = update_task(wf_id, task_id, **kwargs)
    if not wf:
        return jsonify({"detail": "Workflow or task not found"}), 404
    return jsonify({"success": True, "workflow": wf.to_dict()})


@bp.route("/workflows/<wf_id>/tasks/<task_id>/artifacts", methods=["POST"])
def api_add_artifact(wf_id, task_id):
    data = request.get_json() or {}
    artifact = Artifact(
        type=data.get("type", "report"),
        title=data.get("title", ""),
        content=data.get("content", ""),
        metadata=data.get("metadata", {}),
    )
    wf = add_artifact_to_task(wf_id, task_id, artifact)
    if not wf:
        return jsonify({"detail": "Workflow or task not found"}), 404
    return jsonify({"success": True, "artifact": artifact.to_dict()}), 201

# ---------------------------------------------------------------------------
# Artifacts (standalone)
# ---------------------------------------------------------------------------

@bp.route("/artifacts", methods=["GET"])
def api_list_artifacts():
    """Return all artifacts across all workflows."""
    all_artifacts = []
    for wf in list_workflows():
        for a in wf.artifacts:
            d = a.to_dict()
            d["workflow_title"] = wf.title
            all_artifacts.append(d)
    return jsonify({"success": True, "artifacts": all_artifacts})