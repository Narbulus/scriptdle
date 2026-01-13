import { router } from '../router.js';

export async function renderHome() {
  const app = document.getElementById('app');

  // Set page title for home
  document.title = 'Scriptle - A daily movie quote game';

  // Reset CSS variables to defaults when returning to home
  document.documentElement.style.setProperty('--primary-color', '#333');
  document.documentElement.style.setProperty('--bg-color', '#f4f4f4');
  document.documentElement.style.setProperty('--container-bg', 'white');
  document.documentElement.style.setProperty('--accent-color', '#555');
  document.documentElement.style.setProperty('--btn-text', 'white');

  try {
    const response = await fetch('/data/index.json');
    const data = await response.json();

    // Fetch theme data for each pack
    const packThemes = {};
    await Promise.all(data.packs.map(async pack => {
      try {
        const packResponse = await fetch(`/data/packs/${pack.id}.json`);
        const packData = await packResponse.json();
        packThemes[pack.id] = packData.theme;
      } catch (e) {
        console.error(`Failed to load theme for ${pack.id}:`, e);
      }
    }));

    app.innerHTML = `
      <div class="container">
        <div class="nav-bar nav-bar-centered">
          <div class="nav-logo">Scriptle</div>
        </div>

        <div class="script-title-section" style="flex: 1;">
          <div class="pack-grid">
            ${data.packs.map(pack => {
              const theme = packThemes[pack.id];
              const cardStyle = theme ? `
                background: linear-gradient(135deg, ${theme.cardGradientStart} 0%, ${theme.cardGradientEnd} 100%);
                border-color: ${theme.cardBorder};
              ` : '';
              const h3Style = theme ? `color: ${theme.cardBorder};` : '';
              const countStyle = theme ? `color: ${theme.cardBorder}; opacity: 0.8;` : '';

              return `
                <a href="/play/${pack.id}" data-link class="pack-card" data-pack-id="${pack.id}" style="${cardStyle}">
                  <h3 style="${h3Style}">${pack.name}</h3>
                  <div class="movie-count" style="${countStyle}">${pack.movieCount} movies</div>
                </a>
              `;
            }).join('')}
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
