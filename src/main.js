import { router } from './router.jsx';
import { onDateChange } from './utils/time.js';
import { applyStoredSettings } from './services/settings.js';
import './styles/variables.css';
import './styles/global.css';
import './styles/themes.css';
import './styles/foxing.css';
import './components/game/game.css';
import './components/common/script-select.css'; // after game.css (beats bare `button`)
import './components/game/paper.css';           // after game.css
import './components/game/completion.css';
import './components/game/completion-type.css'; // after completion.css
import './components/menu.css';
import './pages/home.css';
import './pages/stats.css';
import './pages/collection.css';                // after stats.css
import './pages/legal.css';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  applyStoredSettings();

  // Reload page at midnight to fetch new daily puzzle
  onDateChange(() => {
    window.location.reload();
  });

  router.init();
});
