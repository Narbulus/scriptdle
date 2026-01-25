import { useState, useEffect } from 'preact/hooks';
import { computed } from "@preact/signals";
import {
    currentAttempt,
    maxAttempts,
    movieLocked,
    gameMessage,
    submitGuess,
    showMessage
} from '../../services/game-state.js';

export function Controls({ metadata, puzzle, pack, onOpenMovies }) {
    // Local form state
    const [selectedMovie, setSelectedMovie] = useState('');
    const [selectedChar, setSelectedChar] = useState('');

    // Validation errors
    const [movieError, setMovieError] = useState('');
    const [charError, setCharError] = useState('');

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
        setSelectedChar(''); // Reset char when movie changes
        setMovieError('');
    };

    const handleCharChange = (e) => {
        setSelectedChar(e.target.value);
        setCharError('');
    };

    const handleSubmit = () => {
        let isValid = true;

        if (!selectedMovie) {
            setMovieError('Please select a movie');
            isValid = false;
        }
        if (!selectedChar) {
            setCharError('Please select a character');
            isValid = false;
        }

        if (!isValid) return;

        // Check Logic
        const target = puzzle.targetLine;
        const guessMovieTitle = getMovieTitle(selectedMovie);

        // Check against Title OR ID
        const isMovieCorrect = guessMovieTitle === target.movie || selectedMovie === target.movie;
        const isCharCorrect = selectedChar.toUpperCase() === target.character.toUpperCase();

        // UI Feedback logic
        if (isMovieCorrect && !isCharCorrect) {
            showMessage('Movie is correct! Character is wrong.', 'error');
        } else if (!isMovieCorrect) {
            showMessage('Incorrect. New clue revealed!', 'error');
        }

        // Submit to game state
        submitGuess(isMovieCorrect, isCharCorrect);

        // If movie wasn't correct, reset selection?
        if (!isMovieCorrect && !movieLocked.value) {
            setSelectedMovie('');
            setSelectedChar('');
        }
    };

    // Derived state for Character Options
    const charOptions = selectedMovie ? (metadata.charactersByMovie[selectedMovie] || []) : [];

    return (
        <div className="game-footer" data-testid="game-footer">
            <div id="game-controls" data-testid="game-controls">

                {/* Pack Header */}
                <div className="pack-header-row" data-testid="pack-header">
                    {pack.name.toUpperCase()} (
                    <a
                        id="movies-subtitle-link"
                        className="pack-header-movies-link"
                        data-testid="movies-link"
                        href="#"
                        onClick={(e) => { e.preventDefault(); onOpenMovies(); }}
                    >
                        {metadata.movies.length} MOVIES
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

                    <div className="select-wrapper">
                        <select
                            id="char-select"
                            data-testid="char-select"
                            value={selectedChar}
                            onChange={handleCharChange}
                            disabled={!selectedMovie}
                        >
                            <option value="">Character</option>
                            {charOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Errors */}
                <div id="movie-error" className="form-error" data-testid="movie-error" style={{ display: movieError ? 'block' : 'none' }}>
                    {movieError}
                </div>
                <div id="char-error" className="form-error" data-testid="char-error" style={{ display: charError ? 'block' : 'none' }}>
                    {charError}
                </div>

                {/* Actions */}
                <div className="footer-actions">
                    <button
                        id="guess-btn"
                        data-testid="guess-button"
                        onClick={handleSubmit}
                    >
                        Make Your Guess
                    </button>

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

            <div id="other-packs-container"></div>
        </div>
    );
}
