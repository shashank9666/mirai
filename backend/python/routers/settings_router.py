from flask import Blueprint, request, jsonify
import os
from pathlib import Path

bp = Blueprint("settings", __name__)

def get_settings_path() -> Path:
    home = Path.home()
    mirai_dir = home / ".mirai"
    mirai_dir.mkdir(parents=True, exist_ok=True)
    return mirai_dir / "settings.json"

@bp.route("/load", methods=["GET"])
def load_settings():
    path = get_settings_path()
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return jsonify({"settings": f.read()})
    return jsonify({"settings": None})

@bp.route("/save", methods=["POST"])
def save_settings():
    data = request.get_json() or {}
    settings = data.get("settings", "")
    path = get_settings_path()
    with open(path, "w", encoding="utf-8") as f:
        f.write(settings)
    return jsonify({"status": "ok"})
