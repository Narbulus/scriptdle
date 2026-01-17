// Utility to track and retrieve completions across all packs

const STORAGE_KEY_PREFIX = 'scriptle:';

export function getTodaysCompletion() {
  const today = new Date().toISOString().split('T')[0];
  return getCompletionForDate(today);
}

export function getCompletionForDate(date) {
  // Scan through all localStorage keys to find completions for this date
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      const parts = key.split(':');
      if (parts.length === 3 && parts[2] === date) {
        const data = JSON.parse(localStorage.getItem(key));

        // Only return if game is completed
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
  const completions = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      const parts = key.split(':');
      if (parts.length === 3) {
        const packId = parts[1];
        const date = parts[2];
        const data = JSON.parse(localStorage.getItem(key));

        // Only include completed games
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

  // Sort by date (most recent first)
  completions.sort((a, b) => new Date(b.date) - new Date(a.date));

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

  // Group completions by date
  const dateSet = new Set(completions.map(c => c.date));
  const sortedDates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let checkDate = new Date(today);

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];

    if (dateSet.has(dateStr)) {
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
