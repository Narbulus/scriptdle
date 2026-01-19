import { router } from '../router.js';
import { generateFlower, stringToSeed } from '../utils/flowerGenerator.js';
import { Navigation } from '../components/Navigation.js';
import { getCurrentDate } from '../utils/time.js';

export async function renderHome({ navContainer, contentContainer }) {

  // Set page title for home
  document.title = 'Scriptle - A daily movie quote game';

  // Reset CSS variables to defaults when returning to home
  // (Removed to allow PaletteTester to control global theme)


  // Helper to check completion status
  const getCompletionStatus = (packId, date = null) => {
    // If date provided, use that specific date. Otherwise default to today.
    const checkDate = date || getCurrentDate();
    const key = `scriptle:${packId}:${checkDate}`;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      const data = JSON.parse(stored);
      if (data.gameOver) {
        return { attempts: data.attempts, success: data.success, date: checkDate };
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  // Helper to get random emoji for failure
  const getFailureEmoji = (seed) => {
    const failEmojis = ['💀', '🙊', '🤡', '🤨', '🫣'];
    const emojiIndex = seed % failEmojis.length;
    return failEmojis[emojiIndex];
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

    // Generate badge HTML
    const getBadgeHtml = (packId, specificDate) => {
      const completion = getCompletionStatus(packId, specificDate);

      // If no completion found for specific date (or today), return empty
      if (!completion) return '';

      const dateStr = completion.date; // The date we found completion for
      const badgeSeed = stringToSeed(packId + dateStr);

      const theme = packThemes[packId];
      const cardColor = theme ? theme.cardGradientStart : '#cccccc';

      if (completion.success) {
        // Success: show flower
        const flowerSvg = generateFlower(badgeSeed, cardColor);
        return `<div class="completion-badge" style="background-image: url('${flowerSvg}');"></div>`;
      } else {
        // Failure: show random emoji sticker
        const emoji = getFailureEmoji(badgeSeed);
        const rotation = (badgeSeed % 30) - 15; // Random rotation between -15 and +15 degrees
        return `<div class="completion-badge emoji-badge" style="transform: rotate(${rotation}deg);">${emoji}</div>`;
      }
    };



    // Render a PACK ROW (Compact, for general list)
    const renderPackRow = (packId) => {
      const pack = packsById[packId];
      if (!pack) return '';

      const theme = packThemes[pack.id];

      // Set pack card CSS custom properties
      const themeVars = theme ? `
        --pack-card-gradient-start: ${theme.cardGradientStart};
        --pack-card-gradient-end: ${theme.cardGradientEnd};
        --pack-card-border: ${theme.cardBorder};
        --pack-card-text: ${theme.cardText || theme.primary};
      ` : '';

      // For rows, we check "today" for completion
      const badge = getBadgeHtml(packId, null); // null = defaults to today

      return `
        <a href="/play/${pack.id}"
           data-link
           data-theme="pack"
           class="pack-row"
           data-pack-id="${pack.id}"
           style="${themeVars}">
          <div class="pack-row-content">
            <span class="pack-row-name">${pack.name}</span>
            <span class="pack-row-count">${pack.movieCount} movies</span>
          </div>
          ${badge ? `<div class="pack-row-badge">${badge}</div>` : ''}
        </a>
      `;
    };

    // Render categories using ROWS
    const renderCategories = (excludedPackIds = []) => {
      const excludedSet = new Set(excludedPackIds);

      if (!data.categories || data.categories.length === 0) {
        const packsToShow = data.packs.filter(pack => !excludedSet.has(pack.id));
        if (packsToShow.length === 0) return '';

        return `
          <div class="pack-list-container">
            ${packsToShow.map(pack => renderPackRow(pack.id)).join('')}
          </div>
        `;
      }

      return data.categories.map(category => {
        const packsToShow = category.packs.filter(packId => !excludedSet.has(packId));
        if (packsToShow.length === 0) return '';

        return `
          <div class="category-section">
            <h2 class="category-heading">${category.name}</h2>
            <div class="pack-list-container">
              ${packsToShow.map(packId => renderPackRow(packId)).join('')}
            </div>
          </div>
        `;
      }).join('');
    };

    // Render nav bar in persistent container using Navigation component
    navContainer.innerHTML = '';
    const nav = Navigation({ showBackButton: false, showHelpButton: true });
    navContainer.appendChild(nav);


    // Get recent packs with their dates
    const getRecentPacks = () => {
      try {
        const packDates = {}; // packId -> latestDate string

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('scriptle:')) {
            const parts = key.split(':');
            if (parts.length === 3) {
              const packId = parts[1];
              const date = parts[2];
              // Keep the LATEST date for each pack
              if (!packDates[packId] || date > packDates[packId]) {
                packDates[packId] = date;
              }
            }
          }
        }

        // Sort by date desc
        return Object.entries(packDates)
          .sort((a, b) => b[1].localeCompare(a[1])) // Sort by date descending
          .slice(0, 4) // Top 4
          .map(([id, date]) => ({ id, date }))
          .filter(item => packsById[item.id]); // Validate existence
      } catch (e) {
        console.error("Error reading recent packs", e);
        return [];
      }
    };

    const recentPacks = getRecentPacks();

    // Render content in swappable container
    contentContainer.innerHTML = `
      <div class="script-title-section" style="flex: 1;">
        
        ${recentPacks.length > 0 ? `
          <div class="recent-section">
            <h2 class="category-heading">Recently Played</h2>
            <div class="pack-list-container">
              ${recentPacks.map(item => renderPackRow(item.id)).join('')}
            </div>
          </div>
        ` : ''}
        
        ${renderCategories(recentPacks.map(p => p.id))}
      </div>
    `;
  } catch (e) {
    console.error('Failed to load pack index:', e);
    navContainer.innerHTML = '';
    const nav = Navigation({ showBackButton: false });
    navContainer.appendChild(nav);
    contentContainer.innerHTML = `
      < div style = "text-align: center; color: red; padding: 3rem;" >
        Failed to load game data.Please try again later.
      </div >
      `;
  }
}
