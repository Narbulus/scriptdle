import { useState, useEffect, useRef } from 'preact/hooks';
import {
    currentAttempt,
    maxAttempts,
    movieLocked,
    characterLocked,
    guessStats,
    revealGeneration,
    gameMessage,
    submitGuess,
    showMessage
} from '../../services/game-state.js';
import { track } from '../../utils/analytics.js';
import { getMediaLabels } from '../../utils/mediaLabels.js';
import { getCurrentDate } from '../../utils/time.js';
import { formatArchiveDateLabel } from '../../utils/archive.js';
import { playTick, playLock, playMiss, playWin } from '../../utils/sound.js';
import { TutorialTip } from '../common/Tooltip.jsx';
import { ScriptSelect } from '../common/ScriptSelect.jsx';

export function Controls({ metadata, puzzle, pack, puzzleDate, onOpenMovies, onMovieSelect, onCharSelect, onGuessSubmit, onDiceClick, tutorialProps }) {
    const target = puzzle.targetLine;
    const seasonEpisodes = target.seasonId ? (metadata.episodesByMovie?.[target.seasonId] || null) : null;
    const isEpisodeMode = Boolean(seasonEpisodes && seasonEpisodes.length > 0);
    const labels = getMediaLabels(isEpisodeMode ? 'episodes' : pack?.mediaType);
    const today = getCurrentDate();
    const isArchive = Boolean(puzzleDate && puzzleDate !== today);
    // Local form state
    const [selectedMovie, setSelectedMovie] = useState('');
    const [selectedChar, setSelectedChar] = useState('');
    const [_isSpinning, setIsSpinning] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const animationFrameRef = useRef(null);
    const shakeTimerRef = useRef(null);

    useEffect(() => () => {
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }, []);

    // Measure marquee overflow on mount — set CSS variable + enable animation only if needed.
    // The container persists across selections now (it is the trigger's value span,
    // not a keyed overlay), so clear any previous state before measuring.
    const marqueeRef = (el) => {
        if (!el) return;
        const container = el.parentElement;
        container.classList.remove('marquee-animate');
        const overflow = el.offsetWidth - container.clientWidth;

        if (overflow <= 0) return;

        el.style.setProperty('--marquee-shift', `-${overflow}px`);
        container.classList.add('marquee-animate');
    };

    // Stop shuffle animation and reset dice to resting position
    const stopShuffle = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setIsSpinning(false);

        // Reset dice rotation to resting position
        const diceButton = document.getElementById('randomize-btn');
        if (diceButton) {
            const svg = diceButton.querySelector('svg');
            if (svg) {
                svg.style.transform = 'rotate(0deg)';
            }
        }
    };

    // Trigger crisp horizontal recoil animation
    const triggerShake = () => {
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        setIsShaking(false);
        requestAnimationFrame(() => {
            setIsShaking(true);
            shakeTimerRef.current = setTimeout(() => {
                setIsShaking(false);
                shakeTimerRef.current = null;
            }, 340);
        });
    };

    // Sync locked movie/episode state
    useEffect(() => {
        if (movieLocked.value) {
            const correctId = isEpisodeMode
                ? target.episodeId
                : getMovieId(target.movie);
            setSelectedMovie(correctId);
            if (!isEpisodeMode && !characterLocked.value) {
                setSelectedChar('');
            }
        }
    }, [movieLocked.value]);

    // Sync locked character state
    useEffect(() => {
        if (characterLocked.value) {
            const correctChar = target.character;
            setSelectedChar(correctChar);
        }
    }, [characterLocked.value]);

    // Helper to map Title -> ID
    const getMovieId = (title) => {
        if (isEpisodeMode) {
            const ep = seasonEpisodes.find(e => e.title === title || e.id === title);
            return ep ? ep.id : title;
        }
        if (!metadata.movies || !metadata.movieTitles) return title;
        const id = metadata.movies.find(m =>
            metadata.movieTitles[m] === title || m === title
        );
        return id || title;
    };

    // Helper to get Title from ID
    const getMovieTitle = (id) => {
        if (isEpisodeMode) {
            const ep = seasonEpisodes.find(e => e.id === id);
            return ep ? ep.title : id;
        }
        return metadata.movieTitles?.[id] || id;
    };

    const matchesTargetEntry = (selectedId) => {
        if (!selectedId) return false;
        if (isEpisodeMode && target.episodeId && selectedId === target.episodeId) {
            return true;
        }
        const guessTitle = getMovieTitle(selectedId);
        return guessTitle === target.movie || selectedId === target.movie;
    };

    // ScriptSelect passes the value, not an event. stopShuffle moved to onOpen,
    // which also fires on keyboard-open — onFocus missed that case.
    const handleMovieChange = (value) => {
        setSelectedMovie(value);
        if (!isEpisodeMode && !characterLocked.value) {
            setSelectedChar('');
        }
        if (value) {
            playTick();
            if (onMovieSelect) onMovieSelect();
        }
    };

    const handleCharChange = (value) => {
        setSelectedChar(value);
        if (value) {
            playTick();
            if (onCharSelect) onCharSelect();
        }
    };

    const handleRandomize = () => {
        playTick();
        if (onDiceClick) onDiceClick();
        setIsSpinning(true);

        // Calculate spin duration and rotation
        const totalDuration = 1000; // 1 second
        const rotations = 3; // Number of full rotations
        const totalDegrees = rotations * 360;

        // Shuffle available options for randomness (once at start)
        const poolIds = isEpisodeMode ? seasonEpisodes.map(e => e.id) : metadata.movies;
        const availableMovies = movieLocked.value ? [] : [...poolIds].sort(() => Math.random() - 0.5);

        // Pre-shuffle character lists for each movie/episode
        const shuffledCharsByMovie = {};
        if (isEpisodeMode) {
            const seasonChars = [...(metadata.charactersByMovie[target.seasonId] || [])].sort(() => Math.random() - 0.5);
            poolIds.forEach(epId => {
                shuffledCharsByMovie[epId] = seasonChars;
            });
        } else if (movieLocked.value && selectedMovie) {
            // If movie is locked, only shuffle characters for that movie
            shuffledCharsByMovie[selectedMovie] = [...(metadata.charactersByMovie[selectedMovie] || [])].sort(() => Math.random() - 0.5);
        } else {
            // Otherwise shuffle characters for all movies
            availableMovies.forEach(movieId => {
                shuffledCharsByMovie[movieId] = [...(metadata.charactersByMovie[movieId] || [])].sort(() => Math.random() - 0.5);
            });
        }

        let startTime = null;
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
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Animation complete - don't reset rotation since 1080deg looks the same as 0deg
                // Resetting would trigger the CSS transition and cause a quick spin
                animationFrameRef.current = null;
                setIsSpinning(false);
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleSubmit = () => {
        stopShuffle();

        // Check Logic
        const target = puzzle.targetLine;
        const wasMovieLocked = movieLocked.value;
        const wasCharLocked = characterLocked.value;

        if (!selectedMovie && !selectedChar) {
            showMessage('Skipped turn.', 'error');
            triggerShake();
            playMiss();
            submitGuess(false, false);
            if (onGuessSubmit) onGuessSubmit(false);
            return;
        }

        // If only one selected, check if it's correct and possibly lock it
        if (!selectedMovie || !selectedChar) {
            let isMovieCorrect = false;
            let isCharCorrect = false;

            if (selectedMovie) {
                isMovieCorrect = matchesTargetEntry(selectedMovie);
            }

            if (selectedChar) {
                isCharCorrect = selectedChar.toUpperCase() === target.character.toUpperCase();
            }

            const newlyLocked = (isMovieCorrect && !wasMovieLocked) || (isCharCorrect && !wasCharLocked);

            // Show appropriate message
            if (isMovieCorrect && !selectedChar) {
                showMessage(labels.correctMsg, 'success');
                if (newlyLocked) playLock();
                else {
                    triggerShake();
                    playMiss();
                }
            } else if (isCharCorrect && !selectedMovie) {
                showMessage('Character is correct!', 'success');
                if (newlyLocked) playLock();
                else {
                    triggerShake();
                    playMiss();
                }
            } else {
                showMessage('Incomplete guess.', 'error');
                triggerShake();
                playMiss();
            }

            submitGuess(isMovieCorrect, isCharCorrect);
            if (onGuessSubmit) onGuessSubmit(isMovieCorrect && isCharCorrect);

            if (!isMovieCorrect && !movieLocked.value) setSelectedMovie('');
            if (!isCharCorrect && !characterLocked.value) setSelectedChar('');
            return;
        }

        // Both selected - normal guess logic
        const isMovieCorrect = matchesTargetEntry(selectedMovie);
        const isCharCorrect = selectedChar.toUpperCase() === target.character.toUpperCase();
        const newlyLocked = (isMovieCorrect && !wasMovieLocked) || (isCharCorrect && !wasCharLocked);

        // UI Feedback & Audio logic
        if (isMovieCorrect && isCharCorrect) {
            playWin();
        } else if (isMovieCorrect && !isCharCorrect) {
            showMessage(labels.correctMsg, 'success');
            if (newlyLocked) {
                playLock();
            } else {
                triggerShake();
                playMiss();
            }
        } else if (!isMovieCorrect && isCharCorrect) {
            showMessage('Character is correct!', 'success');
            if (newlyLocked) {
                playLock();
            } else {
                triggerShake();
                playMiss();
            }
        } else {
            showMessage('Incorrect.', 'error');
            triggerShake();
            playMiss();
        }

        submitGuess(isMovieCorrect, isCharCorrect);
        if (onGuessSubmit) onGuessSubmit(isMovieCorrect && isCharCorrect);

        if (!isMovieCorrect && !movieLocked.value) {
            setSelectedMovie('');
        }
        if (!isCharCorrect && !characterLocked.value) {
            setSelectedChar('');
        }
    };

    // Derived state for Character Options
    // In episode mode the enclosing season is already known, so the full season
    // speaking cast is immediately available regardless of which episode is selected.
    const charOptions = (() => {
        if (isEpisodeMode) {
            return metadata.charactersByMovie[target.seasonId] || [];
        }
        if (characterLocked.value && !selectedMovie) {
            // Show only the locked character when no movie selected
            return [target.character];
        }
        return selectedMovie ? (metadata.charactersByMovie[selectedMovie] || []) : [];
    })();

    const movieOptions = isEpisodeMode
        ? seasonEpisodes.map(ep => ({
            value: ep.id,
            badge: `E${String(ep.number).padStart(2, '0')}`,
            label: ep.title,
            description: ep.summary || '',
        }))
        : metadata.movies.map(m => ({ value: m, label: getMovieTitle(m) }));
    const charSelectOptions = charOptions.map(c => ({ value: c, label: c }));
    const selectorCount = isEpisodeMode
        ? `${seasonEpisodes.length} IN ${(target.season || 'SEASON').toUpperCase()}`
        : `${metadata.movies.length} IN PACK`;

    return (
        <div id="game-controls" data-testid="game-controls">

            {/* Pack Header */}
            <div className="pack-header-row" data-testid="pack-header">
                {pack.name.toUpperCase()}
                {isEpisodeMode && target.season ? ` · ${target.season.toUpperCase()}` : ''} (
                <a
                    id="movies-subtitle-link"
                    className="pack-header-movies-link"
                    data-testid="movies-link"
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        track('view_movie_list');
                        onOpenMovies();
                    }}
                >
                    {labels.viewLink}
                </a>
                )
                {isArchive && (
                    <>
                        {' · '}
                        <span data-testid="archive-date-badge">
                            {formatArchiveDateLabel(puzzleDate, today).toUpperCase()}
                        </span>
                        {' · '}
                        <a
                            href={`/play/${pack.id}`}
                            data-link
                            className="pack-header-movies-link"
                            data-testid="back-to-today-link"
                        >
                            TODAY
                        </a>
                    </>
                )}
            </div>

            {/* Selectors */}
            <div className="footer-selectors">
                <div className="selector-with-tip">
                    {tutorialProps && tutorialProps.tutorialStep === tutorialProps.TUTORIAL_STEPS.MOVIE_SELECT && (
                        <TutorialTip show={true} onClose={tutorialProps.onDismissTip}>
                            {labels.tutorialTip}
                        </TutorialTip>
                    )}
                    <ScriptSelect
                        id="movie-select"
                        label={labels.selectPrompt}
                        value={selectedMovie}
                        options={movieOptions}
                        onChange={handleMovieChange}
                        locked={movieLocked.value}
                        allowLockAnimation={revealGeneration.value > 0}
                        count={selectorCount}
                        align="left"
                        onOpen={stopShuffle}
                        valueRef={marqueeRef}
                    />
                </div>

                <div className="selector-with-tip">
                    {tutorialProps && tutorialProps.tutorialStep === tutorialProps.TUTORIAL_STEPS.CHAR_SELECT && (
                        <TutorialTip show={true} onClose={tutorialProps.onDismissTip}>
                            Now pick the character that said the line.
                        </TutorialTip>
                    )}
                    <ScriptSelect
                        id="char-select"
                        label="Who Said It?"
                        value={selectedChar}
                        options={charSelectOptions}
                        onChange={handleCharChange}
                        disabled={!isEpisodeMode && !selectedMovie}
                        locked={characterLocked.value}
                        allowLockAnimation={revealGeneration.value > 0}
                        count={`${charSelectOptions.length} SPEAKING`}
                        align="right"
                        onOpen={stopShuffle}
                        valueRef={marqueeRef}
                    />
                </div>
            </div>

            {tutorialProps && tutorialProps.tutorialStep === tutorialProps.TUTORIAL_STEPS.GUESS_BUTTON && (
                <TutorialTip show={true} onClose={tutorialProps.onDismissTip}>
                    {labels.guessTip}
                </TutorialTip>
            )}

            {tutorialProps && tutorialProps.tutorialStep === tutorialProps.TUTORIAL_STEPS.NEW_LINE && (
                <TutorialTip show={true} onClose={tutorialProps.onDismissTip} caretPosition="none">
                    More of the scene is revealed after each guess. Click the dice to have Lady Luck choose for you!
                </TutorialTip>
            )}

            {/* Actions */}
            <div className="footer-actions">
                <div className={`button-row${isShaking ? ' shake' : ''}`}>
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
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <circle cx="15.5" cy="15.5" r="1.5" />
                            <circle cx="8.5" cy="15.5" r="1.5" />
                            <circle cx="15.5" cy="8.5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                        </svg>
                    </button>
                </div>

                <div className="footer-meta">
                    <div className="footer-attempts" data-testid="attempts-counter">
                        <span className="attempt-pips" aria-hidden="true">
                            {Array.from({ length: maxAttempts.value }, (_, i) => {
                                const guess = guessStats.value[i];
                                let pipState = 'remaining';
                                if (guess) {
                                    if (guess.movie && guess.char) pipState = 'hit';
                                    else if (guess.movie || guess.char) pipState = 'partial';
                                    else pipState = 'miss';
                                }
                                const isFresh = revealGeneration.value > 0 && i === guessStats.value.length - 1;
                                return (
                                    <span
                                        key={i}
                                        className={`attempt-pip attempt-pip--${pipState}${isFresh ? ' is-fresh' : ''}`}
                                        data-state={pipState}
                                    />
                                );
                            })}
                        </span>
                        <span>
                            <span id="attempt-count">{currentAttempt.value}</span>/{maxAttempts.value} Attempts
                        </span>
                    </div>
                    <a href="/" data-link className="footer-more-movies">{labels.moreLink}</a>
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
