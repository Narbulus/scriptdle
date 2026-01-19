import { router } from './router.js';
import { onDateChange } from './utils/time.js';
import './styles/main.css';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Reload page at midnight to fetch new daily puzzle
  onDateChange(() => {
    window.location.reload();
  });

  router.init();
});
