import { signal, computed, batch } from "@preact/signals";
import { saveGameState, getGameState } from "./storage.js";
import { track } from "../utils/analytics.js";

// Core State
export const currentPackId = signal(null);
export const currentPuzzleDate = signal(null);
export const currentAttempt = signal(0);
export const maxAttempts = signal(5);
export const isGameOver = signal(false);
export const isWin = signal(false);
export const movieLocked = signal(false);
export const characterLocked = signal(false);
export const guessStats = signal([]); // Array<{movie: boolean, char: boolean}>
export const gameMessage = signal(null);
export const confettiShown = signal(false);

export const attemptsRemaining = computed(() => maxAttempts.value - currentAttempt.value);

export function initGame(packId, date) {
    batch(() => {
        currentPackId.value = packId;
        currentPuzzleDate.value = date;

        track('game_start', { pack_id: packId, puzzle_date: date });

        const saved = getGameState(packId, date);
        if (saved) {
            currentAttempt.value = saved.attempts || 0;
            isGameOver.value = !!saved.gameOver;
            isWin.value = !!saved.success;
            movieLocked.value = !!saved.movieLocked;
            characterLocked.value = !!saved.characterLocked;
            guessStats.value = saved.guessStats || [];
            confettiShown.value = !!saved.confettiShown;
        } else {
            // Reset
            currentAttempt.value = 0;
            isGameOver.value = false;
            isWin.value = false;
            movieLocked.value = false;
            characterLocked.value = false;
            guessStats.value = [];
            confettiShown.value = false;
        }
    });
}

export function showMessage(text, type = 'error', duration = 3000) {
    gameMessage.value = { text, type };
    setTimeout(() => {
        // Only clear if it's still the same message (simple check)
        if (gameMessage.value && gameMessage.value.text === text) {
            gameMessage.value = null;
        }
    }, duration);
}

export function submitGuess(movieCorrect, charCorrect) {
    if (isGameOver.value) return;

    batch(() => {
        const stats = [...guessStats.value, { movie: movieCorrect, char: charCorrect }];
        guessStats.value = stats;

        if (movieCorrect) {
            movieLocked.value = true;
        }

        if (charCorrect) {
            characterLocked.value = true;
        }

        if (movieCorrect && charCorrect) {
            // Win
            isWin.value = true;
            isGameOver.value = true;
            currentAttempt.value = stats.length;
        } else {
            currentAttempt.value++;
            if (currentAttempt.value >= maxAttempts.value) {
                // Loss
                isWin.value = false;
                isGameOver.value = true;
            }
        }

        track('guess_made', {
            pack_id: currentPackId.value,
            movie_correct: movieCorrect,
            char_correct: charCorrect,
            attempt: stats.length
        });

        if (isGameOver.value) {
            track('game_complete', {
                pack_id: currentPackId.value,
                result: isWin.value ? 'win' : 'loss',
                attempts: stats.length
            });
        }

        // Persist
        saveGameState(currentPackId.value, {
            attempts: currentAttempt.value,
            gameOver: isGameOver.value,
            success: isWin.value,
            movieLocked: movieLocked.value,
            characterLocked: characterLocked.value,
            guessStats: guessStats.value,
            confettiShown: confettiShown.value
        }, currentPuzzleDate.value);
    });
}

export function markConfettiShown() {
    confettiShown.value = true;
    saveGameState(currentPackId.value, {
        attempts: currentAttempt.value,
        gameOver: isGameOver.value,
        success: isWin.value,
        movieLocked: movieLocked.value,
        characterLocked: characterLocked.value,
        guessStats: guessStats.value,
        confettiShown: confettiShown.value
    }, currentPuzzleDate.value);
}
