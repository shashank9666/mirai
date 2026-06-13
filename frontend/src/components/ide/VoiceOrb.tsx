'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useVoiceStore, VoiceState } from '@/store/voiceStore';
import { getBackendBase } from '@/lib/api';

/**
 * VoiceOrb — Jarvis-style voice interaction orb.
 *
 * States:
 *   idle       — Pulsing gently, ready
 *   listening  — Expanding waves, capturing audio
 *   thinking   — Spinning glow, processing
 *   executing  — Tool use animation
 *   speaking   — Rhythmic pulse, playing TTS
 *   error      — Red flash
 */

const STATE_COLORS: Record<VoiceState, string> = {
    idle: 'from-blue-500/30 to-cyan-400/20',
    listening: 'from-green-400/40 to-emerald-500/30',
    thinking: 'from-yellow-400/40 to-amber-500/30',
    executing: 'from-purple-400/40 to-violet-500/30',
    speaking: 'from-blue-400/50 to-indigo-500/40',
    error: 'from-red-500/40 to-orange-400/30',
};

const STATE_LABELS: Record<VoiceState, string> = {
    idle: 'Ready',
    listening: 'Listening...',
    thinking: 'Thinking...',
    executing: 'Executing...',
    speaking: 'Speaking...',
    error: 'Error',
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
        state, muted, isRecording, isPlaying,
        startRecording, stopRecording, playAudio, stopAudio,
        setMuted, error, clearError,
    } = useVoiceStore();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);

    // -----------------------------------------------------------------------
    // Audio waveform visualization
    // -----------------------------------------------------------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = canvas.width;
        const H = canvas.height;
        let phase = 0;

        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            phase += 0.05;

            const bars = 32;
            const barWidth = W / bars;
            const centerY = H / 2;

            for (let i = 0; i < bars; i++) {
                let amplitude: number;
                switch (state) {
                    case 'listening':
                        amplitude = 0.3 + 0.7 * Math.abs(Math.sin(phase + i * 0.3));
                        break;
                    case 'thinking':
                        amplitude = 0.2 + 0.5 * Math.abs(Math.cos(phase * 2 + i * 0.2));
                        break;
                    case 'executing':
                        amplitude = 0.4 + 0.6 * Math.abs(Math.sin(phase * 3 + i * 0.15));
                        break;
                    case 'speaking':
                        amplitude = 0.2 + 0.8 * Math.abs(Math.sin(phase * 1.5 + i * 0.25));
                        break;
                    case 'error':
                        amplitude = 0.1 + 0.3 * Math.abs(Math.sin(phase * 4));
                        break;
                    default:
                        amplitude = 0.05 + 0.15 * Math.abs(Math.sin(phase + i * 0.1));
                }

                const barHeight = Math.max(2, amplitude * centerY * 0.8);
                const x = i * barWidth;
                const alpha = 0.3 + amplitude * 0.7;

                // Gradient based on state
                const colors: Record<VoiceState, string> = {
                    idle: `rgba(59, 130, 246, ${alpha})`,
                    listening: `rgba(34, 197, 94, ${alpha})`,
                    thinking: `rgba(234, 179, 8, ${alpha})`,
                    executing: `rgba(168, 85, 247, ${alpha})`,
                    speaking: `rgba(99, 102, 241, ${alpha})`,
                    error: `rgba(239, 68, 68, ${alpha})`,
                };

                ctx.fillStyle = colors[state];
                ctx.beginPath();
                ctx.roundRect(x + 1, centerY - barHeight, barWidth - 2, barHeight * 2, 2);
                ctx.fill();
            }

            animFrameRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [state]);

    // -----------------------------------------------------------------------
    // Transcription
    // -----------------------------------------------------------------------
    const handleTranscribe = useCallback(async (audioBlob: Blob) => {
        try {
            const base64 = await blobToBase64(audioBlob);
            const res = await fetch(`${getBackendBase()}/api/voice/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio_base64: base64.replace(/^data:audio\/\w+;base64,/, ''),
                    format: 'webm',
                }),
            });
            const data = await res.json();
            if (data.text) {
                onVoiceMessage?.(data.text);
            }
        } catch (err) {
            console.error('Transcription failed:', err);
        }
    }, [onVoiceMessage]);

    // -----------------------------------------------------------------------
    // Recording
    // -----------------------------------------------------------------------
    const handleToggleRecording = useCallback(async () => {
        if (isRecording) {
            stopRecording();
            mediaRecorderRef.current?.stop();
            mediaRecorderRef.current = null;
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream, {
                    mimeType: 'audio/webm;codecs=opus',
                });

                chunksRef.current = [];
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data);
                };

                recorder.onstop = async () => {
                    stream.getTracks().forEach((t) => t.stop());
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    await handleTranscribe(blob);
                };

                mediaRecorderRef.current = recorder;
                recorder.start();
                startRecording();
            } catch (err) {
                console.error('Microphone access denied:', err);
            }
        }
    }, [isRecording, startRecording, stopRecording, handleTranscribe]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    const orbSize = size;
    const innerSize = orbSize * 0.6;

    return (
        <div className="flex flex-col items-center gap-2">
            {/* Orb */}
            <div className="relative" style={{ width: orbSize, height: orbSize }}>
                {/* Outer glow ring */}
                <motion.div
                    className={`absolute inset-0 rounded-full bg-gradient-to-br ${STATE_COLORS[state]}`}
                    animate={{
                        scale: state === 'listening' ? [1, 1.15, 1] :
                            state === 'thinking' ? [1, 1.05, 1] :
                                state === 'speaking' ? [1, 1.1, 1] :
                                    state === 'error' ? [1, 1.05, 1] : [1, 1.02, 1],
                        opacity: state === 'idle' ? 0.6 : [0.6, 1, 0.6],
                    }}
                    transition={{
                        duration: state === 'thinking' ? 1.5 : state === 'speaking' ? 0.8 : 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                    style={{ filter: 'blur(8px)' }}
                />

                {/* Canvas visualization */}
                <canvas
                    ref={canvasRef}
                    width={orbSize}
                    height={orbSize}
                    className="absolute inset-0 rounded-full"
                />

                {/* Inner orb */}
                <motion.div
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                        width: innerSize,
                        height: innerSize,
                        top: (orbSize - innerSize) / 2,
                        left: (orbSize - innerSize) / 2,
                        background: 'radial-gradient(circle, rgba(30,30,40,0.9) 0%, rgba(15,15,25,0.95) 100%)',
                        border: `2px solid ${state === 'listening' ? 'rgba(34,197,94,0.5)' :
                            state === 'thinking' ? 'rgba(234,179,8,0.5)' :
                                state === 'executing' ? 'rgba(168,85,247,0.5)' :
                                    state === 'speaking' ? 'rgba(99,102,241,0.5)' :
                                        state === 'error' ? 'rgba(239,68,68,0.5)' :
                                            'rgba(59,130,246,0.3)'
                            }`,
                    }}
                    animate={{
                        borderColor: state === 'listening'
                            ? ['rgba(34,197,94,0.3)', 'rgba(34,197,94,0.8)', 'rgba(34,197,94,0.3)']
                            : state === 'thinking'
                                ? ['rgba(234,179,8,0.3)', 'rgba(234,179,8,0.8)', 'rgba(234,179,8,0.3)']
                                : state === 'speaking'
                                    ? ['rgba(99,102,241,0.3)', 'rgba(99,102,241,0.8)', 'rgba(99,102,241,0.3)']
                                    : undefined,
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                    {/* Status icon */}
                    <AnimatePresence mode="wait">
                        {state === 'thinking' || state === 'executing' ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={{ rotate: { duration: 1, repeat: Infinity, ease: 'linear' } }}
                            >
                                <Loader2 size={24} className="text-yellow-400" />
                            </motion.div>
                        ) : state === 'error' ? (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-red-400 text-xs font-medium text-center px-1"
                            >
                                !
                            </motion.div>
                        ) : (
                            <motion.div
                                key="icon"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                            >
                                {muted ? (
                                    <VolumeX size={20} className="text-zinc-400" />
                                ) : (
                                    <div className="w-3 h-3 rounded-full bg-blue-400/60" />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Label */}
            {showLabel && (
                <motion.span
                    className="text-xs font-medium"
                    style={{
                        color: state === 'error' ? '#ef4444' :
                            state === 'listening' ? '#22c55e' :
                                state === 'thinking' ? '#eab308' :
                                    state === 'executing' ? '#a855f7' :
                                        state === 'speaking' ? '#6366f1' :
                                            '#6b7280',
                    }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    {error || STATE_LABELS[state]}
                </motion.span>
            )}

            {/* Controls */}
            {showControls && (
                <div className="flex items-center gap-2 mt-1">
                    <button
                        onClick={handleToggleRecording}
                        className={`p-2 rounded-full transition-colors ${isRecording
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                            }`}
                        title={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                        {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>

                    <button
                        onClick={() => setMuted(!muted)}
                        className={`p-2 rounded-full transition-colors ${muted
                            ? 'bg-zinc-700/80 text-zinc-500'
                            : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                            }`}
                        title={muted ? 'Unmute TTS' : 'Mute TTS'}
                    >
                        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </div>
            )}
        </div>
    );
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}