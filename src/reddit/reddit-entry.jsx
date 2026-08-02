import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { setStorageBackend } from '../services/storage.js';
import { applyStoredSettings } from '../services/settings.js';
import { configurePlatform } from '../services/platform.js';
import { createRedisBackend } from './redis-storage.js';
import { createRedditPlatform } from './reddit-platform.js';
import { getCharacterGuesses, Splash } from './Splash.jsx';

// Only what the splash needs. The game's stylesheets ship with GameShell.
import '../styles/variables.css';
import '../styles/global.css';
import '../styles/themes.css';
import '../styles/foxing.css';
import './reddit-shell.css';

const redditPlatform = createRedditPlatform();
configurePlatform(redditPlatform);

/**
 * If the puzzle still hasn't arrived by now, stop hiding behind the loading
 * background and show the splash regardless — a bare card beats a dead embed.
 */
const REVEAL_DEADLINE_MS = 6000;

// Warm the game chunk while the reader is still on the splash. The resolved
// component is kept here so that by the time Start is tapped the swap is
// synchronous — an already-warm dynamic import still settles a microtask late,
// which is long enough to flash an empty frame mid-transition.
let gameShell = null;
const loadGameShell = () => import('./GameShell.jsx').then(mod => {
  gameShell = mod.default;
  return gameShell;
});

function applyTheme(t) {
  if (!t) return;
  const root = document.documentElement;
  root.style.setProperty('--pack-primary', t.primary || '#333');
  root.style.setProperty('--pack-bg', t.bgColor || '#f4f4f4');
  root.style.setProperty('--pack-surface', t.containerBg || '#ffffff');
  root.style.setProperty('--pack-accent', t.accentColor || '#555');
  root.style.setProperty('--pack-btn-text', t.btnText || '#ffffff');
  root.style.setProperty('--pack-text', t.primary || '#333');
  root.style.setProperty('--pack-text-secondary', t.accentColor || '#555');
  root.style.setProperty('--pack-text-muted', t.muted || '#999');
  root.style.setProperty('--pack-card-gradient-start', t.cardGradientStart || t.bgColor || '#333');
  root.style.setProperty('--pack-card-gradient-end', t.cardGradientEnd || t.bgColor || '#555');
  root.style.setProperty('--pack-card-border', t.cardBorder || t.primary || '#333');
  root.style.setProperty('--pack-card-text', t.cardText || '#ffffff');
}

function getPreviewConfig() {
  if (!import.meta.env.DEV) return null;
  const params = new window.URLSearchParams(window.location.search);
  const packId = params.get('previewPack');
  const date = params.get('previewDate');
  return packId && date ? { date, packId, storageData: {} } : null;
}

/**
 * Which puzzle to show, plus the player's saved state. The inline bootstrap in
 * the HTML fires this request before the bundle has finished downloading, so by
 * the time we get here the answer is usually already in flight or in hand.
 */
function fetchInitConfig() {
  const preview = getPreviewConfig();
  if (preview) return Promise.resolve(preview);

  if (window.__scriptleInit) return window.__scriptleInit;

  return fetch('/api/init').then(response => {
    if (!response.ok) {
      throw new Error(`Unable to load today's puzzle (${response.status}). Try refreshing the page.`);
    }
    return response.json();
  });
}

/**
 * The day's puzzle. Same deal — the bootstrap chains this straight off
 * /api/init, so it does not wait on the bundle either.
 */
function fetchDaily(date) {
  if (!getPreviewConfig() && window.__scriptleDaily) return window.__scriptleDaily;

  return fetch(`data/daily-all/${date}.json`).then(response => {
    if (!response.ok) {
      throw new Error(`Unable to load today's puzzle (${response.status}). Try refreshing the page.`);
    }
    return response.json();
  });
}

/**
 * The pack's theme, manifest and character/movie metadata.
 *
 * Per-pack HTML entrypoints carry their own pack inline (see
 * scripts/bundle-reddit-data.js), which keeps the 54kB packs-full.json off the
 * critical path entirely. The shared `default` entrypoint has no inline pack,
 * so it still fetches — as does the dev preview.
 */
async function loadPack(packId) {
  const inlined = window.__SCRIPTLE_PACK__;
  if (inlined?.id === packId) return inlined;

  const response = await fetch('data/packs-full.json');
  if (!response.ok) throw new Error(`Failed to load packs: ${response.status}`);
  const packsData = await response.json();

  const pack = (packsData.packs || []).find(candidate => candidate.id === packId);
  if (!pack) throw new Error(`No pack data for "${packId}".`);
  return pack;
}

async function loadPuzzle() {
  const config = await fetchInitConfig();
  const { date, packId, storageData } = config;

  // Set up Redis-backed storage before anything touches game state
  setStorageBackend(createRedisBackend(storageData || {}));

  const [dailyAll, pack] = await Promise.all([fetchDaily(date), loadPack(packId)]);

  const puzzle = dailyAll?.puzzles?.[packId];
  if (!puzzle) {
    throw new Error(`No puzzle for "${packId}" on ${date}. This pack may not have been available yet on this date.`);
  }

  // Daily files carry metadata only when it differs from the pack's own.
  const metadata = puzzle.metadata || pack.gameMetadata;

  return {
    dailyPuzzle: {
      puzzle: puzzle.puzzle,
      metadata,
      packId: puzzle.packId,
      date: puzzle.date,
    },
    manifest: pack.manifest || null,
    packData: { theme: pack.theme, name: pack.manifest?.packName || pack.name },
  };
}

// Fade out and remove the loading overlay
function dismissLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  // transitionend is not guaranteed — a backgrounded webview, reduced-motion,
  // or a skipped transition all leave it unfired, stranding the overlay in the
  // DOM. It is invisible and click-through at that point, but still a leak.
  const remove = () => overlay.remove();
  overlay.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 600);
}

function RedditApp() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Set pack theme context on body so themed CSS selectors work
    document.body.setAttribute('data-theme', 'pack');

    loadPuzzle()
      .then(loaded => {
        if (cancelled) return;
        applyStoredSettings();
        applyTheme(loaded.packData.theme);
        setData(loaded);
        loadGameShell();
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load puzzle:', err);
        setError(err.message);
      });

    // Nothing worth looking at until the puzzle lands, so stay behind the
    // themed loading background rather than flashing an empty card. The
    // deadline is the escape hatch for a request that never comes back.
    const deadline = window.setTimeout(() => {
      if (!cancelled) setRevealed(true);
    }, REVEAL_DEADLINE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(deadline);
    };
  }, []);

  const ready = Boolean(data) || Boolean(error);

  // Hand off to the splash only once it has something real to show. Two frames
  // so the first painted frame of the splash is the one the reader sees
  // underneath the fading overlay.
  useEffect(() => {
    if (!ready && !revealed) return undefined;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(dismissLoadingOverlay);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, revealed]);

  if (error) {
    return (
      <div style="text-align:center;padding:3rem;color:#ff6b6b;">
        <h2>Puzzle Unavailable</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!hasStarted) {
    const metadata = data?.dailyPuzzle.metadata;
    const movieTitles = metadata?.movies
      ?.map(movieId => metadata.movieTitles?.[movieId] || movieId)
      .filter(Boolean) || [];
    const characterGuesses = getCharacterGuesses(
      metadata,
      data?.dailyPuzzle.puzzle.targetLine.character,
    );

    return (
      <Splash
        characterGuesses={characterGuesses}
        movieTitles={movieTitles}
        quote={data?.dailyPuzzle.puzzle.targetLine.text || ''}
        onStart={() => setHasStarted(true)}
        ready={Boolean(data)}
      />
    );
  }

  return <GameArea {...data} />;
}

/**
 * Renders the lazy game chunk, holding the splash's place until it resolves.
 * In practice it is already cached — the import starts the moment the puzzle
 * lands, long before anyone taps Start.
 */
function GameArea(props) {
  const [Shell, setShell] = useState(() => gameShell);

  useEffect(() => {
    if (Shell) return undefined;
    let cancelled = false;
    loadGameShell().then(component => {
      if (!cancelled) setShell(() => component);
    });
    return () => { cancelled = true; };
  }, [Shell]);

  if (!Shell) return <div id="game-area" />;
  return <Shell {...props} />;
}

render(<RedditApp />, document.getElementById('app'));
