import { router } from './router.js';
import { onDateChange } from './utils/time.js';
import './styles/variables.css';
import './styles/global.css';
import './styles/themes.css';
import './components/game/game.css';
import './components/game/completion.css';
import './pages/home.css';
import './pages/stats.css';
import './pages/legal.css';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Reload page at midnight to fetch new daily puzzle
  onDateChange(() => {
    window.location.reload();
  });

  router.init();

  // Initialize temporary palette tester
  import('./components/PaletteTester.js').then(module => {
    module.initPaletteTester();
  });
});
