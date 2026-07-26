import { showToast } from '@devvit/client';

async function postJson(path, body) {
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
    return response.json();
}

export function createRedditPlatform() {
    return {
        kind: 'reddit',
        compactLayout: true,
        communityStats: true,
        postJson,

        async shareResults({ emojiText, packName }) {
            try {
                showToast({ text: 'Creating your comment...', appearance: 'success' });
            } catch {
                // Toasts are unavailable when previewing outside Devvit.
            }

            await postJson('/api/share', { shareText: emojiText, packName });
            return 'commented';
        },

        reportCompletion(completion, onStats) {
            let cancelled = false;

            postJson('/api/game-complete', completion)
                .then(({ stats }) => {
                    if (!cancelled && stats) onStats(stats);
                })
                .catch((err) => console.error('Failed to report completion:', err));

            return () => {
                cancelled = true;
            };
        },
    };
}
