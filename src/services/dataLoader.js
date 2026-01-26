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

    // 1. First fetch packs-full.json to know what packs exist
    const packsRes = await fetch('/data/packs-full.json');
    if (!packsRes.ok) throw new Error('Failed to load packs');
    const packsData = await packsRes.json();

    const packIds = packsData.packs.map(p => p.id);

    // 2. Fetch all pack configs, manifests, and today's puzzles in parallel
    const packConfigFetches = packIds.map(id =>
      fetch(`/data/packs/${id}.json`).then(r => r.ok ? r.json() : null)
    );

    const manifestFetches = packIds.map(id =>
      fetch(`/data/daily/${id}/manifest.json`).then(r => r.ok ? r.json() : null)
    );

    const puzzleFetches = packIds.map(id =>
      fetch(`/data/daily/${id}/${today}.json`).then(r => r.ok ? r.json() : null)
    );

    const [packConfigs, manifests, puzzles] = await Promise.all([
      Promise.all(packConfigFetches),
      Promise.all(manifestFetches),
      Promise.all(puzzleFetches)
    ]);

    // 3. Build the cache
    const manifestsMap = {};
    const puzzlesMap = {};
    const packThemes = {};

    packIds.forEach((id, index) => {
      if (manifests[index]) manifestsMap[id] = manifests[index];
      if (puzzles[index]) puzzlesMap[id] = puzzles[index];

      // Use pack config theme if available, otherwise use theme from packs-full
      const packConfig = packConfigs[index];
      const packInfo = packsData.packs[index];
      if (packConfig?.theme) {
        packThemes[id] = packConfig.theme;
      } else if (packInfo?.theme) {
        packThemes[id] = packInfo.theme;
      }
    });

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
