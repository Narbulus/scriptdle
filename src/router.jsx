import { render } from 'preact';
import { Home } from './pages/Home.jsx';
import { Play } from './pages/Play.jsx';
import { Stats, StatsModalContainer } from './pages/Stats.jsx';
import { Legal } from './pages/Legal.jsx';
import { About } from './pages/About.jsx';
import { Navigation } from './components/Navigation.jsx';
import { Menu } from './components/Menu.jsx';
import { HelpModal, openHelpModal } from './components/Help.jsx';
import { track } from './utils/analytics.js';
import { isFirstVisit, markAsVisited } from './services/storage.js';

const routes = {
  '/': Home,
  '/stats': Stats,
  '/play/:packId': Play,
  '/legal': Legal,
  '/about': About,
};

function matchRoute(path) {
  if (routes[path]) {
    return { component: routes[path], params: {} };
  }

  for (const [pattern, component] of Object.entries(routes)) {
    const paramNames = [];
    const regexPattern = pattern.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    const match = path.match(new RegExp(`^${regexPattern}$`));
    if (match) {
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      return { component, params };
    }
  }

  return null;
}

function navigate(path, replace = false) {
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  handleRoute();
}

function handleRoute() {
  let path = window.location.pathname || '/';

  // Normalize: remove trailing slash (except for root)
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  const matched = matchRoute(path);

  if (!matched) {
    navigate('/', true);
    return;
  }

  track('page_view', { page_path: path });
  document.body.setAttribute('data-theme', path === '/' ? 'main' : 'pack');

  const PageComponent = matched.component;
  const contentContainer = document.getElementById('content-area');

  render(null, contentContainer);
  render(<PageComponent {...matched.params} />, contentContainer);
}

function init() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="container">
      <div id="nav-bar-container"></div>
      <div id="content-area"></div>
      <div id="menu-container"></div>
      <div id="help-modal-container"></div>
      <div id="stats-modal-container"></div>
    </div>
  `;

  render(<Navigation />, document.getElementById('nav-bar-container'));
  render(<Menu />, document.getElementById('menu-container'));
  render(<HelpModal />, document.getElementById('help-modal-container'));
  render(<StatsModalContainer />, document.getElementById('stats-modal-container'));

  if (isFirstVisit()) {
    openHelpModal();
    markAsVisited();
  }

  window.addEventListener('popstate', handleRoute);

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]');
    if (link) {
      e.preventDefault();
      navigate(link.getAttribute('href'));
    }
  });

  handleRoute();
}

export const router = {
  init,
  navigate,
};
