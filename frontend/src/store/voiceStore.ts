/**
 * Voice Store — Manages voice interaction state.
 *
 * States:
 *   idle       — Ready for input
 *   listening  — Recording audio
 *   thinking   — Processing transcription
 *   executing  — Agent running tools
 *   speaking   — Playing TTS audio
 *   error      — Error occurred
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'error';

interface VoiceStoreState {
    state: VoiceState;
    muted: boolean;
    isRecording: boolean;
    isPlaying: boolean;
    autoTts: boolean;
    error: string | null;
    lastTranscript: string;
    volume: number;

    setState: (state: VoiceState) => void;
    setMuted: (muted: boolean) => void;
    setAutoTts: (auto: boolean) => void;
    setVolume: (volume: number) => void;
    startRecording: () => void;
    stopRecording: () => void;
    playAudio: (audioUrl: string) => void;
    stopAudio: () => void;
    setError: (error: string) => void;
    clearError: () => void;
    setLastTranscript: (text: string) => void;
}

export const useVoiceStore = create<VoiceStoreState>()(
    persist(
        (set, get) => ({
            state: 'idle',
            muted: false,
            isRecording: false,
            isPlaying: false,
            autoTts: false,
            error: null,
            lastTranscript: '',
            volume: 1.0,

            setState: (state) => set({ state }),

            setMuted: (muted) => set({ muted }),

            setAutoTts: (auto) => set({ autoTts: auto }),

            setVolume: (volume) => set({ volume }),

            startRecording: () => set({
                isRecording: true,
                state: 'listening',
                error: null,
            }),

            stopRecording: () => set({
                isRecording: false,
                state: 'thinking',
            }),

            playAudio: (audioUrl: string) => {
                const { volume, muted } = get();
                if (muted) return;

                const audio = new Audio(audioUrl);
                audio.volume = volume;

                audio.onplay = () => {
                    set({ isPlaying: true, state: 'speaking' });
                };
                audio.onended = () => {
                    set({ isPlaying: false, state: 'idle' });
                };
                audio.onerror = () => {
                    set({ isPlaying: false, state: 'idle', error: 'Audio playback failed' });
                };

                audio.play().catch((err) => {
                    set({ isPlaying: false, state: 'idle', error: String(err) });
                });
            },

            stopAudio: () => set({
                isPlaying: false,
                state: 'idle',
            }),

            setError: (error) => set({ error, state: 'error' }),

            clearError: () => set({ error: null, state: 'idle' }),

            setLastTranscript: (text) => set({ lastTranscript: text }),
        }),
        {
            name: 'mirai-voice-storage',
            partialize: (state) => ({
                muted: state.muted,
                autoTts: state.autoTts,
                volume: state.volume,
            }),
        }
    )
);