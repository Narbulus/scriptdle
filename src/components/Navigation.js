import { router } from '../router.js';
import { openStatsModal } from '../pages/Stats.jsx';
import { openHelpModal } from '../components/Help.js';

export function Navigation({ showBackButton = false, showHelpButton = true }) {
  const nav = document.createElement('div');
  nav.className = 'nav-bar';
  nav.setAttribute('data-testid', 'nav-bar');

  // Left side - back button or empty space
  const leftSide = document.createElement('div');
  leftSide.className = 'nav-left';
  leftSide.style.display = 'flex';
  leftSide.style.gap = '1rem';
  leftSide.style.alignItems = 'center';

  // Help button (left side)
  if (showHelpButton) {
    const helpButton = document.createElement('button');
    helpButton.className = 'nav-help-btn';
    helpButton.title = 'How to Play';
    helpButton.setAttribute('data-testid', 'help-button');

    const icon = document.createElement('span');
    icon.className = 'nav-help-icon';
    icon.textContent = '?';

    const label = document.createElement('span');
    label.textContent = 'HELP';

    helpButton.appendChild(icon);
    helpButton.appendChild(label);

    helpButton.onclick = (e) => {
      e.preventDefault();
      openHelpModal();
    };
    leftSide.appendChild(helpButton);
  }

  /* Back button removed */

  // Center - logo (clickable, navigates to home)
  const center = document.createElement('div');
  center.className = 'nav-center';
  const logo = document.createElement('div');
  logo.className = 'nav-logo';
  logo.textContent = 'Scriptle';
  logo.style.cursor = 'pointer';
  logo.setAttribute('data-testid', 'nav-logo');
  logo.onclick = (e) => {
    e.preventDefault();
    router.navigate('/');
  };
  center.appendChild(logo);

  // Right side - results link
  const rightSide = document.createElement('div');
  rightSide.className = 'nav-right';

  const resultsLink = document.createElement('button');
  resultsLink.className = 'nav-results-link';
  resultsLink.textContent = 'STATS';
  resultsLink.setAttribute('data-testid', 'stats-button');
  resultsLink.onclick = (e) => {
    e.preventDefault();
    openStatsModal();
  };

  rightSide.appendChild(resultsLink);

  nav.appendChild(leftSide);
  nav.appendChild(center);
  nav.appendChild(rightSide);

  return nav;
}
