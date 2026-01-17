import { Navigation } from '../components/Navigation.js';
import {
  getCompletionsByDate,
  getStreak,
  getAllCompletions
} from '../utils/completionTracker.js';
import { generateFlower } from '../utils/flowerGenerator.js';

export function renderCollection({ navContainer, contentContainer }) {
  // Render nav bar in persistent container using Navigation component
  navContainer.innerHTML = '';
  const nav = Navigation({ showBackButton: true });
  navContainer.appendChild(nav);

  // Render content in swappable container
  const content = document.createElement('div');
  content.className = 'collection-container';

  // Streak counter (above calendar)
  const streakSection = createStreakSection();
  content.appendChild(streakSection);

  // Calendar section
  const calendarSection = createCalendarSection();
  content.appendChild(calendarSection);

  // Results list
  const resultsSection = createResultsSection();
  content.appendChild(resultsSection);

  contentContainer.innerHTML = '';
  contentContainer.appendChild(content);
}

function createCalendarSection() {
  const section = document.createElement('div');
  section.className = 'calendar-section';

  const calendar = document.createElement('div');
  calendar.className = 'calendar-grid';

  // Get completions by date
  const completionsByDate = getCompletionsByDate();

  // Calculate the last 28 days (4 weeks)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    const dateStr = date.toISOString().split('T')[0];
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
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
