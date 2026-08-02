import { useEffect } from 'preact/hooks';
import { Game } from '../components/game/Game.jsx';
import { SettingsModalContainer, openSettingsModal } from './Settings.jsx';
import { StatsModalContainer } from '../pages/Stats.jsx';
import { prewarmToast } from './reddit-platform.js';
import { Settings as SettingsIcon } from 'lucide-preact';

/**
 * Everything past the splash, in one lazily-imported chunk.
 *
 * Nothing here is needed to paint the splash, and it is the bulk of both the
 * JS and the CSS — keeping it out of the entry chunk is what lets the first
 * paint happen on one round trip. reddit-entry.jsx starts importing this as
 * soon as the splash is up, so it is warm long before anyone taps Start.
 */
import '../components/game/game.css';
import '../components/common/script-select.css'; // after game.css (beats bare `button`)
import '../components/game/paper.css';           // after game.css
import '../components/game/completion.css';
import '../components/game/completion-type.css'; // after completion.css
import '../components/game/stats.css';
import '../pages/stats.css';
import '../pages/collection.css';                // after stats.css
import './reddit-overrides.css';

export default function GameShell({ dailyPuzzle, manifest, packData }) {
  // Sharing needs @devvit/client, which is big. Pull it in once the board is up
  // and the connection is idle, so the share toast is instant when it is wanted.
  useEffect(() => {
    const idle = window.requestIdleCallback || (fn => window.setTimeout(fn, 2000));
    idle(prewarmToast);
  }, []);

  return (
    <div id="game-area">
      <nav class="reddit-nav-bar" data-platform-nav>
        <div class="reddit-nav-spacer" aria-hidden="true" />
        <span class="reddit-nav-title">{packData.name}</span>
        <button class="reddit-settings-btn" onClick={openSettingsModal} aria-label="Settings">
          <SettingsIcon size={16} strokeWidth={2} />
        </button>
      </nav>
      <Game
        dailyPuzzle={dailyPuzzle}
        manifest={manifest}
        packData={packData}
      />
      <SettingsModalContainer />
      <StatsModalContainer />
    </div>
  );
}
