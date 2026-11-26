import { describe, it, expect, beforeEach } from 'vitest';
import {
    EARLIEST_PUZZLE_DATE,
    shiftDate,
    isValidArchiveDate,
    findPreviousUnplayedDate,
    formatArchiveDateLabel,
} from './archive.js';
import { saveGameState } from '../services/storage.js';

describe('archive utilities', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shifts dates accurately across month and year boundaries', () => {
        expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
        expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
        expect(shiftDate('2026-11-26', -2)).toBe('2026-11-24');
    });

    it('validates archive dates and rejects future or invalid dates', () => {
        const today = '2026-11-26';
        expect(isValidArchiveDate('2026-11-26', today)).toBe(true);
        expect(isValidArchiveDate('2026-11-25', today)).toBe(true);
        expect(isValidArchiveDate(EARLIEST_PUZZLE_DATE, today)).toBe(true);
        expect(isValidArchiveDate('2026-11-27', today)).toBe(false);
        expect(isValidArchiveDate('2026-01-11', today)).toBe(false);
        expect(isValidArchiveDate('2026-02-30', today)).toBe(false);
        expect(isValidArchiveDate('not-a-date', today)).toBe(false);
    });

    it('finds the most recent unplayed past puzzle for the same pack', () => {
        const today = '2026-11-26';
        // Nothing played yet -> yesterday
        expect(findPreviousUnplayedDate('harry-potter', today, today)).toBe('2026-11-25');

        // Mark yesterday completed for harry-potter -> skips to Nov 24
        saveGameState('harry-potter', { gameOver: true, success: true, attempts: 2 }, '2026-11-25');
        expect(findPreviousUnplayedDate('harry-potter', today, today)).toBe('2026-11-24');

        // Other pack completions do not affect harry-potter
        saveGameState('star-wars', { gameOver: true, success: true, attempts: 1 }, '2026-11-24');
        expect(findPreviousUnplayedDate('harry-potter', today, today)).toBe('2026-11-24');

        // In-progress (not gameOver) is still returned so players can finish it
        saveGameState('harry-potter', { gameOver: false, attempts: 1 }, '2026-11-24');
        expect(findPreviousUnplayedDate('harry-potter', today, today)).toBe('2026-11-24');
    });

    it('stops at EARLIEST_PUZZLE_DATE', () => {
        expect(findPreviousUnplayedDate('harry-potter', EARLIEST_PUZZLE_DATE, '2026-01-20')).toBe(null);
    });

    it('formats human-friendly labels', () => {
        const today = '2026-11-26';
        expect(formatArchiveDateLabel('2026-11-26', today)).toBe('Today');
        expect(formatArchiveDateLabel('2026-11-25', today)).toBe('Yesterday');
        expect(formatArchiveDateLabel('2026-11-20', today)).toBe('Nov 20');
        expect(formatArchiveDateLabel('2025-12-31', today)).toBe('Dec 31, 2025');
    });
});
