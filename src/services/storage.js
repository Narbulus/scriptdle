const STORAGE_PREFIX = 'scriptle:';
const HAS_VISITED_KEY = `${STORAGE_PREFIX}hasVisited`;

export function isFirstVisit() {
    if (localStorage.getItem(HAS_VISITED_KEY)) {
        return false;
    }
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            return false;
        }
    }
    return true;
}

export function markAsVisited() {
    localStorage.setItem(HAS_VISITED_KEY, 'true');
}

export function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

export function getGameState(packId, date = getTodayKey()) {
    const key = `${STORAGE_PREFIX}${packId}:${date}`;
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn(`Failed to parse game state for ${key}`, e);
        return null;
    }
}

export function saveGameState(packId, state, date = getTodayKey()) {
    const key = `${STORAGE_PREFIX}${packId}:${date}`;
    try {
        const serialized = JSON.stringify({
            version: 2,
            ...state,
            lastUpdated: new Date().toISOString()
        });
        localStorage.setItem(key, serialized);
    } catch (e) {
        console.error(`Failed to save game state for ${key}`, e);
    }
}

export function getPackHistory(packId) {
    const history = [];
    const prefix = `${STORAGE_PREFIX}${packId}:`;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data.gameOver) {
                    const date = key.split(':').pop();
                    history.push({ ...data, date });
                }
            } catch {
                // Ignore corrupted entries
            }
        }
    }

    return history.sort((a, b) => b.date.localeCompare(a.date));
}

export function clearAllData() {
    localStorage.clear();
}
