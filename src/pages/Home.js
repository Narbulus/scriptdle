import { router } from '../router.js';

export async function renderHome() {
  const app = document.getElementById('app');

  // Remove any active themes when returning to home
  document.body.classList.remove('theme-hp');

  try {
    const response = await fetch('/data/index.json');
    const data = await response.json();

    app.innerHTML = `
      <div class="container">
        <div class="nav-bar nav-bar-centered">
          <div class="nav-logo">Scriptle</div>
        </div>

        <div class="script-title-section" style="flex: 1;">
          <div class="pack-grid">
            ${data.packs.map(pack => `
              <a href="/play/${pack.id}" data-link class="pack-card" data-pack-id="${pack.id}">
                <h3>${pack.name}</h3>
                <div class="movie-count">${pack.movieCount} movies</div>
              </a>
            `).join('')}
          </div>
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
