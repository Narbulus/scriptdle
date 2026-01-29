import { useState, useEffect } from 'preact/hooks';
import {
    currentAttempt,
    movieLocked,
    characterLocked,
    gameMessage,
    submitGuess,
    showMessage
} from '../../services/game-state.js';
import { track } from '../../utils/analytics.js';

export function Controls({ metadata, puzzle, pack, onOpenMovies }) {
    // Local form state
    const [selectedMovie, setSelectedMovie] = useState('');
    const [selectedChar, setSelectedChar] = useState('');
    const [isSpinning, setIsSpinning] = useState(false);

    // Sync locked movie state
    useEffect(() => {
        if (movieLocked.value) {
            // If locked, ensure the correct movie is selected
            const correctMovieId = getMovieId(puzzle.targetLine.movie);
            setSelectedMovie(correctMovieId);
            // Reset char selection if it was wrong? Usually good UX to reset it.
            setSelectedChar('');
        }
    }, [movieLocked.value]);

    // Sync locked character state
    useEffect(() => {
        if (characterLocked.value) {
            // If character locked, ensure the correct character is selected
            const correctChar = puzzle.targetLine.character;
            setSelectedChar(correctChar);
        }
    }, [characterLocked.value]);

    // Helper to map Title -> ID
    const getMovieId = (title) => {
        if (!metadata.movies || !metadata.movieTitles) return title;
        const id = metadata.movies.find(m =>
            metadata.movieTitles[m] === title || m === title
        );
        return id || title;
    };

    // Helper to get Title from ID
    const getMovieTitle = (id) => {
        return metadata.movieTitles?.[id] || id;
    };

    const handleMovieChange = (e) => {
        setSelectedMovie(e.target.value);
        // Don't reset char if it's locked
        if (!characterLocked.value) {
            setSelectedChar('');
        }
    };

    const handleCharChange = (e) => {
        setSelectedChar(e.target.value);
    };

    const handleRandomize = () => {
        // Allow re-triggering during spin - just restart
        setIsSpinning(true);

        // Calculate spin duration and rotation
        const totalDuration = 1000; // 1 second
        const rotations = 3; // Number of full rotations
        const totalDegrees = rotations * 360;

        // Shuffle available options for randomness (once at start)
        const availableMovies = movieLocked.value ? [] : [...metadata.movies].sort(() => Math.random() - 0.5);

        // Pre-shuffle character lists for each movie
        const shuffledCharsByMovie = {};
        availableMovies.forEach(movieId => {
            shuffledCharsByMovie[movieId] = [...(metadata.charactersByMovie[movieId] || [])].sort(() => Math.random() - 0.5);
        });

        let startTime = null;
        let animationFrame = null;
        let currentMovieSelection = selectedMovie;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);

            // Easing function: ease-out quartic for faster decay
            const easeOut = 1 - Math.pow(1 - progress, 4);
            const currentRotation = easeOut * totalDegrees;

            // Update button rotation
            const diceButton = document.getElementById('randomize-btn');
            if (diceButton) {
                const svg = diceButton.querySelector('svg');
                if (svg) {
                    svg.style.transform = `rotate(${currentRotation}deg)`;
                }
            }

            // Change selections based on rotation (every 60 degrees)
            // Lock selections at 85% progress to prevent last-moment changes
            const effectiveProgress = Math.min(progress / 0.85, 1);
            const selectionRotation = effectiveProgress * totalDegrees;
            const selectionIndex = Math.floor(selectionRotation / 60);

            if (availableMovies.length > 0 && !movieLocked.value) {
                const movieIndex = selectionIndex % availableMovies.length;
                currentMovieSelection = availableMovies[movieIndex];
                setSelectedMovie(currentMovieSelection);
            }

            // Get characters for current movie selection
            if (!characterLocked.value && currentMovieSelection) {
                const availableChars = shuffledCharsByMovie[currentMovieSelection] || [];
                if (availableChars.length > 0) {
                    const charIndex = selectionIndex % availableChars.length;
                    setSelectedChar(availableChars[charIndex]);
                }
            }

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                // Animation complete - dice stays at final rotation
                setIsSpinning(false);
            }
        };

        animationFrame = requestAnimationFrame(animate);
    };

    const handleSubmit = () => {
        // Check Logic
        const target = puzzle.targetLine;

        // If nothing selected, skip turn and reveal next clue
        if (!selectedMovie && !selectedChar) {
            showMessage('Skipped turn. New clue revealed!', 'error');
            submitGuess(false, false);
            return;
        }

        // If only one selected, check if it's correct and possibly lock it
        if (!selectedMovie || !selectedChar) {
            let isMovieCorrect = false;
            let isCharCorrect = false;

            if (selectedMovie) {
                const guessMovieTitle = getMovieTitle(selectedMovie);
                isMovieCorrect = guessMovieTitle === target.movie || selectedMovie === target.movie;
            }

            if (selectedChar) {
                isCharCorrect = selectedChar.toUpperCase() === target.character.toUpperCase();
            }

            // Show appropriate message
            if (isMovieCorrect && !selectedChar) {
                showMessage('Movie is correct! Now select the character.', 'error');
            } else if (isCharCorrect && !selectedMovie) {
                showMessage('Character is correct! Now select the movie.', 'error');
            } else {
                showMessage('Incomplete guess. New clue revealed!', 'error');
            }

            // Submit guess (will lock if correct)
            submitGuess(isMovieCorrect, isCharCorrect);

            // Reset incorrect selections
            if (!isMovieCorrect && !movieLocked.value) setSelectedMovie('');
            if (!isCharCorrect && !characterLocked.value) setSelectedChar('');
            return;
        }

        // Both selected - normal guess logic
        const guessMovieTitle = getMovieTitle(selectedMovie);
        const isMovieCorrect = guessMovieTitle === target.movie || selectedMovie === target.movie;
        const isCharCorrect = selectedChar.toUpperCase() === target.character.toUpperCase();

        // UI Feedback logic
        if (isMovieCorrect && !isCharCorrect) {
            showMessage('Movie is correct! Character is wrong.', 'error');
        } else if (!isMovieCorrect && isCharCorrect) {
            showMessage('Character is correct! Movie is wrong.', 'error');
        } else if (!isMovieCorrect) {
            showMessage('Incorrect. New clue revealed!', 'error');
        }

        // Submit to game state
        submitGuess(isMovieCorrect, isCharCorrect);

        // If movie wasn't correct, reset selection?
        if (!isMovieCorrect && !movieLocked.value) {
            setSelectedMovie('');
        }
        // If character wasn't correct, reset selection?
        if (!isCharCorrect && !characterLocked.value) {
            setSelectedChar('');
        }
    };

    // Derived state for Character Options
    // Include locked character even if no movie is selected
    const charOptions = (() => {
        if (characterLocked.value && !selectedMovie) {
            // Show only the locked character when no movie selected
            return [puzzle.targetLine.character];
        }
        return selectedMovie ? (metadata.charactersByMovie[selectedMovie] || []) : [];
    })();

    return (
        <div id="game-controls" data-testid="game-controls">

            {/* Pack Header */}
            <div className="pack-header-row" data-testid="pack-header">
                {pack.name.toUpperCase()} (
                <a
                    id="movies-subtitle-link"
                    className="pack-header-movies-link"
                    data-testid="movies-link"
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        track('view_movie_list', { pack_id: pack.id });
                        onOpenMovies();
                    }}
                >
                    VIEW MOVIES
                </a>
                )
            </div>

            {/* Selectors */}
            <div className="footer-selectors">
                <div className={`select-wrapper ${movieLocked.value ? 'correct' : ''}`}>
                    <select
                        id="movie-select"
                        data-testid="movie-select"
                        value={selectedMovie}
                        onChange={handleMovieChange}
                        disabled={movieLocked.value}
                    >
                        <option value="">Film</option>
                        {metadata.movies.map(m => (
                            <option key={m} value={m}>{getMovieTitle(m)}</option>
                        ))}
                    </select>
                </div>

                <div className={`select-wrapper ${characterLocked.value ? 'correct' : ''}`}>
                    <select
                        id="char-select"
                        data-testid="char-select"
                        value={selectedChar}
                        onChange={handleCharChange}
                        disabled={!selectedMovie || characterLocked.value}
                    >
                        <option value="">Character</option>
                        {charOptions.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Actions */}
            <div className="footer-actions">
                <div className="button-row">
                    <button
                        id="guess-btn"
                        data-testid="guess-button"
                        onClick={handleSubmit}
                    >
                        Make Your Guess
                    </button>
                    <button
                        id="randomize-btn"
                        className="dice-button"
                        onClick={handleRandomize}
                        disabled={movieLocked.value && characterLocked.value}
                        title="Randomize selection"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <circle cx="15.5" cy="15.5" r="1.5"/>
                            <circle cx="8.5" cy="15.5" r="1.5"/>
                            <circle cx="15.5" cy="8.5" r="1.5"/>
                            <circle cx="12" cy="12" r="1.5"/>
                        </svg>
                    </button>
                </div>

                <div className="footer-meta">
                    <div className="footer-attempts" data-testid="attempts-counter">
                        <span id="attempt-count">{currentAttempt.value}</span>/5 Attempts
                    </div>
                    <a href="/" data-link className="footer-more-movies">More Movies</a>
                </div>
            </div>

            {/* Global Game Message Overlay */}
            {gameMessage.value && (
                <div
                    id="message"
                    className={`message-overlay ${gameMessage.value.type}`}
                    data-testid="game-message"
                    style={{ display: 'block' }}
                >
                    {gameMessage.value.text}
                </div>
            )}
        </div>
    );
}
