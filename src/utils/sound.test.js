import {
    SOUND_STORAGE_KEY,
    isSoundEnabled,
    setSoundEnabled,
    playTick,
    playLock,
    playMiss,
    playWin,
    _resetSoundForTest,
} from './sound.js';

function createMockAudioContext(state = 'running') {
    const oscillators = [];
    const gains = [];
    const filters = [];

    const ctx = {
        state,
        currentTime: 1.0,
        destination: {},
        resume: vi.fn(() => Promise.resolve()),
        createOscillator: vi.fn(() => {
            const osc = {
                type: 'sine',
                frequency: {
                    setValueAtTime: vi.fn(),
                    exponentialRampToValueAtTime: vi.fn(),
                },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
            };
            oscillators.push(osc);
            return osc;
        }),
        createBiquadFilter: vi.fn(() => {
            const filter = {
                type: 'lowpass',
                frequency: {
                    setValueAtTime: vi.fn(),
                    exponentialRampToValueAtTime: vi.fn(),
                },
                connect: vi.fn(),
            };
            filters.push(filter);
            return filter;
        }),
        createGain: vi.fn(() => {
            const gainNode = {
                gain: {
                    setValueAtTime: vi.fn(),
                    linearRampToValueAtTime: vi.fn(),
                    exponentialRampToValueAtTime: vi.fn(),
                },
                connect: vi.fn(),
            };
            gains.push(gainNode);
            return gainNode;
        }),
        _oscillators: oscillators,
        _gains: gains,
        _filters: filters,
    };

    return ctx;
}

describe('sound utility', () => {
    const originalAudioContext = window.AudioContext;
    const originalWebkitAudioContext = window.webkitAudioContext;

    beforeEach(() => {
        localStorage.clear();
        _resetSoundForTest();
        delete window.AudioContext;
        delete window.webkitAudioContext;
    });

    afterEach(() => {
        if (originalAudioContext) window.AudioContext = originalAudioContext;
        else delete window.AudioContext;
        if (originalWebkitAudioContext) window.webkitAudioContext = originalWebkitAudioContext;
        else delete window.webkitAudioContext;
    });

    describe('sound preference', () => {
        test('defaults to enabled when unset', () => {
            expect(isSoundEnabled()).toBe(true);
        });

        test('persists toggle state in localStorage under scriptle_sound_enabled', () => {
            expect(setSoundEnabled(false)).toBe(false);
            expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('false');
            expect(isSoundEnabled()).toBe(false);

            expect(setSoundEnabled(true)).toBe(true);
            expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('true');
            expect(isSoundEnabled()).toBe(true);
        });

        test('treats "0" as disabled', () => {
            localStorage.setItem(SOUND_STORAGE_KEY, '0');
            expect(isSoundEnabled()).toBe(false);
        });
    });

    describe('graceful degradation', () => {
        test('no-ops safely when AudioContext is unavailable', () => {
            expect(playTick()).toBe(false);
            expect(playLock()).toBe(false);
            expect(playMiss()).toBe(false);
            expect(playWin()).toBe(false);
        });

        test('no-ops when sound is disabled', () => {
            const mockCtx = createMockAudioContext();
            window.AudioContext = vi.fn(() => mockCtx);
            setSoundEnabled(false);

            expect(playTick()).toBe(false);
            expect(playLock()).toBe(false);
            expect(playMiss()).toBe(false);
            expect(playWin()).toBe(false);
            expect(window.AudioContext).not.toHaveBeenCalled();
        });

        test('no-ops safely if AudioContext constructor throws', () => {
            window.AudioContext = vi.fn(() => {
                throw new Error('Not allowed');
            });
            expect(playTick()).toBe(false);
        });
    });

    describe('synthesized cues', () => {
        test('playTick schedules a single subtle detent tone with gain <= 0.07', () => {
            const mockCtx = createMockAudioContext('suspended');
            window.AudioContext = vi.fn(() => mockCtx);

            expect(playTick()).toBe(true);
            expect(mockCtx.resume).toHaveBeenCalled();
            expect(mockCtx._oscillators).toHaveLength(1);
            expect(mockCtx._oscillators[0].start).toHaveBeenCalledTimes(1);
            expect(mockCtx._oscillators[0].stop).toHaveBeenCalledTimes(1);

            const peak = mockCtx._gains[0].gain.linearRampToValueAtTime.mock.calls[0][0];
            expect(peak).toBeGreaterThan(0);
            expect(peak).toBeLessThanOrEqual(0.07);
        });

        test('playLock schedules a warm two-note rising chime with gain <= 0.07', () => {
            const mockCtx = createMockAudioContext();
            window.webkitAudioContext = vi.fn(() => mockCtx);

            expect(playLock()).toBe(true);
            expect(mockCtx._oscillators).toHaveLength(2);

            const firstFreq = mockCtx._oscillators[0].frequency.setValueAtTime.mock.calls[0][0];
            const secondFreq = mockCtx._oscillators[1].frequency.setValueAtTime.mock.calls[0][0];
            expect(secondFreq).toBeGreaterThan(firstFreq);

            for (const g of mockCtx._gains) {
                const peak = g.gain.linearRampToValueAtTime.mock.calls[0][0];
                expect(peak).toBeLessThanOrEqual(0.07);
            }
        });

        test('playMiss schedules a muted downward wood thud with gain <= 0.07', () => {
            const mockCtx = createMockAudioContext();
            window.AudioContext = vi.fn(() => mockCtx);

            expect(playMiss()).toBe(true);
            expect(mockCtx._oscillators).toHaveLength(1);
            const startFreq = mockCtx._oscillators[0].frequency.setValueAtTime.mock.calls[0][0];
            const endFreq = mockCtx._oscillators[0].frequency.exponentialRampToValueAtTime.mock.calls[0][0];
            expect(endFreq).toBeLessThan(startFreq);

            const peak = mockCtx._gains[0].gain.linearRampToValueAtTime.mock.calls[0][0];
            expect(peak).toBeLessThanOrEqual(0.07);
        });

        test('playWin schedules a warm four-note resolved chord with subtle gain', () => {
            const mockCtx = createMockAudioContext();
            window.AudioContext = vi.fn(() => mockCtx);

            expect(playWin()).toBe(true);
            expect(mockCtx._oscillators).toHaveLength(4);
            for (const g of mockCtx._gains) {
                const peak = g.gain.linearRampToValueAtTime.mock.calls[0][0];
                expect(peak).toBeLessThanOrEqual(0.07);
            }
        });

        test('reuses a single AudioContext across subsequent cues', () => {
            const mockCtx = createMockAudioContext();
            window.AudioContext = vi.fn(() => mockCtx);

            playTick();
            playMiss();
            expect(window.AudioContext).toHaveBeenCalledTimes(1);
        });
    });
});
