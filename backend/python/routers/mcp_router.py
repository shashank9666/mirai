from flask import Blueprint, request, jsonify

bp = Blueprint("mcp", __name__)

@bp.route("/servers", methods=["GET"])
def list_servers():
    # Stubbed implementation referencing odysseus
    return jsonify({"servers": []})

@bp.route("/servers", methods=["POST"])
def add_server():
    # Stubbed implementation referencing odysseus
    data = request.get_json() or {}
    return jsonify({"status": "ok", "server": data})

@bp.route("/servers/<server_id>", methods=["DELETE"])
def remove_server(server_id):
    # Stubbed implementation referencing odysseus
    return jsonify({"status": "ok"})
