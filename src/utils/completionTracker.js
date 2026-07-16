import { getCurrentDate, parseLocalDate, formatDateToLocal } from './time.js';
import { getStorageBackend } from '../services/storage.js';

const STORAGE_KEY_PREFIX = 'scriptle:';

export function getTodaysCompletion() {
  const today = getCurrentDate();
  return getCompletionForDate(today);
}

export function getCompletionForDate(date) {
  const backend = getStorageBackend();
  for (const key of backend.keys()) {
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      const parts = key.split(':');
      if (parts.length === 3 && parts[2] === date) {
        let data;
        try {
          data = JSON.parse(backend.getItem(key));
        } catch {
          console.warn(`Corrupted storage entry: ${key}`);
          continue;
        }

        if (data && data.gameOver === true) {
          return {
            packId: parts[1],
            date: date,
            success: data.success,
            attempts: data.attempts,
            completedAt: data.completedAt
          };
        }
      }
    }
  }

  return null;
}

export function getAllCompletions() {
  const backend = getStorageBackend();
  const completions = [];

  for (const key of backend.keys()) {
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      const parts = key.split(':');
      if (parts.length === 3) {
        const packId = parts[1];
        const date = parts[2];
        let data;
        try {
          data = JSON.parse(backend.getItem(key));
        } catch {
          console.warn(`Corrupted storage entry: ${key}`);
          continue;
        }

        if (data && data.gameOver === true) {
          completions.push({
            packId,
            date,
            success: data.success,
            attempts: data.attempts,
            completedAt: data.completedAt
          });
        }
      }
    }
  }

  completions.sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
  return completions;
}

export function getCompletionsByDate() {
  const completions = getAllCompletions();
  const byDate = {};

  completions.forEach(completion => {
    if (!byDate[completion.date]) {
      byDate[completion.date] = [];
    }
    byDate[completion.date].push(completion);
  });

  return byDate;
}

export function getStreak() {
  const completions = getAllCompletions();
  if (completions.length === 0) {
    return 0;
  }

  // Use the date the player actually completed the puzzle (completedAt),
  // not the puzzle date. This prevents past games from inflating streaks.
  // Fall back to puzzle date for legacy data without completedAt.
  const playedDates = new Set(completions.map(c => {
    if (c.completedAt) {
      // Parse ISO string into local date to match getCurrentDate() timezone
      return formatDateToLocal(new Date(c.completedAt));
    }
    return c.date;
  }));
  const sortedDates = Array.from(playedDates).sort((a, b) => parseLocalDate(b) - parseLocalDate(a));

  let streak = 0;
  const today = getCurrentDate();
  let checkDate = parseLocalDate(today);

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');

    if (playedDates.has(dateStr)) {
      streak++;
      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (i === 0 && dateStr !== sortedDates[0]) {
      // First check failed and it's not today, streak is broken
      break;
    } else {
      // Streak is broken
      break;
    }
  }

  return streak;
}

export function getCompletionsByPack() {
  const completions = getAllCompletions();
  const byPack = {};

  completions.forEach(completion => {
    if (!byPack[completion.packId]) {
      byPack[completion.packId] = {
        total: 0,
        wins: 0,
        losses: 0,
        completions: []
      };
    }

    byPack[completion.packId].total++;
    if (completion.success) {
      byPack[completion.packId].wins++;
    } else {
      byPack[completion.packId].losses++;
    }
    byPack[completion.packId].completions.push(completion);
  });

  return byPack;
}
