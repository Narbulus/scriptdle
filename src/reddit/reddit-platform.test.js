import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRedditPlatform } from './reddit-platform.js';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Reddit platform adapter', () => {
    test('sends typed messages to the host', () => {
        const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
        const platform = createRedditPlatform();

        platform.sendMessage('STORAGE_SET', { key: 'test', value: 'saved' });

        expect(postMessage).toHaveBeenCalledWith({
            type: 'STORAGE_SET',
            data: { key: 'test', value: 'saved' },
        }, '*');
    });

    test('reports completion and forwards stats updates', () => {
        const postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
        const onStats = vi.fn();
        const platform = createRedditPlatform();
        const completion = { packId: 'star-wars', date: '2026-07-09', won: true, attempts: 2 };

        const unsubscribe = platform.reportCompletion(completion, onStats);
        window.dispatchEvent(new window.MessageEvent('message', {
            data: {
                data: {
                    message: {
                        type: 'STATS_UPDATE',
                        data: { subreddit: { totalPlayers: 5 } },
                    },
                },
            },
        }));

        expect(postMessage).toHaveBeenCalledWith({ type: 'GAME_COMPLETE', data: completion }, '*');
        expect(onStats).toHaveBeenCalledWith({ subreddit: { totalPlayers: 5 } });

        unsubscribe();
        window.dispatchEvent(new window.MessageEvent('message', {
            data: { type: 'STATS_UPDATE', data: { subreddit: { totalPlayers: 6 } } },
        }));
        expect(onStats).toHaveBeenCalledTimes(1);
    });
});
