import { router } from '../router.js';
import { generateFlower, stringToSeed } from '../utils/flowerGenerator.js';
import { Navigation } from '../components/Navigation.js';

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

  // Helper to check completion status
  const getCompletionStatus = (packId) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `scriptle:${packId}:${today}`;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      const data = JSON.parse(stored);
      if (data.gameOver) {
        return { attempts: data.attempts, success: data.success };
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  try {
    const response = await fetch('/data/index.json');
    const data = await response.json();

    // Create a map of packs by id for easy lookup
    const packsById = {};
    data.packs.forEach(pack => {
      packsById[pack.id] = pack;
    });

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

    // Helper to render a pack card
    const renderPackCard = (packId) => {
      const pack = packsById[packId];
      if (!pack) return '';

      const theme = packThemes[pack.id];
      const cardStyle = theme ? `
        background: linear-gradient(135deg, ${theme.cardGradientStart} 0%, ${theme.cardGradientEnd} 100%);
        border-color: ${theme.cardBorder};
      ` : '';
      const h3Style = theme ? `color: ${theme.cardText || theme.cardBorder};` : '';
      const countStyle = theme ? `color: ${theme.cardText || theme.cardBorder}; opacity: 0.8;` : '';

      // Check if pack is completed today
      const completion = getCompletionStatus(pack.id);
      const today = new Date().toISOString().split('T')[0];
      const badgeSeed = stringToSeed(pack.id + today);
      const cardColor = theme ? theme.cardGradientStart : '#cccccc';

      let badge = '';
      if (completion) {
        if (completion.success) {
          // Success: show flower
          const flowerSvg = generateFlower(badgeSeed, cardColor);
          badge = `<div class="completion-badge" style="background-image: url('${flowerSvg}');"></div>`;
        } else {
          // Failure: show random emoji sticker
          const failEmojis = ['💀', '🙊', '🤡', '🤨', '🫣'];
          const emojiIndex = badgeSeed % failEmojis.length;
          const emoji = failEmojis[emojiIndex];
          const rotation = (badgeSeed % 30) - 15; // Random rotation between -15 and +15 degrees
          badge = `<div class="completion-badge emoji-badge" style="transform: rotate(${rotation}deg);">${emoji}</div>`;
        }
      }

      return `
        <a href="/play/${pack.id}" data-link class="pack-card" data-pack-id="${pack.id}" style="${cardStyle}">
          ${badge}
          <h3 style="${h3Style}">${pack.name}</h3>
          <div class="movie-count" style="${countStyle}">${pack.movieCount} movies</div>
        </a>
      `;
    };

    // Render categories
    const renderCategories = () => {
      if (!data.categories || data.categories.length === 0) {
        // Fallback to flat list if no categories
        return `
          <div class="pack-grid">
            ${data.packs.map(pack => renderPackCard(pack.id)).join('')}
          </div>
        `;
      }

      return data.categories.map(category => `
        <div class="category-section">
          <h2 class="category-heading">${category.name}</h2>
          <div class="pack-grid">
            ${category.packs.map(packId => renderPackCard(packId)).join('')}
          </div>
        </div>
      `).join('');
    };

    const container = document.createElement('div');
    container.className = 'container';

    // Add navigation
    const nav = Navigation({ showBackButton: false });
    container.appendChild(nav);

    // Add content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'script-title-section';
    contentDiv.style.flex = '1';
    contentDiv.innerHTML = renderCategories();
    container.appendChild(contentDiv);

    app.innerHTML = '';
    app.appendChild(container);
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
