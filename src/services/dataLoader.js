import { signal } from '@preact/signals';
import { getCurrentDate } from '../utils/time.js';

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new globalThis.AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getDataUrl(basePath, path) {
  return `${basePath.replace(/\/$/, '')}/${path}`;
}

function buildGameData(packsData, dailyAllData, date) {
  const packThemes = {};
  const manifests = {};
  const gameMetadata = {};
  const puzzles = {};

  for (const pack of packsData.packs || []) {
    if (pack.theme) packThemes[pack.id] = pack.theme;
    if (pack.manifest) manifests[pack.id] = pack.manifest;
    if (pack.gameMetadata) gameMetadata[pack.id] = pack.gameMetadata;
  }

  for (const [packId, puzzle] of Object.entries(dailyAllData?.puzzles || {})) {
    puzzles[packId] = puzzle.metadata || !gameMetadata[packId]
      ? puzzle
      : { ...puzzle, metadata: gameMetadata[packId] };
  }

  return {
    packs: packsData.packs || [],
    categories: packsData.categories || [],
    packThemes,
    manifests,
    puzzles,
    date,
  };
}

export async function loadGameDataForDate(date, { basePath = '/data', timeout = 10000 } = {}) {
  const [packsResponse, dailyResponse] = await Promise.all([
    fetchWithTimeout(getDataUrl(basePath, 'packs-full.json'), timeout),
    fetchWithTimeout(getDataUrl(basePath, `daily-all/${date}.json`), timeout),
  ]);

  if (!packsResponse.ok) {
    throw new Error(`Failed to load packs: ${packsResponse.status}`);
  }

  const packsData = await packsResponse.json();
  const dailyAllData = dailyResponse.ok ? await dailyResponse.json() : null;

  return buildGameData(packsData, dailyAllData, date);
}

export async function loadPuzzleForDate(date, packId, options = {}) {
  const gameData = await loadGameDataForDate(date, options);
  const puzzle = gameData.puzzles[packId];

  if (!puzzle) {
    throw new Error(`No puzzle for "${packId}" on ${date}. This pack may not have been available yet on this date.`);
  }

  const pack = gameData.packs.find(candidate => candidate.id === packId);

  return {
    puzzle,
    manifest: gameData.manifests[packId] || null,
    theme: gameData.packThemes[packId] || null,
    packData: pack || null,
  };
}

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
    // Wait for the current load to complete (with 30s timeout)
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = 30000; // 30 seconds

      const checkInterval = setInterval(() => {
        if (dataCache.value.loaded || dataCache.value.error) {
          clearInterval(checkInterval);
          resolve(dataCache.value);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          // Force clear loading state on timeout
          dataCache.value = { ...dataCache.value, loading: false, error: 'Loading timeout' };
          reject(new Error('Loading timeout - please refresh'));
        }
      }, 50);
    });
  }

  try {
    dataCache.value = { ...dataCache.value, loading: true, error: null };

    const today = getCurrentDate();

    const gameData = await loadGameDataForDate(today);

    const cachedData = {
      loaded: true,
      loading: false,
      error: null,
      packs: gameData.packs,
      categories: gameData.categories,
      packThemes: gameData.packThemes,
      manifests: gameData.manifests,
      todaysPuzzles: gameData.puzzles,
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
