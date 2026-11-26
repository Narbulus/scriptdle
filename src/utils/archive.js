import { formatDateToLocal, parseLocalDate } from './time.js';
import { getGameState } from '../services/storage.js';

export const EARLIEST_PUZZLE_DATE = '2026-01-12';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shift a YYYY-MM-DD local date string by deltaDays (negative for past days).
 */
export function shiftDate(dateStr, deltaDays) {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + deltaDays);
    return formatDateToLocal(d);
}

/**
 * Validate that dateStr is a real YYYY-MM-DD calendar date within
 * [EARLIEST_PUZZLE_DATE, todayStr]. Never allows future dates.
 */
export function isValidArchiveDate(dateStr, todayStr) {
    if (!dateStr || !DATE_RE.test(dateStr)) return false;
    const parsed = parseLocalDate(dateStr);
    if (formatDateToLocal(parsed) !== dateStr) return false;
    return dateStr >= EARLIEST_PUZZLE_DATE && dateStr <= todayStr;
}

/**
 * Walk backwards from (fromDate - 1 day) to find the most recent unplayed
 * past puzzle date for a specific pack. Returns null if all dates in the
 * lookback window (or back to EARLIEST_PUZZLE_DATE) are already completed.
 */
export function findPreviousUnplayedDate(packId, fromDate, todayStr, maxLookback = 60) {
    if (!packId || !fromDate) return null;
    const startDate = fromDate > todayStr ? todayStr : fromDate;

    for (let offset = 1; offset <= maxLookback; offset++) {
        const candidate = shiftDate(startDate, -offset);
        if (candidate < EARLIEST_PUZZLE_DATE) return null;
        if (candidate >= todayStr) continue;
        const saved = getGameState(packId, candidate);
        if (!saved?.gameOver) {
            return candidate;
        }
    }
    return null;
}

/**
 * Human-friendly label for an archive date relative to todayStr.
 */
export function formatArchiveDateLabel(dateStr, todayStr) {
    if (!dateStr) return '';
    if (dateStr === todayStr) return 'Today';
    if (dateStr === shiftDate(todayStr, -1)) return 'Yesterday';

    const date = parseLocalDate(dateStr);
    const today = parseLocalDate(todayStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const base = `${months[date.getMonth()]} ${date.getDate()}`;
    return date.getFullYear() === today.getFullYear() ? base : `${base}, ${date.getFullYear()}`;
}
