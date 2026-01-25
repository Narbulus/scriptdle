/**
 * game-state.js
 * Reactive game state management.
 */

import { signal, computed, batch } from "@preact/signals";
import { saveGameState, getGameState } from "./storage.js";

// Core State
export const currentPackId = signal(null);
export const currentPuzzleDate = signal(null);
export const currentAttempt = signal(0);
export const maxAttempts = signal(5);
export const isGameOver = signal(false);
export const isWin = signal(false);
export const movieLocked = signal(false);
export const guessStats = signal([]); // Array<{movie: boolean, char: boolean}>
export const gameMessage = signal(null); // { text, type: 'error'|'success' }

// Computed
export const attemptsRemaining = computed(() => maxAttempts.value - currentAttempt.value);

/**
 * Initialize game state for a specific pack/puzzle.
 * Loads from storage or resets to default.
 * @param {string} packId
 * @param {string} date
 */
export function initGame(packId, date) {
    batch(() => {
        currentPackId.value = packId;
        currentPuzzleDate.value = date;

        const saved = getGameState(packId, date);
        if (saved) {
            currentAttempt.value = saved.attempts || 0;
            isGameOver.value = !!saved.gameOver;
            isWin.value = !!saved.success;
            movieLocked.value = !!saved.movieLocked;
            guessStats.value = saved.guessStats || [];
        } else {
            // Reset
            currentAttempt.value = 0;
            isGameOver.value = false;
            isWin.value = false;
            movieLocked.value = false;
            guessStats.value = [];
        }
    });
}

/**
 * Show a transient message
 */
export function showMessage(text, type = 'error', duration = 3000) {
    gameMessage.value = { text, type };
    setTimeout(() => {
        // Only clear if it's still the same message (simple check)
        if (gameMessage.value && gameMessage.value.text === text) {
            gameMessage.value = null;
        }
    }, duration);
}

/**
 * Record a guess attempt.
 * @param {boolean} movieCorrect
 * @param {boolean} charCorrect
 */
export function submitGuess(movieCorrect, charCorrect) {
    if (isGameOver.value) return;

    batch(() => {
        const stats = [...guessStats.value, { movie: movieCorrect, char: charCorrect }];
        guessStats.value = stats;

        if (movieCorrect) {
            movieLocked.value = true;
        }

        if (movieCorrect && charCorrect) {
            // Win
            isWin.value = true;
            isGameOver.value = true;
            currentAttempt.value = stats.length; // Ensure attempts matches
        } else {
            currentAttempt.value++;
            if (currentAttempt.value >= maxAttempts.value) {
                // Loss
                isGameOver.value = true;
                isWin.value = false;
            }
        }

        // Persist
        saveGameState(currentPackId.value, {
            attempts: currentAttempt.value,
            gameOver: isGameOver.value,
            success: isWin.value,
            movieLocked: movieLocked.value,
            guessStats: guessStats.value
        }, currentPuzzleDate.value);
    });
}
