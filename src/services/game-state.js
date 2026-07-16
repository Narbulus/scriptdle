import { signal, computed, batch } from "@preact/signals";
import { saveGameState, getGameState } from "./storage.js";
import { track, setGlobalContext } from "../utils/analytics.js";

// Core State
export const currentPackId = signal(null);
export const currentPackName = signal(null);
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
export const gameReady = signal(false);
export const revealGeneration = signal(0);

export const attemptsRemaining = computed(() => maxAttempts.value - currentAttempt.value);

export function initGame(packId, date, packName = null) {
    gameReady.value = false;
    revealGeneration.value = 0;

    batch(() => {
        currentPackId.value = packId;
        currentPackName.value = packName;
        currentPuzzleDate.value = date;

        // Set global analytics context for this pack
        setGlobalContext({ pack_id: packId });

        const saved = getGameState(packId, date);
        if (saved) {
            // Track based on game state
            if (saved.attempts > 0 && !saved.gameOver) {
                // Returning to in-progress puzzle
                track('game_resume', {
                    puzzle_date: date,
                    existing_attempts: saved.attempts,
                    movie_locked: !!saved.movieLocked,
                    character_locked: !!saved.characterLocked
                });
            } else if (saved.gameOver) {
                // Returning to completed puzzle
                track('game_revisit', {
                    puzzle_date: date,
                    result: saved.success ? 'win' : 'loss'
                });
            } else {
                // Has saved state but no attempts yet (edge case)
                track('game_start', { puzzle_date: date });
            }

            currentAttempt.value = saved.attempts || 0;
            isGameOver.value = !!saved.gameOver;
            isWin.value = !!saved.success;
            movieLocked.value = !!saved.movieLocked;
            characterLocked.value = !!saved.characterLocked;
            guessStats.value = saved.guessStats || [];
            confettiShown.value = !!saved.confettiShown;
            gameMessage.value = null;
        } else {
            // Fresh start - no saved state
            track('game_start', { puzzle_date: date });

            // Reset
            currentAttempt.value = 0;
            isGameOver.value = false;
            isWin.value = false;
            movieLocked.value = false;
            characterLocked.value = false;
            guessStats.value = [];
            confettiShown.value = false;
            gameMessage.value = null;
        }
    });
    gameReady.value = true;
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
        revealGeneration.value++;

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
            movie_correct: movieCorrect,
            char_correct: charCorrect,
            attempt: stats.length
        });

        if (isGameOver.value) {
            track('game_complete', {
                result: isWin.value ? 'win' : 'loss',
                attempts: stats.length
            });
        }

        // Persist
        const stateToSave = {
            attempts: currentAttempt.value,
            gameOver: isGameOver.value,
            success: isWin.value,
            movieLocked: movieLocked.value,
            characterLocked: characterLocked.value,
            guessStats: guessStats.value,
            confettiShown: confettiShown.value
        };

        // Record when the game was actually completed (used for streak calculation)
        if (isGameOver.value) {
            stateToSave.completedAt = new Date().toISOString();
        }

        saveGameState(currentPackId.value, stateToSave, currentPuzzleDate.value);
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
