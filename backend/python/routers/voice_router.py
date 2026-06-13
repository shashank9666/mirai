"""
Voice Router — STT/TTS endpoints and WebSocket for real-time voice.

Endpoints:
  POST /api/voice/transcribe   — Upload audio, get text
  POST /api/voice/synthesize   — Send text, get audio
  POST /api/voice/tts-settings — Get/set TTS provider config
"""

from __future__ import annotations

import os
import json
import base64
from flask import Blueprint, request, jsonify, Response
from services.voice import transcribe_audio, synthesize_speech

bp = Blueprint("voice", __name__)

# Voice settings (persisted in session or env)
_voice_settings = {
    "stt_provider": os.environ.get("STT_PROVIDER", "openai"),
    "tts_provider": os.environ.get("TTS_PROVIDER", "gtts"),
    "openai_api_key": os.environ.get("OPENAI_API_KEY", ""),
    "tts_voice": os.environ.get("TTS_VOICE", "onyx"),
    "tts_speed": float(os.environ.get("TTS_SPEED", "1.0")),
    "whisper_model": os.environ.get("WHISPER_MODEL", "whisper-1"),
    "wake_word": os.environ.get("WAKE_WORD", "mirai"),
    "wake_word_enabled": os.environ.get("WAKE_WORD_ENABLED", "false").lower() == "true",
}


@bp.route("/voice/transcribe", methods=["POST"])
def transcribe():
    """
    Transcribe audio to text.
    
    Body (multipart/form-data):
      - audio: audio file (webm, wav, mp3, etc.)
      - language: optional language code
    
    Or body (JSON):
      - audio_base64: base64-encoded audio
      - format: audio format (webm, wav, mp3)
      - language: optional language code
    """
    audio_bytes = None
    language = None

    if request.content_type and "multipart" in request.content_type:
        audio_file = request.files.get("audio")
        language = request.form.get("language")
        if audio_file:
            audio_bytes = audio_file.read()
    else:
        data = request.get_json(silent=True) or {}
        language = data.get("language")
        audio_b64 = data.get("audio_base64")
        if audio_b64:
            audio_bytes = base64.b64decode(audio_b64)

    if not audio_bytes:
        return jsonify({"error": "No audio data provided"}), 400

    settings = _voice_settings
    result = transcribe_audio(
        audio_bytes,
        provider=settings["stt_provider"],
        api_key=settings["openai_api_key"],
        model=settings["whisper_model"],
        language=language,
    )

    return jsonify(result)


@bp.route("/voice/synthesize", methods=["POST"])
def synthesize():
    """
    Synthesize text to speech.
    
    Body (JSON):
      - text: text to speak
      - provider: optional override (openai, kokoro, gtts)
      - voice: optional voice name
      - speed: optional speed (0.5 - 2.0)
    """
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    settings = _voice_settings
    result = synthesize_speech(
        text,
        provider=data.get("provider", settings["tts_provider"]),
        api_key=data.get("api_key", settings["openai_api_key"]),
        voice=data.get("voice", settings["tts_voice"]),
        speed=float(data.get("speed", settings["tts_speed"])),
    )

    audio_b64 = base64.b64encode(result["audio"]).decode("ascii") if result["audio"] else ""

    return jsonify({
        "audio_base64": audio_b64,
        "format": result["format"],
        "provider": result["provider"],
        "size": len(result["audio"]),
    })


@bp.route("/voice/settings", methods=["GET", "POST"])
def voice_settings():
    """Get or update voice settings."""
    global _voice_settings
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        for key in ("stt_provider", "tts_provider", "openai_api_key",
                     "tts_voice", "tts_speed", "whisper_model",
                     "wake_word", "wake_word_enabled"):
            if key in data:
                _voice_settings[key] = data[key]
        return jsonify({"settings": _voice_settings, "updated": True})
    return jsonify({"settings": _voice_settings})


@bp.route("/voice/providers", methods=["GET"])
def providers():
    """List available STT/TTS providers and their status."""
    providers_info = {
        "stt": {
            "openai": {
                "name": "OpenAI Whisper",
                "available": bool(_voice_settings["openai_api_key"]),
                "requires_key": True,
            },
            "local": {
                "name": "Faster-Whisper (Local)",
                "available": _check_faster_whisper(),
                "requires_key": False,
            },
        },
        "tts": {
            "openai": {
                "name": "OpenAI TTS",
                "available": bool(_voice_settings["openai_api_key"]),
                "requires_key": True,
                "voices": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
            },
            "kokoro": {
                "name": "Kokoro TTS (Local)",
                "available": _check_kokoro(),
                "requires_key": False,
            },
            "gtts": {
                "name": "Google TTS",
                "available": True,
                "requires_key": False,
            },
        },
        "wake_word": {
            "openWakeWord": {
                "name": "OpenWakeWord",
                "available": True,
                "requires_key": False,
            },
        },
    }
    return jsonify(providers_info)


def _check_faster_whisper() -> bool:
    try:
        import faster_whisper
        return True
    except ImportError:
        return False


def _check_kokoro() -> bool:
    try:
        import kokoro
        return True
    except ImportError:
        return False