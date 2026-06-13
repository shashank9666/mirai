/**
 * Sound Effects — Tiny audio feedback for Jarvis-like interactions.
 *
 * Sounds:
 *   wake       — Wake word detected
 *   thinking   — Agent processing
 *   success    — Task completed
 *   error      — Error occurred
 *   notification — Proactive notification
 *   recording  — Recording started/stopped
 *
 * Uses Web Audio API for lightweight, immediate playback.
 */

type SoundName = 'wake' | 'thinking' | 'success' | 'error' | 'notification' | 'recording' | 'message';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

/**
 * Generate synthetic sound effects using Web Audio API.
 * No external files needed — all sounds are generated programmatically.
 */
const soundGenerators: Record<SoundName, (ctx: AudioContext) => void> = {
    wake: (ctx) => {
        // Two-tone ascending chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    },

    thinking: (ctx) => {
        // Soft pulsing tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    },

    success: (ctx) => {
        // Ascending major triad
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
    },

    error: (ctx) => {
        // Descending minor tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    },

    notification: (ctx) => {
        // Two quick high-pitched blips
        [0, 0.12].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime + offset);
            gain.gain.setValueAtTime(0.1, ctx.currentTime + offset);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.08);
            osc.start(ctx.currentTime + offset);
            osc.stop(ctx.currentTime + offset + 0.08);
        });
    },

    recording: (ctx) => {
        // Short click/pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
    },

    message: (ctx) => {
        // Soft incoming message sound
        const notes = [880, 1046.5]; // A5, C6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
            gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.15);
            osc.start(ctx.currentTime + i * 0.08);
            osc.stop(ctx.currentTime + i * 0.08 + 0.15);
        });
    },
};

let _enabled = true;

export function setSoundEffectsEnabled(enabled: boolean) {
    _enabled = enabled;
}

export function isSoundEffectsEnabled(): boolean {
    return _enabled;
}

/**
 * Play a sound effect by name.
 */
export function playSound(name: SoundName): void {
    if (!_enabled) return;
    try {
        const ctx = getAudioContext();
        const generator = soundGenerators[name];
        if (generator) {
            generator(ctx);
        }
    } catch {
        // AudioContext may not be available
    }
}

/**
 * Resume audio context (needed after user interaction).
 */
export function resumeAudioContext(): void {
    if (audioContext?.state === 'suspended') {
        audioContext.resume();
    }
}