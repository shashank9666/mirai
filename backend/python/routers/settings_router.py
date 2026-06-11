from flask import Blueprint, request, jsonify, send_file
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

def get_bg_path() -> Path:
    home = Path.home()
    mirai_dir = home / ".mirai"
    mirai_dir.mkdir(parents=True, exist_ok=True)
    return mirai_dir / "bg_image"

@bp.route("/upload_bg", methods=["POST"])
def upload_bg():
    if "image" not in request.files:
        return jsonify({"detail": "No image uploaded"}), 400
        
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"detail": "No selected file"}), 400
        
    ext = os.path.splitext(file.filename)[1]
    
    path = get_bg_path()
    for existing in path.parent.glob("bg_image*"):
        try:
            existing.unlink()
        except:
            pass
            
    final_path = str(path) + ext
    file.save(final_path)
    
    return jsonify({"url": f"http://127.0.0.1:8000/api/settings/bg_image?t={os.path.getmtime(final_path)}"})

@bp.route("/bg_image", methods=["GET"])
def get_bg_image():
    path = get_bg_path()
    for existing in path.parent.glob("bg_image*"):
        return send_file(existing)
    return jsonify({"detail": "No image"}), 404
