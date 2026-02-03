import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('./storage.js', () => ({
  saveGameState: vi.fn(),
  getGameState: vi.fn(),
}));

vi.mock('../utils/analytics.js', () => ({
  track: vi.fn(),
  setGlobalContext: vi.fn(),
  clearGlobalContext: vi.fn(),
}));

import {
  currentPackId,
  currentPuzzleDate,
  currentAttempt,
  isGameOver,
  isWin,
  movieLocked,
  characterLocked,
  guessStats,
  attemptsRemaining,
  initGame,
  submitGuess,
} from './game-state.js';
import { getGameState } from './storage.js';
import { track } from '../utils/analytics.js';

function resetSignals() {
  currentPackId.value = null;
  currentPuzzleDate.value = null;
  currentAttempt.value = 0;
  isGameOver.value = false;
  isWin.value = false;
  movieLocked.value = false;
  characterLocked.value = false;
  guessStats.value = [];
}

describe('game-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSignals();
  });

  describe('initGame', () => {
    test('initializes fresh game when no saved state', () => {
      getGameState.mockReturnValue(null);

      initGame('starwars', '2024-06-15');

      expect(currentPackId.value).toBe('starwars');
      expect(currentPuzzleDate.value).toBe('2024-06-15');
      expect(currentAttempt.value).toBe(0);
      expect(isGameOver.value).toBe(false);
      expect(track).toHaveBeenCalledWith('game_start', {
        puzzle_date: '2024-06-15',
      });
    });

    test('restores saved state', () => {
      getGameState.mockReturnValue({
        attempts: 2,
        gameOver: false,
        movieLocked: true,
        characterLocked: false,
        guessStats: [{ movie: true, char: false }, { movie: true, char: false }],
      });

      initGame('marvel', '2024-06-15');

      expect(currentAttempt.value).toBe(2);
      expect(movieLocked.value).toBe(true);
      expect(characterLocked.value).toBe(false);
      expect(guessStats.value).toHaveLength(2);
      expect(track).toHaveBeenCalledWith('game_resume', expect.objectContaining({
        existing_attempts: 2,
      }));
    });

    test('tracks game_revisit for completed games', () => {
      getGameState.mockReturnValue({
        attempts: 3,
        gameOver: true,
        success: true,
      });

      initGame('pixar', '2024-06-15');

      expect(track).toHaveBeenCalledWith('game_revisit', {
        puzzle_date: '2024-06-15',
        result: 'win',
      });
    });
  });

  describe('attemptsRemaining', () => {
    test('computes remaining attempts', () => {
      currentAttempt.value = 2;
      expect(attemptsRemaining.value).toBe(3);
    });
  });

  describe('submitGuess', () => {
    beforeEach(() => {
      getGameState.mockReturnValue(null);
      initGame('starwars', '2024-06-15');
      vi.clearAllMocks();
    });

    test('locks movie on correct movie guess', () => {
      submitGuess(true, false);

      expect(movieLocked.value).toBe(true);
      expect(characterLocked.value).toBe(false);
      expect(currentAttempt.value).toBe(1);
      expect(isGameOver.value).toBe(false);
    });

    test('locks character on correct character guess', () => {
      submitGuess(false, true);

      expect(movieLocked.value).toBe(false);
      expect(characterLocked.value).toBe(true);
    });

    test('wins game on both correct', () => {
      submitGuess(true, true);

      expect(isWin.value).toBe(true);
      expect(isGameOver.value).toBe(true);
      expect(track).toHaveBeenCalledWith('game_complete', expect.objectContaining({
        result: 'win',
      }));
    });

    test('loses game after max attempts', () => {
      submitGuess(false, false);
      submitGuess(false, false);
      submitGuess(false, false);
      submitGuess(false, false);
      submitGuess(false, false);

      expect(currentAttempt.value).toBe(5);
      expect(isGameOver.value).toBe(true);
      expect(isWin.value).toBe(false);
      expect(track).toHaveBeenCalledWith('game_complete', expect.objectContaining({
        result: 'loss',
      }));
    });

    test('tracks each guess', () => {
      submitGuess(true, false);

      expect(track).toHaveBeenCalledWith('guess_made', {
        movie_correct: true,
        char_correct: false,
        attempt: 1,
      });
    });

    test('accumulates guess stats', () => {
      submitGuess(false, false);
      submitGuess(true, false);
      submitGuess(true, true);

      expect(guessStats.value).toEqual([
        { movie: false, char: false },
        { movie: true, char: false },
        { movie: true, char: true },
      ]);
    });

    test('does nothing when game is over', () => {
      isGameOver.value = true;
      const attemptsBefore = currentAttempt.value;

      submitGuess(true, true);

      expect(currentAttempt.value).toBe(attemptsBefore);
    });
  });
});
