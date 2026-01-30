import { signal } from '@preact/signals';
import { getCurrentDate } from '../utils/time.js';

// Central cache for all game data
const dataCache = signal({
  loaded: false,
  loading: false,
  error: null,
  packs: [],
  categories: [],
  packThemes: {},
  manifests: {}, // packId -> manifest
  todaysPuzzles: {}, // packId -> puzzle
  today: null
});

/**
 * Load all game data upfront (packs, manifests, today's puzzles)
 * Returns cached data if already loaded
 */
export async function loadAllGameData() {
  // Return cached data if already loaded
  if (dataCache.value.loaded) {
    return dataCache.value;
  }

  // Prevent duplicate loads
  if (dataCache.value.loading) {
    // Wait for the current load to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (dataCache.value.loaded || dataCache.value.error) {
          clearInterval(checkInterval);
          resolve(dataCache.value);
        }
      }, 50);
    });
  }

  try {
    dataCache.value = { ...dataCache.value, loading: true, error: null };

    const today = getCurrentDate();

    // Fetch packs-full.json and consolidated daily file in parallel (2 requests instead of 28)
    const [packsRes, dailyAllRes] = await Promise.all([
      fetch('/data/packs-full.json'),
      fetch(`/data/daily-all/${today}.json`)
    ]);

    if (!packsRes.ok) throw new Error('Failed to load packs');
    const packsData = await packsRes.json();

    // Parse consolidated daily data (may not exist for older dates)
    let dailyAllData = null;
    if (dailyAllRes.ok) {
      dailyAllData = await dailyAllRes.json();
    }

    // Build the cache from consolidated data
    const packThemes = {};
    const manifestsMap = {};
    const puzzlesMap = {};

    // Extract themes from packs-full.json
    for (const pack of packsData.packs) {
      if (pack.theme) {
        packThemes[pack.id] = pack.theme;
      }
    }

    // Extract manifests and puzzles from consolidated daily file
    if (dailyAllData) {
      if (dailyAllData.manifests) {
        Object.assign(manifestsMap, dailyAllData.manifests);
      }
      if (dailyAllData.puzzles) {
        Object.assign(puzzlesMap, dailyAllData.puzzles);
      }
    }

    // Cache themes globally for optimistic loading
    window.SCRIPTLE_THEMES = packThemes;

    const cachedData = {
      loaded: true,
      loading: false,
      error: null,
      packs: packsData.packs,
      categories: packsData.categories || [],
      packThemes,
      manifests: manifestsMap,
      todaysPuzzles: puzzlesMap,
      today
    };

    dataCache.value = cachedData;
    return cachedData;

  } catch (error) {
    console.error('Failed to load game data:', error);
    dataCache.value = {
      ...dataCache.value,
      loading: false,
      error: error.message
    };
    throw error;
  }
}

/**
 * Get pack data for a specific pack
 */
export function getPackData(packId) {
  const cache = dataCache.value;
  if (!cache.loaded) return null;

  const pack = cache.packs.find(p => p.id === packId);
  if (!pack) return null;

  return {
    packData: pack,
    manifest: cache.manifests[packId],
    dailyPuzzle: cache.todaysPuzzles[packId],
    allPacks: cache.packs
  };
}

/**
 * Get the current cache (reactive signal)
 */
export function getDataCache() {
  return dataCache;
}

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export function clearCache() {
  dataCache.value = {
    loaded: false,
    loading: false,
    error: null,
    packs: [],
    categories: [],
    packThemes: {},
    manifests: {},
    todaysPuzzles: {},
    today: null
  };
}
