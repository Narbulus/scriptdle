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

      // Fetch manifest
      const manifestRes = await fetch(`/data/daily/${packId}/manifest.json`);
      if (!manifestRes.ok) {
        throw new Error(`Pack "${packId}" not found or has no daily puzzles`);
      }
      const manifest = await manifestRes.json();

      // Fetch today's puzzle
      const puzzleRes = await fetch(`/data/daily/${packId}/${today}.json`);
      if (!puzzleRes.ok) {
        throw new Error(`Daily puzzle not available for ${today}. Please try again later or contact support.`);
      }
      const dailyPuzzle = await puzzleRes.json();

      // Apply theme from manifest
      const pack = {
        id: packId,
        name: manifest.packName,
        theme: manifest.theme
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
  // Remove existing theme classes
  document.body.classList.remove('theme-hp', 'theme-the-lord-of-the-rings');

  // Apply pack-specific theme based on ID
  if (pack.id === 'harry-potter' || pack.id.startsWith('hp-')) {
    document.body.classList.add('theme-hp');
  } else if (pack.id === 'the-lord-of-the-rings' || pack.id.startsWith('the-lord-of-the-rings-')) {
    document.body.classList.add('theme-the-lord-of-the-rings');
  }

  // Could also use pack.theme for custom colors via CSS variables
  if (pack.theme) {
    document.documentElement.style.setProperty('--pack-primary', pack.theme.primary);
    document.documentElement.style.setProperty('--pack-secondary', pack.theme.secondary);
  }
}
