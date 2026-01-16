import { Game } from '../components/Game.js';
import { GameDaily } from '../components/GameDaily.js';

export async function renderPlay(params) {
  const { packId, movieId, singleMovie, navContainer, contentContainer } = params;

  // Render nav in persistent container
  navContainer.innerHTML = `
    <a href="/" data-link class="nav-bar nav-bar-link">
      <div class="nav-logo">Scriptle</div>
    </a>
  `;

  // Render loading state in content container
  contentContainer.innerHTML = `
    <div id="loading" style="text-align:center; font-family:sans-serif; padding: 3rem;">Loading...</div>
    <div id="game-area" style="display:none;"></div>
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

      // Fetch pack data and manifest in parallel (independent requests)
      const [packRes, manifestRes] = await Promise.all([
        fetch(`/data/packs/${packId}.json`),
        fetch(`/data/daily/${packId}/manifest.json`)
      ]);

      if (!packRes.ok) {
        throw new Error(`Pack "${packId}" not found`);
      }
      if (!manifestRes.ok) {
        throw new Error(`Pack "${packId}" has no daily puzzles`);
      }

      const [packData, manifest] = await Promise.all([
        packRes.json(),
        manifestRes.json()
      ]);

      // Apply theme immediately (before fetching puzzle)
      const pack = {
        id: packId,
        name: packData.name,
        theme: packData.theme
      };
      document.title = `Scriptle - A daily ${packData.name} movie quote game`;
      applyTheme(pack);

      // Fetch puzzle and index in parallel
      const [puzzleRes, indexRes] = await Promise.all([
        fetch(`/data/daily/${packId}/${today}.json`),
        fetch('/data/index.json')
      ]);

      if (!puzzleRes.ok) {
        throw new Error(`Daily puzzle not available for ${today}. Please try again later or contact support.`);
      }

      const [dailyPuzzle, indexData] = await Promise.all([
        puzzleRes.json(),
        indexRes.ok ? indexRes.json() : Promise.resolve({ packs: [] })
      ]);

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
    const loading = contentContainer.querySelector('#loading');
    if (loading) {
      loading.innerHTML = `
        <span style="color:red; font-weight:bold;">Error loading game data.</span><br><br>
        ${e.message || 'Pack or movie not found.'}
      `;
    }
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
