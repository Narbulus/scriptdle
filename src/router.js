import { renderHome } from './pages/Home.js';
import { renderPlay } from './pages/Play.js';
import { track } from './utils/analytics.js';
import { renderCollection } from './pages/Collection.js';

const routes = {
  '/': renderHome,
  '/collection': renderCollection,
  '/play/:packId': renderPlay,
  '/movie/:movieId': (params) => renderPlay({ ...params, singleMovie: true }),
};

function matchRoute(path) {
  // Exact match
  if (routes[path]) {
    return { handler: routes[path], params: {} };
  }

  // Pattern matching for dynamic routes
  for (const [pattern, handler] of Object.entries(routes)) {
    const paramNames = [];
    const regexPattern = pattern.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (match) {
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      return { handler, params };
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
  const path = window.location.pathname || '/';
  const matched = matchRoute(path);

  if (matched) {
    track('page_view', { page_path: path });

    const navContainer = document.getElementById('nav-bar-container');
    const contentContainer = document.getElementById('content-area');

    matched.handler({
      ...matched.params,
      navContainer,
      contentContainer
    });
  } else {
    // 404 - redirect to home
    navigate('/', true);
  }
}

function init() {
  const app = document.getElementById('app');

  // Create persistent shell structure
  app.innerHTML = `
    <div class="container">
      <div id="nav-bar-container"></div>
      <div id="content-area"></div>
    </div>
  `;

  // Handle browser back/forward
  window.addEventListener('popstate', handleRoute);

  // Handle link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]');
    if (link) {
      e.preventDefault();
      navigate(link.getAttribute('href'));
    }
  });

  // Initial route
  handleRoute();
}

export const router = {
  init,
  navigate,
};
