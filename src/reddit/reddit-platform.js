export function createRedditPlatform() {
    function sendMessage(type, data) {
        window.parent.postMessage({ type, ...(data === undefined ? {} : { data }) }, '*');
    }

    return {
        kind: 'reddit',
        compactLayout: true,
        communityStats: true,
        sendMessage,

        async shareResults({ emojiText, packName }) {
            try {
                const { showToast } = await import('@devvit/web/client');
                showToast({ text: 'Creating your comment...', appearance: 'success' });
            } catch {
                // Toasts are unavailable when previewing outside Devvit.
            }

            sendMessage('SHARE_RESULTS', { shareText: emojiText, packName });
            return 'commented';
        },

        reportCompletion(completion, onStats) {
            const handler = (event) => {
                const message = event.data?.data?.message || event.data;
                if (message?.type === 'STATS_UPDATE') {
                    onStats(message.data);
                }
            };

            window.addEventListener('message', handler);
            sendMessage('GAME_COMPLETE', completion);

            return () => window.removeEventListener('message', handler);
        },
    };
}
