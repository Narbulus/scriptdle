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
import { getCharacterGuesses, Splash } from './Splash.jsx';
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

/**
 * Which puzzle to show, plus the player's saved state. Served by the Devvit
 * server from the post's own `postData`, so there's no host handshake to wait on.
 */
async function fetchInitConfig() {
  if (import.meta.env.DEV) {
    const params = new window.URLSearchParams(window.location.search);
    const previewPackId = params.get('previewPack');
    const previewDate = params.get('previewDate');
    if (previewPackId && previewDate) {
      return { date: previewDate, packId: previewPackId, storageData: {} };
    }
  }

  const response = await fetch('/api/init');
  if (!response.ok) {
    throw new Error(`Unable to load today's puzzle (${response.status}). Try refreshing the page.`);
  }
  return response.json();
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
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Set pack theme context on body so themed CSS selectors work
    document.body.setAttribute('data-theme', 'pack');
    applyStoredSettings();

    (async () => {
      try {
        const config = await fetchInitConfig();
        if (cancelled) return;

        const { date, packId, storageData } = config;

        // Set up Redis-backed storage before anything touches game state
        setStorageBackend(createRedisBackend(storageData || {}));

        const { puzzle, manifest, theme } = await loadPuzzleForDate(date, packId, { basePath: 'data' });
        if (cancelled) return;

        applyTheme(theme);
        setData({
          dailyPuzzle: {
            puzzle: puzzle.puzzle,
            metadata: puzzle.metadata,
            packId: puzzle.packId,
            date: puzzle.date,
          },
          manifest,
          packData: { theme, name: manifest?.packName },
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load puzzle:', err);
        setError(err.message);
        dismissLoadingOverlay();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The HTML bootstrap and React splash share the same composition. Hand off as
  // soon as the first React frame is painted; puzzle content hydrates in place.
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dismissLoadingOverlay();
      });
    });
  }, []);

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
