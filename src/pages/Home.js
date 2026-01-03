import { router } from '../router.js';

export async function renderHome() {
  const app = document.getElementById('app');

  try {
    const response = await fetch('/data/index.json');
    const data = await response.json();

    app.innerHTML = `
      <div class="container">
        <h1>Scriptle</h1>
        <p style="text-align: center; font-family: sans-serif; color: #666; margin-bottom: 2rem;">
          Guess the character from movie scripts
        </p>

        <h2>Featured Packs</h2>
        <div class="pack-grid">
          ${data.packs.map(pack => `
            <a href="/play/${pack.id}" data-link class="pack-card">
              <h3>${pack.name}</h3>
              <div class="movie-count">${pack.movieCount} movies</div>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Failed to load pack index:', e);
    app.innerHTML = `
      <div class="container">
        <h1>Scriptle</h1>
        <p style="text-align: center; color: red;">
          Failed to load game data. Please try again later.
        </p>
      </div>
    `;
  }
}
