const STORAGE_PREFIX = 'scriptle:';
const HAS_VISITED_KEY = `${STORAGE_PREFIX}hasVisited`;
const TUTORIAL_KEY = `${STORAGE_PREFIX}tutorial`;
const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;

// --- Pluggable storage backend ---
// Default: localStorage wrapper. Call setStorageBackend() to swap (e.g. Redis on Reddit).
// Backend interface: { getItem(key), setItem(key, value), keys(), clear() }

const localStorageBackend = {
    getItem(key) {
        return localStorage.getItem(key);
    },
    setItem(key, value) {
        localStorage.setItem(key, value);
    },
    keys() {
        const result = [];
        for (let i = 0; i < localStorage.length; i++) {
            result.push(localStorage.key(i));
        }
        return result;
    },
    clear() {
        localStorage.clear();
    },
};

let backend = localStorageBackend;

export function setStorageBackend(b) {
    if (!b || typeof b.getItem !== 'function' || typeof b.setItem !== 'function'
        || typeof b.keys !== 'function' || typeof b.clear !== 'function') {
        throw new Error('Storage backend must implement getItem, setItem, keys, and clear');
    }
    backend = b;
}

export function getStorageBackend() {
    return backend;
}

// --- Public API (unchanged signatures) ---

export function isFirstVisit() {
    if (backend.getItem(HAS_VISITED_KEY)) {
        return false;
    }
    for (const key of backend.keys()) {
        if (key && key.startsWith(STORAGE_PREFIX)) {
            return false;
        }
    }
    return true;
}

export function markAsVisited() {
    backend.setItem(HAS_VISITED_KEY, 'true');
}

export function getTutorialState() {
    try {
        const raw = backend.getItem(TUTORIAL_KEY);
        return raw ? JSON.parse(raw) : { step: 1, completed: false };
    } catch (e) {
        console.warn('Failed to parse tutorial state:', e);
        return { step: 1, completed: false };
    }
}

export function saveTutorialState(state) {
    backend.setItem(TUTORIAL_KEY, JSON.stringify(state));
}

export function getTodayKey() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

export function getGameState(packId, date = getTodayKey()) {
    const key = `${STORAGE_PREFIX}${packId}:${date}`;
    try {
        const raw = backend.getItem(key);
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
        backend.setItem(key, serialized);
    } catch (e) {
        console.error(`Failed to save game state for ${key}`, e);
    }
}

export function getPackHistory(packId) {
    const history = [];
    const prefix = `${STORAGE_PREFIX}${packId}:`;

    for (const key of backend.keys()) {
        if (key && key.startsWith(prefix)) {
            try {
                const data = JSON.parse(backend.getItem(key));
                if (data.gameOver) {
                    const date = key.split(':').pop();
                    history.push({ ...data, date });
                }
            } catch (e) {
                console.warn(`Failed to parse pack history entry: ${key}`, e);
            }
        }
    }

    return history.sort((a, b) => b.date.localeCompare(a.date));
}

export function getSettings() {
    try {
        const raw = backend.getItem(SETTINGS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

export function saveSettings(settings) {
    backend.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearAllData() {
    backend.clear();
}
