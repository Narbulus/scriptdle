import { Game } from '../components/Game.js';
import { GameDaily } from '../components/GameDaily.js';
import { Navigation } from '../components/Navigation.js';

export async function renderPlay(params) {
  const app = document.getElementById('app');
  const { packId, movieId, singleMovie } = params;

  // Create container
  const container = document.createElement('div');
  container.className = 'container';

  // Add navigation with back button
  const nav = Navigation({ showBackButton: true });
  container.appendChild(nav);

  // Add loading and game area
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading';
  loadingDiv.style.textAlign = 'center';
  loadingDiv.style.fontFamily = 'sans-serif';
  loadingDiv.style.padding = '3rem';
  loadingDiv.textContent = 'Loading...';
  container.appendChild(loadingDiv);

  const gameAreaDiv = document.createElement('div');
  gameAreaDiv.id = 'game-area';
  gameAreaDiv.style.display = 'none';
  container.appendChild(gameAreaDiv);

  app.innerHTML = '';
  app.appendChild(container);

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

      // Set page title
      document.title = `Scriptle - A daily ${script.title} movie quote game`;

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

      // Fetch pack index to get all packs
      const indexRes = await fetch('/data/index.json');
      const indexData = indexRes.ok ? await indexRes.json() : { packs: [] };

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

      // Set page title
      document.title = `Scriptle - A daily ${packData.name} movie quote game`;

      applyTheme(pack);

      // Initialize daily game
      document.getElementById('loading').style.display = 'none';
      document.getElementById('game-area').style.display = 'block';

      const game = new GameDaily(
        document.getElementById('game-area'),
        manifest,
        dailyPuzzle,
        indexData.packs,
        packData
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
