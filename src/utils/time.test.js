import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDateToLocal, parseLocalDate, getTimeUntilMidnight, getCurrentDate } from './time.js';

describe('time utilities', () => {
  describe('formatDateToLocal', () => {
    test('formats date correctly with padding', () => {
      const date = new Date(2024, 0, 5);
      expect(formatDateToLocal(date)).toBe('2024-01-05');
    });

    test('formats double-digit month and day', () => {
      const date = new Date(2024, 11, 25);
      expect(formatDateToLocal(date)).toBe('2024-12-25');
    });

    test('handles year boundary', () => {
      const date = new Date(2023, 11, 31);
      expect(formatDateToLocal(date)).toBe('2023-12-31');
    });
  });

  describe('parseLocalDate', () => {
    test('parses date string correctly', () => {
      const result = parseLocalDate('2024-01-05');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(5);
    });

    test('parses double-digit month and day', () => {
      const result = parseLocalDate('2024-12-25');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(25);
    });

    test('roundtrips with formatDateToLocal', () => {
      const original = new Date(2024, 5, 15);
      const formatted = formatDateToLocal(original);
      const parsed = parseLocalDate(formatted);
      expect(parsed.getFullYear()).toBe(original.getFullYear());
      expect(parsed.getMonth()).toBe(original.getMonth());
      expect(parsed.getDate()).toBe(original.getDate());
    });
  });

  describe('getCurrentDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('returns current date formatted', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 0));
      expect(getCurrentDate()).toBe('2024-06-15');
    });
  });

  describe('getTimeUntilMidnight', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('calculates time until midnight', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 22, 30, 0));
      const result = getTimeUntilMidnight();
      expect(result.hours).toBe(1);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBe(0);
      expect(result.total).toBeGreaterThan(0);
    });

    test('returns zero at midnight', () => {
      vi.setSystemTime(new Date(2024, 5, 16, 0, 0, 0));
      const result = getTimeUntilMidnight();
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });

    test('handles early morning', () => {
      vi.setSystemTime(new Date(2024, 5, 15, 1, 0, 0));
      const result = getTimeUntilMidnight();
      expect(result.hours).toBe(23);
      expect(result.minutes).toBe(0);
    });
  });
});
