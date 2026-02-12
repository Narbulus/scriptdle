// Redis-backed storage for Devvit WebView.
// Pre-loads all user state from Redis on init (sent with PUZZLE_CONFIG).
// Reads are synchronous from the in-memory cache.
// Writes update cache immediately and fire-and-forget to Devvit host via postMessage.

const cache = new Map();

export function createRedisBackend(initialData) {
  // Populate cache from data sent by Devvit host
  if (initialData) {
    for (const [key, value] of Object.entries(initialData)) {
      cache.set(key, value);
    }
  }

  return {
    getItem(key) {
      return cache.get(key) ?? null;
    },

    setItem(key, value) {
      cache.set(key, value);
      // Fire-and-forget to Devvit host → Redis
      window.parent.postMessage({ type: 'STORAGE_SET', data: { key, value } }, '*');
    },

    keys() {
      return Array.from(cache.keys());
    },

    clear() {
      cache.clear();
      window.parent.postMessage({ type: 'STORAGE_CLEAR' }, '*');
    },
  };
}
