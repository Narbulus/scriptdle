import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Game } from '../components/game/Game.jsx';
import { setStorageBackend } from '../services/storage.js';
import { applyStoredSettings } from '../services/settings.js';
import { configurePlatform } from '../services/platform.js';
import { loadPuzzleForDate } from '../services/dataLoader.js';
import { createRedisBackend } from './redis-storage.js';
import { createRedditPlatform } from './reddit-platform.js';
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

const redditPlatform = createRedditPlatform();
configurePlatform(redditPlatform);

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

function RedditApp() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let configReceived = false;
    let retryTimer = null;
    let retryCount = 0;
    const MAX_RETRIES = 6;
    const BASE_DELAY = 1500; // 1.5s, 3s, 6s, 12s, 24s, 48s

    // Listen for config from Devvit (date + packId), then fetch puzzle data directly
    const handler = async (ev) => {
      const msg = ev.data;
      if (msg?.type === 'devvit-message') {
        const payload = msg.data?.message;
        if (payload?.type === 'PUZZLE_CONFIG') {
          // Deduplicate: only process the first PUZZLE_CONFIG
          if (configReceived) return;
          configReceived = true;
          if (retryTimer) clearTimeout(retryTimer);
          const { date, packId, storageData } = payload.data;

          // Set up Redis-backed storage before anything touches game state
          setStorageBackend(createRedisBackend(storageData || {}));
          try {
            const { puzzle, manifest, theme } = await loadPuzzleForDate(date, packId, { basePath: 'data' });
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

    // Set pack theme context on body so themed CSS selectors work
    document.body.setAttribute('data-theme', 'pack');

    applyStoredSettings();

    // Tell Devvit we're ready for config
    redditPlatform.sendMessage('READY');

    // Retry sending READY with exponential backoff
    function scheduleRetry() {
      if (configReceived) return;
      if (retryCount >= MAX_RETRIES) {
        setError('Unable to connect to Reddit. Please try refreshing the page.');
        dismissLoadingOverlay();
        return;
      }
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      retryTimer = setTimeout(() => {
        if (configReceived) return;
        retryCount++;
        console.warn(`PUZZLE_CONFIG not received, retrying READY (${retryCount}/${MAX_RETRIES})...`);
        redditPlatform.sendMessage('READY');
        scheduleRetry();
      }, delay);
    }
    scheduleRetry();

    return () => {
      window.removeEventListener('message', handler);
      if (retryTimer) clearTimeout(retryTimer);
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
      <nav class="reddit-nav-bar" data-platform-nav>
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
