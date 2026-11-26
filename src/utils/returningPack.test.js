import { describe, it, expect, beforeEach } from 'vitest';
import { getPrimaryReturningPack } from './returningPack.js';
import { saveGameState } from '../services/storage.js';

const PACKS = [
    { id: 'harry-potter', name: 'Harry Potter', movieCount: 8 },
    { id: 'the-office', name: 'The Office', movieCount: 9, mediaType: 'seasons' },
    { id: 'star-wars', name: 'Star Wars', movieCount: 9 },
];

describe('getPrimaryReturningPack', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns null for first-time players with no completions', () => {
        expect(getPrimaryReturningPack(PACKS, {}, '2026-11-26')).toBe(null);
    });

    it('picks the most-played pack and prompts today when unplayed', () => {
        saveGameState('harry-potter', { gameOver: true, success: true, attempts: 2, completedAt: '2026-11-24T10:00:00Z' }, '2026-11-24');
        saveGameState('harry-potter', { gameOver: true, success: true, attempts: 1, completedAt: '2026-11-25T10:00:00Z' }, '2026-11-25');
        saveGameState('star-wars', { gameOver: true, success: true, attempts: 3, completedAt: '2026-11-25T15:00:00Z' }, '2026-11-25');

        const result = getPrimaryReturningPack(PACKS, {}, '2026-11-26');
        expect(result.pack.id).toBe('harry-potter');
        expect(result.completionsCount).toBe(2);
        expect(result.playedToday).toBe(false);
        expect(result.nextArchiveDate).toBe(null);
    });

    it('breaks ties by most recently played pack', () => {
        saveGameState('harry-potter', { gameOver: true, success: true, attempts: 2, completedAt: '2026-11-24T10:00:00Z' }, '2026-11-24');
        saveGameState('the-office', { gameOver: true, success: true, attempts: 1, completedAt: '2026-11-25T14:00:00Z' }, '2026-11-25');

        const result = getPrimaryReturningPack(PACKS, {}, '2026-11-26');
        expect(result.pack.id).toBe('the-office');
    });

    it('offers the next unplayed archive date when today is already done', () => {
        saveGameState('harry-potter', { gameOver: true, success: true, attempts: 2, completedAt: '2026-11-26T09:00:00Z' }, '2026-11-26');

        const result = getPrimaryReturningPack(PACKS, { 'harry-potter': { completed: true } }, '2026-11-26');
        expect(result.pack.id).toBe('harry-potter');
        expect(result.playedToday).toBe(true);
        expect(result.nextArchiveDate).toBe('2026-11-25');
        expect(result.nextArchiveLabel).toBe("Play Yesterday's");
    });
});
