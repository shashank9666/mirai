'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, MicOff, Volume2, VolumeX, Waves } from 'lucide-react';
import { voiceSTT } from '@/lib/api';
import { useVoiceStore, VoiceState } from '@/store/voiceStore';

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const STATE_LABELS: Record<VoiceState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Processing',
  executing: 'Executing',
  speaking: 'Speaking',
  error: 'Needs attention',
};

const STATE_ACCENTS: Record<VoiceState, string> = {
  idle: '#38bdf8',
  listening: '#34d399',
  thinking: '#f59e0b',
  executing: '#a78bfa',
  speaking: '#60a5fa',
  error: '#fb7185',
};

const getRecorderOptions = (): MediaRecorderOptions | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
};

interface VoiceOrbProps {
  size?: number;
  showControls?: boolean;
  showLabel?: boolean;
  onVoiceMessage?: (text: string) => void;
}

export default function VoiceOrb({
  size = 120,
  showControls = true,
  showLabel = true,
  onVoiceMessage,
}: VoiceOrbProps) {
  const {
    state,
    muted,
    isRecording,
    micVolume,
    volume,
    autoTts,
    error,
    startRecording,
    stopRecording,
    setMuted,
    setVolume,
    setAutoTts,
    setMicVolume,
    setError,
    clearError,
  } = useVoiceStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const analyserFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const accent = STATE_ACCENTS[state];
  const normalizedLevel = Math.min(1, Math.max(0, micVolume / 90));
  const orbSize = Math.max(88, size);
  const compact = orbSize < 150;

  const stopMetering = useCallback(() => {
    if (analyserFrameRef.current) cancelAnimationFrame(analyserFrameRef.current);
    analyserFrameRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setMicVolume(0);
  }, [setMicVolume]);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopMetering();
  }, [stopMetering]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let phase = 0;
    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;
      const bars = compact ? 28 : 40;
      const barWidth = width / bars;

      ctx.clearRect(0, 0, width, height);
      phase += state === 'listening' ? 0.12 : 0.055;

      for (let i = 0; i < bars; i += 1) {
        const wave = Math.abs(Math.sin(phase + i * 0.42));
        const base = state === 'idle' ? 0.08 : state === 'error' ? 0.16 : 0.22;
        const reactive = state === 'listening' ? normalizedLevel * 0.72 : 0.22 * wave;
        const heightScale = Math.min(0.95, base + reactive + wave * 0.16);
        const barHeight = Math.max(3, heightScale * centerY * 0.72);
        const alpha = 0.22 + heightScale * 0.72;

        ctx.fillStyle = hexToRgba(accent, alpha);
        ctx.beginPath();
        ctx.roundRect(i * barWidth + 1, centerY - barHeight / 2, Math.max(2, barWidth - 2), barHeight, 3);
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [accent, compact, normalizedLevel, state]);

  useEffect(() => cleanupStream, [cleanupStream]);

  const startMetering = useCallback((stream: MediaStream) => {
    const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const data = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const updateLevel = () => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      setMicVolume(average);
      analyserFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [setMicVolume]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      stopRecording();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice capture is not supported in this environment.');
      return;
    }

    try {
      clearError();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const recorder = new MediaRecorder(stream, getRecorderOptions());

      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => setError('Voice recorder failed. Try restarting the mic.');
      recorder.onstop = async () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 512) {
          useVoiceStore.getState().setState('idle');
          return;
        }

        try {
          useVoiceStore.getState().setState('thinking');
          const text = (await voiceSTT(blob)).trim();
          useVoiceStore.getState().setLastTranscript(text);
          if (text) onVoiceMessage?.(text);
          useVoiceStore.getState().setState('idle');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transcription failed.');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      startRecording();
      startMetering(stream);
    } catch (err) {
      cleanupStream();
      setError(err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone permission was denied.'
        : 'Could not start microphone.');
    }
  }, [
    cleanupStream,
    clearError,
    isRecording,
    onVoiceMessage,
    setError,
    startMetering,
    startRecording,
    stopRecording,
  ]);

  const rings = useMemo(() => [0, 1, 2], []);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={showControls ? handleToggleRecording : undefined}
        className="group relative grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        style={{ width: orbSize, height: orbSize }}
        aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
      >
        {rings.map((ring) => (
          <motion.span
            key={ring}
            className="absolute rounded-full border"
            style={{
              inset: 8 + ring * 10,
              borderColor: hexToRgba(accent, 0.22 - ring * 0.04),
              boxShadow: `0 0 ${18 + ring * 10}px ${hexToRgba(accent, 0.16)}`,
            }}
            animate={{
              scale: state === 'listening' || state === 'speaking' ? [1, 1.08 + ring * 0.04, 1] : [1, 1.02, 1],
              opacity: state === 'idle' ? 0.58 : [0.5, 1, 0.5],
            }}
            transition={{ duration: 1.6 + ring * 0.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${hexToRgba(accent, 0.28)}, rgba(10, 14, 24, 0.96) 58%, rgba(0, 0, 0, 0.98))`,
            border: `1px solid ${hexToRgba(accent, 0.36)}`,
          }}
        />

        <canvas ref={canvasRef} width={orbSize} height={orbSize} className="absolute inset-0 rounded-full opacity-90" />

        <motion.div
          className="relative z-10 grid place-items-center rounded-full bg-black/45 border border-white/10"
          style={{ width: orbSize * 0.42, height: orbSize * 0.42 }}
          animate={{ scale: state === 'listening' ? 1 + normalizedLevel * 0.08 : 1 }}
        >
          <AnimatePresence mode="wait">
            {state === 'thinking' || state === 'executing' ? (
              <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="animate-spin" size={compact ? 18 : 24} style={{ color: accent }} />
              </motion.div>
            ) : state === 'listening' ? (
              <motion.div key="mic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Mic size={compact ? 18 : 24} style={{ color: accent }} />
              </motion.div>
            ) : state === 'speaking' ? (
              <motion.div key="waves" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Waves size={compact ? 18 : 24} style={{ color: accent }} />
              </motion.div>
            ) : muted ? (
              <motion.div key="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VolumeX size={compact ? 18 : 24} className="text-white/50" />
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MicOff size={compact ? 18 : 24} className="text-white/60" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </button>

      {showLabel && (
        <div className="min-h-9 text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: accent }}>
            {error || STATE_LABELS[state]}
          </div>
          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: accent }}
              animate={{ width: `${Math.max(8, normalizedLevel * 100)}%` }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
            />
          </div>
        </div>
      )}

      {showControls && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleRecording}
            className={`grid h-8 w-8 place-items-center rounded-md border transition-colors ${
              isRecording
                ? 'border-red-400/40 bg-red-500/15 text-red-300'
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
            title={isRecording ? 'Stop listening' : 'Start listening'}
          >
            {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10"
            title={muted ? 'Unmute voice' : 'Mute voice'}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <label className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2">
            <Volume2 size={13} className="text-white/50" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="w-16 accent-sky-400"
              aria-label="Voice volume"
            />
          </label>

          <label className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 text-[10px] font-mono text-white/60">
            <input
              type="checkbox"
              checked={autoTts}
              onChange={(event) => setAutoTts(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-black/30 accent-sky-400"
            />
            TTS
          </label>
        </div>
      )}
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
