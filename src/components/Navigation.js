import { router } from '../router.js';

export function Navigation({ showBackButton = false }) {
  const nav = document.createElement('div');
  nav.className = 'nav-bar';

  // Left side - back button or empty space
  const leftSide = document.createElement('div');
  leftSide.className = 'nav-left';

  if (showBackButton) {
    const backButton = document.createElement('button');
    backButton.className = 'nav-back-button';
    backButton.innerHTML = '← Back';
    backButton.onclick = (e) => {
      e.preventDefault();
      router.navigate('/');
    };
    leftSide.appendChild(backButton);
  }

  // Center - logo (clickable, navigates to home)
  const center = document.createElement('div');
  center.className = 'nav-center';
  const logo = document.createElement('div');
  logo.className = 'nav-logo';
  logo.textContent = 'Scriptle';
  logo.style.cursor = 'pointer';
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
  resultsLink.textContent = 'RESULTS';
  resultsLink.onclick = (e) => {
    e.preventDefault();
    router.navigate('/collection');
  };

  rightSide.appendChild(resultsLink);

  nav.appendChild(leftSide);
  nav.appendChild(center);
  nav.appendChild(rightSide);

  return nav;
}
