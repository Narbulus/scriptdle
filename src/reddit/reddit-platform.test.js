import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRedditPlatform } from './reddit-platform.js';

function mockFetch(payload) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Reddit platform adapter', () => {
    test('posts JSON to server endpoints', async () => {
        const fetchSpy = mockFetch({ ok: true });
        const platform = createRedditPlatform();

        await platform.postJson('/api/storage', { key: 'test', value: 'saved' });

        expect(fetchSpy).toHaveBeenCalledWith('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'test', value: 'saved' }),
        });
    });

    test('throws when an endpoint returns a non-OK status', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });
        const platform = createRedditPlatform();

        await expect(platform.postJson('/api/storage', {})).rejects.toThrow('500');
    });

    test('reports completion and forwards stats back', async () => {
        const stats = { subreddit: { totalPlayers: 5 } };
        const fetchSpy = mockFetch({ stats });
        const onStats = vi.fn();
        const platform = createRedditPlatform();
        const completion = { packId: 'star-wars', date: '2026-07-09', won: true, attempts: 2 };

        platform.reportCompletion(completion, onStats);
        await vi.waitFor(() => expect(onStats).toHaveBeenCalledWith(stats));

        expect(fetchSpy).toHaveBeenCalledWith('/api/game-complete', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(completion),
        }));
    });

    test('does not deliver stats after unsubscribe', async () => {
        mockFetch({ stats: { subreddit: { totalPlayers: 5 } } });
        const onStats = vi.fn();
        const platform = createRedditPlatform();

        const unsubscribe = platform.reportCompletion({ packId: 'star-wars' }, onStats);
        unsubscribe();

        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(onStats).not.toHaveBeenCalled();
    });

    test('shares results through the share endpoint', async () => {
        const fetchSpy = mockFetch({ ok: true });
        const platform = createRedditPlatform();

        const result = await platform.shareResults({ emojiText: '🟩🟩', packName: 'Star Wars' });

        expect(result).toBe('commented');
        expect(fetchSpy).toHaveBeenCalledWith('/api/share', expect.objectContaining({
            body: JSON.stringify({ shareText: '🟩🟩', packName: 'Star Wars' }),
        }));
    });
});
