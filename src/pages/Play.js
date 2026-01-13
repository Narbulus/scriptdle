import { Game } from '../components/Game.js';

export async function renderPlay(params) {
  const app = document.getElementById('app');
  const { packId, movieId, singleMovie } = params;

  app.innerHTML = `
    <div class="container">
      <div id="loading" style="text-align:center; font-family:sans-serif; padding: 3rem;">Loading...</div>
      <div id="game-area" style="display:none;"></div>
    </div>
  `;

  try {
    let pack, scripts;

    if (singleMovie && movieId) {
      // Single movie mode - load just that script
      const scriptResponse = await fetch(`/data/scripts/${movieId}.json`);
      const script = await scriptResponse.json();

      pack = {
        id: movieId,
        name: script.title,
        type: 'single',
        movies: [movieId],
        theme: { primary: '#333', secondary: '#555' }
      };
      scripts = { [movieId]: script };
    } else if (packId) {
      // Pack mode - load pack and all its scripts
      const packResponse = await fetch(`/data/packs/${packId}.json`);
      pack = await packResponse.json();

      // Load all scripts for this pack
      scripts = {};
      await Promise.all(
        pack.movies.map(async (id) => {
          const res = await fetch(`/data/scripts/${id}.json`);
          scripts[id] = await res.json();
        })
      );
    } else {
      throw new Error('No pack or movie specified');
    }

    // Apply theme
    applyTheme(pack);

    // Initialize game
    document.getElementById('loading').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';

    const game = new Game(document.getElementById('game-area'), pack, scripts);
    game.start();

  } catch (e) {
    console.error('Failed to load game:', e);
    document.getElementById('loading').innerHTML = `
      <span style="color:red; font-weight:bold;">Error loading game data.</span><br><br>
      Pack or movie not found.
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
