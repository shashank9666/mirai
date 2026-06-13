"""
Graph Router — REST API for the Workspace Knowledge Graph.
"""

from flask import Blueprint, request, jsonify
from services.workspace import workspace_manager
from core.workspace_graph import WorkspaceIndexer

bp = Blueprint("graph", __name__)

_indexer: WorkspaceIndexer = None


def get_indexer():
    global _indexer
    if _indexer is None:
        root = workspace_manager.workspace_root or "."
        _indexer = WorkspaceIndexer(root)
    return _indexer


@bp.route("/graph/index", methods=["POST"])
def api_index_workspace():
    """Index the entire workspace. Returns statistics."""
    indexer = get_indexer()
    stats = indexer.index_all()
    return jsonify({"success": True, "statistics": stats})


@bp.route("/graph/stats", methods=["GET"])
def api_graph_stats():
    """Return workspace graph statistics."""
    indexer = get_indexer()
    try:
        stats = indexer.graph.get_statistics()
        return jsonify({"success": True, "statistics": stats})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500


@bp.route("/graph/search", methods=["GET"])
def api_search_graph():
    """Search nodes by name."""
    query = request.args.get("q", "")
    node_type = request.args.get("type")
    if not query:
        return jsonify({"detail": "query parameter 'q' is required"}), 400
    indexer = get_indexer()
    try:
        results = indexer.graph.search_nodes(query, node_type)
        return jsonify({
            "success": True,
            "results": [n.to_dict() for n in results]
        })
    except Exception as e:
        return jsonify({"detail": str(e)}), 500


@bp.route("/graph/nodes/<node_type>", methods=["GET"])
def api_nodes_by_type(node_type):
    """Find all nodes of a given type."""
    indexer = get_indexer()
    try:
        results = indexer.graph.find_by_type(node_type)
        return jsonify({
            "success": True,
            "results": [n.to_dict() for n in results]
        })
    except Exception as e:
        return jsonify({"detail": str(e)}), 500


@bp.route("/graph/file/<path:file_path>", methods=["GET"])
def api_file_nodes(file_path):
    """Get all indexed nodes for a specific file."""
    indexer = get_indexer()
    try:
        results = indexer.graph.get_file_nodes(file_path)
        return jsonify({
            "success": True,
            "results": [n.to_dict() for n in results]
        })
    except Exception as e:
        return jsonify({"detail": str(e)}), 500


@bp.route("/graph/related/<node_id>", methods=["GET"])
def api_related_nodes(node_id):
    """Get all nodes related to a given node."""
    relation = request.args.get("relation")
    indexer = get_indexer()
    try:
        results = indexer.graph.get_related(node_id, relation)
        return jsonify({
            "success": True,
            "results": [
                {"node": n.to_dict(), "relation": r}
                for n, r in results
            ]
        })
    except Exception as e:
        return jsonify({"detail": str(e)}), 500


@bp.route("/graph/clear", methods=["POST"])
def api_clear_graph():
    """Clear all indexed nodes for the current workspace."""
    indexer = get_indexer()
    try:
        indexer.graph.clear()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"detail": str(e)}), 500