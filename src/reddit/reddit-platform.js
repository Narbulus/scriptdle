/**
 * `showToast` is the only thing this file wants from @devvit/client, and that
 * package pulls in @devvit/protos + protobufjs + long — around 250kB of source,
 * which was the bulk of the boot chunk. It is not needed until someone finishes
 * a game and shares, so it loads on its own.
 */
let devvitClient = null;

/** Fetch the chunk ahead of time so the toast is not late to its own message. */
export function prewarmToast() {
    devvitClient = devvitClient || import('@devvit/client').catch(() => null);
    return devvitClient;
}

async function toast(text) {
    const mod = await prewarmToast();
    try {
        mod?.showToast({ text, appearance: 'success' });
    } catch {
        // Toasts are unavailable when previewing outside Devvit.
    }
}

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
            toast('Creating your comment...');

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
