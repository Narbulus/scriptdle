/**
 * Tactile analog sound effects synthesized via Web Audio API.
 * Zero external audio assets, whisper-quiet gain ceiling (<= 0.07),
 * and safe no-ops whenever Web Audio or localStorage is unavailable.
 */

export const SOUND_STORAGE_KEY = 'scriptle_sound_enabled';

let audioCtx = null;

function getAudioContextClass() {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
}

function getAudioContext() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
            Promise.resolve(audioCtx.resume()).catch(() => {});
        }
        return audioCtx;
    }

    const AudioCtx = getAudioContextClass();
    if (!AudioCtx) return null;

    try {
        audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
            Promise.resolve(audioCtx.resume()).catch(() => {});
        }
        return audioCtx;
    } catch {
        return null;
    }
}

export function isSoundEnabled() {
    try {
        if (typeof localStorage === 'undefined') return true;
        const stored = localStorage.getItem(SOUND_STORAGE_KEY);
        if (stored === null || stored === undefined) return true;
        return stored !== 'false' && stored !== '0';
    } catch {
        return true;
    }
}

export function setSoundEnabled(enabled) {
    const next = Boolean(enabled);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SOUND_STORAGE_KEY, next ? 'true' : 'false');
        }
    } catch {
        // Ignore storage errors in restricted contexts
    }
    return next;
}

/**
 * Play a single softly filtered tone with an analog envelope.
 */
function scheduleTone(ctx, {
    type = 'triangle',
    startFreq,
    endFreq = startFreq,
    startTime,
    duration,
    attack = 0.006,
    gainPeak = 0.04,
    filterFreq = 1200,
    filterEndFreq = filterFreq,
}) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    if (filterEndFreq !== filterFreq) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterEndFreq), startTime + duration);
    }

    const safePeak = Math.min(0.07, Math.max(0.0001, gainPeak));
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(safePeak, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.015);
}

/**
 * Soft mechanical key / paper detent tick (option select, dice roll).
 */
export function playTick() {
    if (!isSoundEnabled()) return false;
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
        const now = ctx.currentTime;
        scheduleTone(ctx, {
            type: 'triangle',
            startFreq: 680,
            endFreq: 240,
            startTime: now,
            duration: 0.032,
            attack: 0.003,
            gainPeak: 0.032,
            filterFreq: 1400,
            filterEndFreq: 600,
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Warm two-note brass/marimba chime when locking a film, episode, or character.
 */
export function playLock() {
    if (!isSoundEnabled()) return false;
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
        const now = ctx.currentTime;
        // D4 -> A4 warm rising fifth
        scheduleTone(ctx, {
            type: 'triangle',
            startFreq: 293.66,
            startTime: now,
            duration: 0.24,
            attack: 0.007,
            gainPeak: 0.042,
            filterFreq: 1100,
            filterEndFreq: 620,
        });
        scheduleTone(ctx, {
            type: 'triangle',
            startFreq: 440.0,
            startTime: now + 0.085,
            duration: 0.34,
            attack: 0.008,
            gainPeak: 0.055,
            filterFreq: 1250,
            filterEndFreq: 680,
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Soft muted wood/paper thud on an incorrect guess.
 */
export function playMiss() {
    if (!isSoundEnabled()) return false;
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
        const now = ctx.currentTime;
        scheduleTone(ctx, {
            type: 'sine',
            startFreq: 148,
            endFreq: 82,
            startTime: now,
            duration: 0.12,
            attack: 0.005,
            gainPeak: 0.055,
            filterFreq: 320,
            filterEndFreq: 180,
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Warm resolved chord on puzzle win (C4 - E4 - G4 - C5 gentle arpeggio).
 */
export function playWin() {
    if (!isSoundEnabled()) return false;
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
        const now = ctx.currentTime;
        const notes = [
            { freq: 261.63, delay: 0, duration: 0.52, gain: 0.03 },
            { freq: 329.63, delay: 0.065, duration: 0.56, gain: 0.03 },
            { freq: 392.0, delay: 0.13, duration: 0.62, gain: 0.032 },
            { freq: 523.25, delay: 0.195, duration: 0.74, gain: 0.035 },
        ];
        for (const note of notes) {
            scheduleTone(ctx, {
                type: 'triangle',
                startFreq: note.freq,
                startTime: now + note.delay,
                duration: note.duration,
                attack: 0.01,
                gainPeak: note.gain,
                filterFreq: 1350,
                filterEndFreq: 700,
            });
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Reset cached AudioContext (used by unit tests).
 */
export function _resetSoundForTest() {
    audioCtx = null;
}
