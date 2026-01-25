/**
 * storage.js
 * LocalStorage wrapper ensuring type safety and schema consistency.
 */

const KEYS = {
    GAME_PREFIX: 'scriptle:',
};

// Helper to get today's date in YYYY-MM-DD format
export const getTodayKey = () => new Date().toISOString().split('T')[0];

/**
 * Get game state for a specific pack and date.
 * @param {string} packId 
 * @param {string} [date] - Defaults to today
 * @returns {Object|null}
 */
export function getGameState(packId, date = getTodayKey()) {
    const key = `${KEYS.GAME_PREFIX}${packId}:${date}`;
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn(`Failed to parse game state for ${key}`, e);
        return null;
    }
}

/**
 * Save game state.
 * @param {string} packId 
 * @param {Object} state 
 * @param {string} [date] 
 */
export function saveGameState(packId, state, date = getTodayKey()) {
    const key = `${KEYS.GAME_PREFIX}${packId}:${date}`;
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

/**
 * Get all completion history for a pack.
 * Useful for stats calculation.
 * @param {string} packId
 * @returns {Array<Object>} List of completed game states
 */
export function getPackHistory(packId) {
    const history = [];
    const prefix = `${KEYS.GAME_PREFIX}${packId}:`;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data.gameOver) {
                    // Extract date from key "scriptle:packId:YYYY-MM-DD"
                    const date = key.split(':').pop();
                    history.push({ ...data, date });
                }
            } catch (e) {
                // Ignore corrupted entries
            }
        }
    }

    // Sort by date descending
    return history.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Clear all game data (debug/dev utility)
 */
export function clearAllData() {
    localStorage.clear();
}
