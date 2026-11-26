import { getAllCompletions } from './completionTracker.js';
import { findPreviousUnplayedDate, formatArchiveDateLabel } from './archive.js';
import { getCurrentDate } from './time.js';

/**
 * Pick the single pack a returning player cares most about (based purely on
 * their local play history — no pinning or configuration required).
 *
 * Ranks played packs by total completions descending, breaking ties by most
 * recent completion timestamp so a player who just discovered a new fandom
 * sees it right away on their next visit.
 */
export function getPrimaryReturningPack(packs, todayHistory, todayStr = getCurrentDate()) {
    if (!Array.isArray(packs) || packs.length === 0) return null;

    const completions = getAllCompletions();
    if (completions.length === 0) return null;

    const packById = new Map(packs.map(p => [p.id, p]));
    const statsByPack = new Map();

    for (const c of completions) {
        if (!packById.has(c.packId)) continue;
        const entry = statsByPack.get(c.packId) || { count: 0, latestTs: 0 };
        entry.count += 1;
        const ts = c.completedAt ? Date.parse(c.completedAt) || 0 : Date.parse(c.date) || 0;
        if (ts > entry.latestTs) entry.latestTs = ts;
        statsByPack.set(c.packId, entry);
    }

    if (statsByPack.size === 0) return null;

    const [topPackId, topStats] = Array.from(statsByPack.entries()).sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return b[1].latestTs - a[1].latestTs;
    })[0];

    const pack = packById.get(topPackId);
    const playedToday = Boolean(todayHistory?.[topPackId]?.completed);
    const nextArchiveDate = playedToday
        ? findPreviousUnplayedDate(topPackId, todayStr, todayStr)
        : null;
    const nextArchiveLabel = nextArchiveDate
        ? (formatArchiveDateLabel(nextArchiveDate, todayStr) === 'Yesterday'
            ? "Play Yesterday's"
            : `Play ${formatArchiveDateLabel(nextArchiveDate, todayStr)}`)
        : null;

    return {
        pack,
        completionsCount: topStats.count,
        playedToday,
        nextArchiveDate,
        nextArchiveLabel,
    };
}
