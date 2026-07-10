import { afterEach, describe, expect, test, vi } from 'vitest';
import { configurePlatform, getPlatform, isCompactPlatform, resetPlatform } from './platform.js';

afterEach(() => {
    resetPlatform();
    vi.unstubAllGlobals();
});

describe('platform adapter', () => {
    test('defaults to web capabilities', () => {
        expect(getPlatform().kind).toBe('web');
        expect(isCompactPlatform()).toBe(false);
        expect(getPlatform().communityStats).toBe(false);
    });

    test('merges platform-specific capabilities with web defaults', () => {
        configurePlatform({ kind: 'reddit', compactLayout: true, communityStats: true });

        expect(getPlatform().kind).toBe('reddit');
        expect(isCompactPlatform()).toBe(true);
        expect(getPlatform().communityStats).toBe(true);
        expect(getPlatform().reportCompletion()).toEqual(expect.any(Function));
    });

    test('web sharing falls back to the clipboard', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        const result = await getPlatform().shareResults({
            title: 'Scriptle',
            text: 'results',
            url: 'https://scriptle.net/play/test',
        });

        expect(result).toBe('copied');
        expect(writeText).toHaveBeenCalledWith('results\n\nhttps://scriptle.net/play/test');
    });

    test('web sharing uses the native share sheet when available', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn();
        vi.stubGlobal('navigator', {
            share,
            canShare: () => true,
            clipboard: { writeText },
        });

        const result = await getPlatform().shareResults({
            title: 'Scriptle',
            text: 'results',
            url: 'https://scriptle.net/play/test',
        });

        expect(result).toBe('shared');
        expect(share).toHaveBeenCalledWith({
            title: 'Scriptle',
            text: 'results',
            url: 'https://scriptle.net/play/test',
        });
        expect(writeText).not.toHaveBeenCalled();
    });

    test('rejects adapters without a kind', () => {
        expect(() => configurePlatform({ compactLayout: true })).toThrow('Platform adapter must define a kind');
    });
});
