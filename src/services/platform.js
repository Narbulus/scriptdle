const webPlatform = {
    kind: 'web',
    compactLayout: false,
    communityStats: false,

    async shareResults({ title, text, url }) {
        const shareData = { title, text, url };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return 'shared';
            } catch {
                // Preserve the existing behavior: cancelled/failed native shares fall back to copying.
            }
        }

        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        return 'copied';
    },

    reportCompletion() {
        return () => {};
    },

    async postJson() {
        return {};
    },
};

let currentPlatform = webPlatform;

export function configurePlatform(platform) {
    if (!platform || typeof platform.kind !== 'string') {
        throw new Error('Platform adapter must define a kind');
    }

    currentPlatform = { ...webPlatform, ...platform };
}

export function getPlatform() {
    return currentPlatform;
}

export function isCompactPlatform() {
    return currentPlatform.compactLayout;
}

export function resetPlatform() {
    currentPlatform = webPlatform;
}
