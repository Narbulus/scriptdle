import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTodaysCompletion,
  getCompletionForDate,
  getAllCompletions,
  getStreak,
  getCompletionsByPack,
  getCompletionsByDate,
} from './completionTracker.js';

const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('completionTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15));
    mockLocalStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCompletionForDate', () => {
    test('returns null when no completion exists', () => {
      expect(getCompletionForDate('2024-06-15')).toBeNull();
    });

    test('returns completion data when exists', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 3,
        completedAt: '2024-06-15T12:00:00Z',
      }));

      const result = getCompletionForDate('2024-06-15');
      expect(result).toEqual({
        packId: 'starwars',
        date: '2024-06-15',
        success: true,
        attempts: 3,
        completedAt: '2024-06-15T12:00:00Z',
      });
    });

    test('ignores incomplete games', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-15', JSON.stringify({
        gameOver: false,
        attempts: 2,
      }));

      expect(getCompletionForDate('2024-06-15')).toBeNull();
    });
  });

  describe('getTodaysCompletion', () => {
    test('returns completion for today', () => {
      mockLocalStorage.setItem('scriptle:marvel:2024-06-15', JSON.stringify({
        gameOver: true,
        success: false,
        attempts: 5,
      }));

      const result = getTodaysCompletion();
      expect(result.packId).toBe('marvel');
      expect(result.success).toBe(false);
    });
  });

  describe('getAllCompletions', () => {
    test('returns empty array when no completions', () => {
      expect(getAllCompletions()).toEqual([]);
    });

    test('returns all completions sorted by date descending', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-10', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 2,
      }));
      mockLocalStorage.setItem('scriptle:marvel:2024-06-15', JSON.stringify({
        gameOver: true,
        success: false,
        attempts: 5,
      }));
      mockLocalStorage.setItem('scriptle:pixar:2024-06-12', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 4,
      }));

      const results = getAllCompletions();
      expect(results).toHaveLength(3);
      expect(results[0].date).toBe('2024-06-15');
      expect(results[1].date).toBe('2024-06-12');
      expect(results[2].date).toBe('2024-06-10');
    });
  });

  describe('getStreak', () => {
    test('returns 0 when no completions', () => {
      expect(getStreak()).toBe(0);
    });

    test('returns 1 for single day completion', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 2,
      }));

      expect(getStreak()).toBe(1);
    });

    test('returns consecutive days streak', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 2,
      }));
      mockLocalStorage.setItem('scriptle:marvel:2024-06-14', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 3,
      }));
      mockLocalStorage.setItem('scriptle:pixar:2024-06-13', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 1,
      }));

      expect(getStreak()).toBe(3);
    });

    test('breaks streak on missing day', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 2,
      }));
      mockLocalStorage.setItem('scriptle:marvel:2024-06-13', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 3,
      }));

      expect(getStreak()).toBe(1);
    });
  });

  describe('getCompletionsByPack', () => {
    test('groups completions by pack', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 2,
      }));
      mockLocalStorage.setItem('scriptle:starwars:2024-06-14', JSON.stringify({
        gameOver: true,
        success: false,
        attempts: 5,
      }));
      mockLocalStorage.setItem('scriptle:marvel:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 3,
      }));

      const result = getCompletionsByPack();
      expect(result.starwars.total).toBe(2);
      expect(result.starwars.wins).toBe(1);
      expect(result.starwars.losses).toBe(1);
      expect(result.marvel.total).toBe(1);
      expect(result.marvel.wins).toBe(1);
    });
  });

  describe('getCompletionsByDate', () => {
    test('groups completions by date', () => {
      mockLocalStorage.setItem('scriptle:starwars:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 2,
      }));
      mockLocalStorage.setItem('scriptle:marvel:2024-06-15', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 3,
      }));
      mockLocalStorage.setItem('scriptle:pixar:2024-06-14', JSON.stringify({
        gameOver: true,
        success: true,
        attempts: 4,
      }));

      const result = getCompletionsByDate();
      expect(result['2024-06-15']).toHaveLength(2);
      expect(result['2024-06-14']).toHaveLength(1);
    });
  });
});
