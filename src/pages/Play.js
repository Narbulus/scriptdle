import { Game } from '../components/Game.js';
import { GameDaily } from '../components/GameDaily.js';

export async function renderPlay(params) {
  const app = document.getElementById('app');
  const { packId, movieId, singleMovie } = params;

  app.innerHTML = `
    <div class="container">
      <!-- Navigation Bar - Always visible -->
      <a href="/" data-link class="nav-bar nav-bar-link">
        <div class="nav-logo">Scriptle</div>
      </a>

      <div id="loading" style="text-align:center; font-family:sans-serif; padding: 3rem;">Loading...</div>
      <div id="game-area" style="display:none;"></div>
    </div>
  `;

  try {
    if (singleMovie && movieId) {
      // Single movie mode - use traditional full script loading
      const scriptResponse = await fetch(`/data/scripts/${movieId}.json`);
      const script = await scriptResponse.json();

      const pack = {
        id: movieId,
        name: script.title,
        type: 'single',
        movies: [movieId],
        theme: { primary: '#333', secondary: '#555' }
      };
      const scripts = { [movieId]: script };

      // Apply theme
      applyTheme(pack);

      // Initialize traditional game
      document.getElementById('loading').style.display = 'none';
      document.getElementById('game-area').style.display = 'block';

      const game = new Game(document.getElementById('game-area'), pack, scripts);
      game.start();

    } else if (packId) {
      // Pack mode - use pre-generated daily puzzle
      const today = new Date().toISOString().split('T')[0];

      // Fetch pack definition for theme
      const packRes = await fetch(`/data/packs/${packId}.json`);
      if (!packRes.ok) {
        throw new Error(`Pack "${packId}" not found`);
      }
      const packData = await packRes.json();

      // Fetch manifest
      const manifestRes = await fetch(`/data/daily/${packId}/manifest.json`);
      if (!manifestRes.ok) {
        throw new Error(`Pack "${packId}" has no daily puzzles`);
      }
      const manifest = await manifestRes.json();

      // Fetch today's puzzle
      const puzzleRes = await fetch(`/data/daily/${packId}/${today}.json`);
      if (!puzzleRes.ok) {
        throw new Error(`Daily puzzle not available for ${today}. Please try again later or contact support.`);
      }
      const dailyPuzzle = await puzzleRes.json();

      // Apply theme from pack definition
      const pack = {
        id: packId,
        name: packData.name,
        theme: packData.theme
      };
      applyTheme(pack);

      // Initialize daily game
      document.getElementById('loading').style.display = 'none';
      document.getElementById('game-area').style.display = 'block';

      const game = new GameDaily(
        document.getElementById('game-area'),
        manifest,
        dailyPuzzle
      );
      game.start();

    } else {
      throw new Error('No pack or movie specified');
    }

  } catch (e) {
    console.error('Failed to load game:', e);
    document.getElementById('loading').innerHTML = `
      <span style="color:red; font-weight:bold;">Error loading game data.</span><br><br>
      ${e.message || 'Pack or movie not found.'}
    `;
  }
}

function applyTheme(pack) {
  // Apply theme dynamically via CSS variables
  if (pack.theme) {
    const t = pack.theme;
    document.documentElement.style.setProperty('--primary-color', t.primary || '#333');
    document.documentElement.style.setProperty('--bg-color', t.bgColor || '#f4f4f4');
    document.documentElement.style.setProperty('--container-bg', t.containerBg || 'white');
    document.documentElement.style.setProperty('--accent-color', t.accentColor || '#555');
    document.documentElement.style.setProperty('--btn-text', t.btnText || 'white');
  }
}
