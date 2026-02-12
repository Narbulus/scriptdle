import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Game } from '../components/game/Game.jsx';
import { setStorageBackend, getSettings } from '../services/storage.js';
import { createRedisBackend } from './redis-storage.js';
import { SettingsModalContainer, openSettingsModal } from './Settings.jsx';
import { StatsModalContainer } from '../pages/Stats.jsx';
import { Settings as SettingsIcon } from 'lucide-preact';

// Import styles - same as main app minus home/stats/legal/menu pages
import '../styles/variables.css';
import '../styles/global.css';
import '../styles/themes.css';
import '../components/game/game.css';
import '../components/game/completion.css';
import '../components/game/stats.css';
import '../pages/stats.css';
import './reddit-overrides.css';

// Fetch from bundled data (relative URL passes CSP 'self' check)
const SCRIPTLE_DATA_URL = 'data/daily-all';

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

// Fade out and remove the loading overlay
function dismissLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

function fetchWithTimeout(url, timeoutMs = 10000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out: ${url}`)), timeoutMs)
    ),
  ]);
}

async function fetchPuzzleData(date, packId) {
  // Fetch daily-all and packs-full in parallel (with timeout to avoid hanging)
  const [dailyRes, packsRes] = await Promise.all([
    fetchWithTimeout(`${SCRIPTLE_DATA_URL}/${date}.json`),
    fetchWithTimeout('data/packs-full.json'),
  ]);
  if (!dailyRes.ok) throw new Error(`Failed to fetch puzzle: ${dailyRes.status}`);
  const dailyAll = await dailyRes.json();

  const puzzle = dailyAll.puzzles?.[packId];
  if (!puzzle) {
    throw new Error(`No puzzle for "${packId}" on ${date}. This pack may not have been available yet on this date.`);
  }

  // Get theme, manifest, and gameMetadata from packs-full.json
  let theme = null;
  let manifest = null;
  if (packsRes.ok) {
    const packsData = await packsRes.json();
    const pack = packsData.packs?.find(p => p.id === packId);
    if (pack) {
      theme = pack.theme;
      manifest = pack.manifest;
      // Re-attach gameMetadata to puzzle if not already present
      if (!puzzle.metadata && pack.gameMetadata) {
        puzzle.metadata = pack.gameMetadata;
      }
    }
  }

  return { puzzle, manifest, theme };
}

function RedditApp() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let configReceived = false;
    let retryTimer = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const RETRY_INTERVAL = 3000;

    // Listen for config from Devvit (date + packId), then fetch puzzle data directly
    const handler = async (ev) => {
      const msg = ev.data;
      if (msg?.type === 'devvit-message') {
        const payload = msg.data?.message;
        if (payload?.type === 'PUZZLE_CONFIG') {
          configReceived = true;
          if (retryTimer) clearInterval(retryTimer);
          const { date, packId, storageData } = payload.data;

          // Set up Redis-backed storage before anything touches game state
          setStorageBackend(createRedisBackend(storageData || {}));
          try {
            const { puzzle, manifest, theme } = await fetchPuzzleData(date, packId);
            const packInfo = { theme, name: manifest?.packName };
            applyTheme(theme);
            setData({
              dailyPuzzle: {
                puzzle: puzzle.puzzle,
                metadata: puzzle.metadata,
                packId: puzzle.packId,
                date: puzzle.date,
              },
              manifest,
              packData: packInfo,
            });
          } catch (err) {
            console.error('Failed to load puzzle:', err);
            setError(err.message);
            dismissLoadingOverlay();
          }
        }
      }
    };
    window.addEventListener('message', handler);

    // Set up share handler for Reddit — posts results as a comment
    window.SCRIPTLE_SHARE_HANDLER = async (shareText, packName) => {
      try {
        const { showToast } = await import('@devvit/web/client');
        showToast({ text: 'Creating your comment...', appearance: 'success' });
      } catch { /* toast unavailable outside Devvit */ }
      window.parent.postMessage(
        { type: 'SHARE_RESULTS', data: { shareText, packName } },
        '*'
      );
    };

    // Set pack theme context on body so themed CSS selectors work
    document.body.setAttribute('data-theme', 'pack');

    // Apply reduced motion setting from storage
    if (getSettings().reducedMotion) {
      document.documentElement.setAttribute('data-reduced-motion', '');
    }

    // Tell Devvit we're ready for config
    window.parent.postMessage({ type: 'READY' }, '*');

    // Retry sending READY if we don't get a response — covers message loss and Devvit errors
    retryTimer = setInterval(() => {
      if (configReceived) {
        clearInterval(retryTimer);
        return;
      }
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        clearInterval(retryTimer);
        setError('Unable to connect to Reddit. Please try refreshing the page.');
        dismissLoadingOverlay();
        return;
      }
      console.warn(`PUZZLE_CONFIG not received, retrying READY (${retryCount}/${MAX_RETRIES})...`);
      window.parent.postMessage({ type: 'READY' }, '*');
    }, RETRY_INTERVAL);

    return () => {
      window.removeEventListener('message', handler);
      if (retryTimer) clearInterval(retryTimer);
    };
  }, []);

  // Dismiss overlay once game data is loaded and rendered
  useEffect(() => {
    if (data) {
      // Small delay to let the game render one frame before fading out
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dismissLoadingOverlay();
        });
      });
    }
  }, [data]);

  if (error) {
    return (
      <div style="text-align:center;padding:3rem;color:#ff6b6b;">
        <h2>Puzzle Unavailable</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    // The HTML loading overlay is still visible — no need to render anything here
    return null;
  }

  return (
    <div id="game-area">
      <nav class="reddit-nav-bar">
        <div class="reddit-nav-spacer" aria-hidden="true" />
        <span class="reddit-nav-title">{data.packData.name}</span>
        <button class="reddit-settings-btn" onClick={openSettingsModal} aria-label="Settings">
          <SettingsIcon size={16} strokeWidth={2} />
        </button>
      </nav>
      <Game
        dailyPuzzle={data.dailyPuzzle}
        manifest={data.manifest}
        packData={data.packData}
      />
      <SettingsModalContainer />
      <StatsModalContainer />
    </div>
  );
}

render(<RedditApp />, document.getElementById('app'));
