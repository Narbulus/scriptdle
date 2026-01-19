import {
  getCompletionsByDate,
  getStreak,
  getAllCompletions
} from '../utils/completionTracker.js';
import { generateFlower } from '../utils/flowerGenerator.js';
import { getCurrentDate, formatDateToLocal, parseLocalDate } from '../utils/time.js';

// Global modal instance check
let modalCreated = false;

export function openCollectionModal() {
  if (!modalCreated) {
    createCollectionModal();
    modalCreated = true;
  }

  const modal = document.getElementById('collection-modal');
  if (modal) {
    // Refresh content every time it opens to show latest data
    refreshModalContent();
    modal.style.display = 'flex';
  }
}

function createCollectionModal() {
  const modal = document.createElement('div');
  modal.id = 'collection-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';

  modal.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">History</h2>
        <button id="collection-modal-close" class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-content">
        <div id="collection-body" class="modal-body custom-scrollbar"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind events
  const closeBtn = document.getElementById('collection-modal-close');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Escape key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
    }
  });
}

function refreshModalContent() {
  const body = document.getElementById('collection-body');
  if (!body) return;

  body.innerHTML = '';

  const content = document.createElement('div');
  content.className = 'collection-container';
  content.style.padding = '0'; // Remove padding inside modal

  // Streak
  content.appendChild(createStreakSection());

  // Calendar
  content.appendChild(createCalendarSection());

  // Results
  content.appendChild(createResultsSection());

  body.appendChild(content);
}

// Keep renderCollection for route compatibility (redirects to home + open modal ideally, 
// but for now let's just make it show the modal and render a blank background or home)
export function renderCollection({ navContainer, contentContainer }) {
  // If navigated to directly, redirect to home and open modal
  window.history.replaceState(null, '', '/');
  // We need to reload or manually trigger home render, but simpler:
  window.location.href = '/';
  // Ideally we'd open the modal after reload, but persistence is tricky without params.
  // For now, let's assumes users use the button.
}

function createCalendarSection() {
  const section = document.createElement('div');
  section.className = 'calendar-section';

  const calendar = document.createElement('div');
  calendar.className = 'calendar-grid';

  // Get completions by date
  const completionsByDate = getCompletionsByDate();

  // Calculate the last 28 days (4 weeks)
  const today = parseLocalDate(getCurrentDate());

  const days = [];
  for (let i = 27; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(date);
  }

  // Add empty cells before the first day to align with week grid
  const firstDayOfWeek = days[0].getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    calendar.appendChild(emptyCell);
  }

  // Create calendar cells
  days.forEach(date => {
    const dateStr = formatDateToLocal(date);
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    dayCell.title = dateStr;

    const completions = completionsByDate[dateStr];

    if (completions && completions.length > 0) {
      // Show the first successful completion's flower
      const firstSuccess = completions.find(c => c.success);

      if (firstSuccess) {
        const flowerDiv = document.createElement('div');
        flowerDiv.className = 'calendar-flower';
        const flowerSvg = generateFlower(firstSuccess.packId + dateStr, '#fff9c4');
        flowerDiv.style.backgroundImage = `url("${flowerSvg}")`;
        dayCell.appendChild(flowerDiv);
        dayCell.classList.add('has-completion');
      } else {
        dayCell.classList.add('has-attempt');
      }
    }

    calendar.appendChild(dayCell);
  });

  section.appendChild(calendar);

  return section;
}

function createStreakSection() {
  const section = document.createElement('div');
  section.className = 'streak-section';

  const streak = getStreak();

  const streakText = document.createElement('div');
  streakText.className = 'streak-text';
  streakText.textContent = `${streak} day streak`;

  section.appendChild(streakText);

  return section;
}

function createResultsSection() {
  const section = document.createElement('div');
  section.className = 'results-section';

  const heading = document.createElement('h2');
  heading.className = 'section-heading';
  heading.textContent = 'results';
  section.appendChild(heading);

  const completions = getAllCompletions();

  if (completions.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No completions yet. Play a pack to get started!';
    section.appendChild(emptyState);
    return section;
  }

  const resultsList = document.createElement('ul');
  resultsList.className = 'results-list';

  // Show all completions with flower bullets
  completions.forEach(completion => {
    const item = document.createElement('li');
    item.className = 'result-item';

    if (completion.success) {
      // Create flower bullet
      const flowerBullet = document.createElement('span');
      flowerBullet.className = 'flower-bullet';
      const flowerSvg = generateFlower(completion.packId + completion.date, '#fff9c4');
      flowerBullet.style.backgroundImage = `url("${flowerSvg}")`;
      item.appendChild(flowerBullet);
    }

    const text = document.createElement('span');
    text.className = 'result-text';
    const packName = formatPackName(completion.packId);
    const dateFormatted = formatDate(completion.date);
    const result = completion.success ? `Win (${completion.attempts})` : `Loss (${completion.attempts})`;
    text.textContent = `${packName} - ${dateFormatted} - ${result}`;
    item.appendChild(text);

    resultsList.appendChild(item);
  });

  section.appendChild(resultsList);

  return section;
}

function formatPackName(packId) {
  return packId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(dateStr) {
  const date = parseLocalDate(dateStr);
  const today = parseLocalDate(getCurrentDate());

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) {
    return 'Today';
  } else if (date.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
}
