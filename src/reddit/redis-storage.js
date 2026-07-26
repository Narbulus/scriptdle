import { getPlatform } from '../services/platform.js';

// Redis-backed storage for the Devvit webview.
// All user state is pre-loaded from /api/init, so reads stay synchronous from
// the in-memory cache. Writes update the cache immediately and are flushed to
// Redis fire-and-forget.

const cache = new Map();

export function createRedisBackend(initialData) {
  cache.clear();
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
      getPlatform()
        .postJson('/api/storage', { key, value })
        .catch((err) => console.error('Failed to persist storage key:', key, err));
    },

    keys() {
      return Array.from(cache.keys());
    },

    clear() {
      cache.clear();
      getPlatform()
        .postJson('/api/storage/clear')
        .catch((err) => console.error('Failed to clear storage:', err));
    },
  };
}
