"""
Voice Service — STT (Speech-to-Text) and TTS (Text-to-Speech).

Supports:
  STT: OpenAI Whisper API or local Faster-Whisper
  TTS: OpenAI TTS API, Kokoro TTS (local), or gTTS (fallback)

For a Jarvis-style voice, Kokoro TTS is recommended for local use.
"""

from __future__ import annotations

import io
import os
import json
import tempfile
import subprocess
import threading
from typing import Optional, Generator, BinaryIO
from pathlib import Path

# Lazy imports to avoid startup cost
_whisper_local = None
_kokoro_model = None


# ---------------------------------------------------------------------------
# STT — Speech to Text
# ---------------------------------------------------------------------------

def transcribe_openai(audio_bytes: bytes, api_key: str,
                       model: str = "whisper-1",
                       language: Optional[str] = None) -> dict:
    """
    Transcribe audio using OpenAI's Whisper API.
    Returns { "text": str, "language": str, "duration": float }
    """
    import requests

    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}

    files = {
        "file": ("audio.webm", io.BytesIO(audio_bytes), "audio/webm"),
        "model": (None, model),
    }
    if language:
        files["language"] = (None, language)

    resp = requests.post(url, headers=headers, files=files, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return {
        "text": data.get("text", ""),
        "language": data.get("language", "unknown"),
        "duration": data.get("duration", 0),
    }


def transcribe_local(audio_bytes: bytes, model_size: str = "small",
                      language: Optional[str] = None) -> dict:
    """
    Transcribe audio using local Faster-Whisper.
    Falls back gracefully if model not installed.
    """
    global _whisper_local
    try:
        from faster_whisper import WhisperModel
        if _whisper_local is None:
            _whisper_local = WhisperModel(model_size, device="cpu",
                                           compute_type="int8")
        
        # Write audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            segments, info = _whisper_local.transcribe(
                temp_path,
                language=language,
                beam_size=5,
            )
            text = " ".join(seg.text for seg in segments)
            return {
                "text": text.strip(),
                "language": info.language,
                "duration": info.duration,
            }
        finally:
            os.unlink(temp_path)
    except ImportError:
        return {"text": "", "language": "unknown", "duration": 0,
                "error": "faster-whisper not installed. Run: pip install faster-whisper"}


# ---------------------------------------------------------------------------
# TTS — Text to Speech
# ---------------------------------------------------------------------------

def tts_openai(text: str, api_key: str,
               model: str = "tts-1",
               voice: str = "onyx",
               speed: float = 1.0) -> bytes:
    """
    Generate speech using OpenAI's TTS API.
    Returns audio bytes (mp3).
    """
    import requests

    url = "https://api.openai.com/v1/audio/speech"
    headers = {"Authorization": f"Bearer {api_key}"}
    body = {
        "model": model,
        "voice": voice,
        "input": text,
        "speed": speed,
        "response_format": "mp3",
    }

    resp = requests.post(url, headers=headers, json=body, timeout=60)
    resp.raise_for_status()
    return resp.content


def tts_kokoro(text: str, voice: str = "af_heart",
               speed: float = 1.0) -> bytes:
    """
    Generate speech using Kokoro TTS (local).
    Returns audio bytes (wav).
    
    Install: pip install kokoro
    """
    global _kokoro_model
    try:
        import kokoro
        if _kokoro_model is None:
            _kokoro_model = kokoro.Kokoro()
        
        audio, sample_rate = _kokoro_model.create(
            text, voice=voice, speed=speed
        )
        
        # Convert numpy array to WAV bytes
        import wave
        import struct
        
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            # Convert float32 to int16
            import numpy as np
            audio_int16 = (audio * 32767).astype(np.int16)
            wf.writeframes(audio_int16.tobytes())
        
        return buf.getvalue()
    except ImportError:
        return b""


def tts_gtts(text: str, lang: str = "en") -> bytes:
    """
    Fallback TTS using gTTS (Google Text-to-Speech).
    Returns audio bytes (mp3).
    """
    from gtts import gTTS
    buf = io.BytesIO()
    tts = gTTS(text=text, lang=lang)
    tts.write_to_fp(buf)
    return buf.getvalue()


def synthesize_speech(text: str, provider: str = "openai",
                      api_key: str = "", voice: str = "onyx",
                      speed: float = 1.0) -> dict:
    """
    Unified TTS interface.
    Returns { "audio": bytes, "format": str, "provider": str }
    """
    if provider == "openai" and api_key:
        audio = tts_openai(text, api_key, voice=voice, speed=speed)
        return {"audio": audio, "format": "mp3", "provider": "openai"}
    
    if provider == "kokoro":
        audio = tts_kokoro(text, voice="af_heart", speed=speed)
        if audio:
            return {"audio": audio, "format": "wav", "provider": "kokoro"}
        # Fall back to gTTS
        audio = tts_gtts(text)
        return {"audio": audio, "format": "mp3", "provider": "gtts"}
    
    if provider == "gtts":
        audio = tts_gtts(text)
        return {"audio": audio, "format": "mp3", "provider": "gtts"}
    
    # Default: try openai, then gTTS
    if api_key:
        try:
            audio = tts_openai(text, api_key, voice=voice, speed=speed)
            return {"audio": audio, "format": "mp3", "provider": "openai"}
        except Exception:
            pass
    
    audio = tts_gtts(text)
    return {"audio": audio, "format": "mp3", "provider": "gtts"}


def transcribe_audio(audio_bytes: bytes, provider: str = "openai",
                     api_key: str = "", model: str = "whisper-1",
                     language: Optional[str] = None) -> dict:
    """
    Unified STT interface.
    Returns { "text": str, "language": str, "duration": float }
    """
    if provider == "openai" and api_key:
        try:
            return transcribe_openai(audio_bytes, api_key, model=model,
                                      language=language)
        except Exception as e:
            return {"text": "", "error": str(e), "language": "unknown",
                    "duration": 0}
    
    if provider == "local":
        return transcribe_local(audio_bytes, language=language)
    
    # Default: try openai, then local
    if api_key:
        try:
            return transcribe_openai(audio_bytes, api_key, model=model,
                                      language=language)
        except Exception:
            pass
    
    return transcribe_local(audio_bytes, language=language)