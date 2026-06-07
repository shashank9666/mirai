from fastapi import APIRouter
from pydantic import BaseModel
import os
from pathlib import Path

router = APIRouter()

class SettingsPayload(BaseModel):
    settings: str

def get_settings_path() -> Path:
    home = Path.home()
    mirai_dir = home / ".mirai"
    mirai_dir.mkdir(parents=True, exist_ok=True)
    return mirai_dir / "settings.json"

@router.get("/load")
async def load_settings():
    path = get_settings_path()
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return {"settings": f.read()}
    return {"settings": None}

@router.post("/save")
async def save_settings(payload: SettingsPayload):
    path = get_settings_path()
    with open(path, "w", encoding="utf-8") as f:
        f.write(payload.settings)
    return {"status": "ok"}
