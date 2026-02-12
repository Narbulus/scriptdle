import { useState, useEffect, useRef } from 'preact/hooks';
import { isGameOver, initGame } from '../../services/game-state.js';
import { ScriptDisplay } from './ScriptDisplay.jsx';
import { Controls } from './Controls.jsx';
import { Completion } from './Completion.jsx';
import { MoviesModal } from './MoviesModal.jsx';
import { DebugMenu } from './DebugMenu.jsx';
import { getTutorialState, saveTutorialState } from '../../services/storage.js';

const TUTORIAL_STEPS = {
    MOVIE_SELECT: 1,
    CHAR_SELECT: 2,
    GUESS_BUTTON: 3,
    NEW_LINE: 4,
    COMPLETE: 5
};

export function Game({ dailyPuzzle, manifest, packData }) {
    const puzzle = dailyPuzzle.puzzle;
    const metadata = dailyPuzzle.metadata;
    const [moviesModalOpen, setMoviesModalOpen] = useState(false);

    // Expose movies modal opener globally for Reddit nav bar
    useEffect(() => {
        window.SCRIPTLE_OPEN_MOVIES = () => setMoviesModalOpen(true);
        return () => { delete window.SCRIPTLE_OPEN_MOVIES; };
    }, []);

    const [tutorialStep, setTutorialStep] = useState(() => {
        const state = getTutorialState();
        return state.completed ? TUTORIAL_STEPS.COMPLETE : state.step;
    });
    const [tipVisible, setTipVisible] = useState(() => {
        const state = getTutorialState();
        return !state.completed;
    });

    // Track if game was already completed on load (skip footer animation)
    const wasAlreadyComplete = useRef(false);
    const hasCheckedInit = useRef(false);

    const pack = {
        id: dailyPuzzle.packId,
        name: manifest.packName,
        theme: manifest.theme,
        tierMessages: manifest.tierMessages
    };

    useEffect(() => {
        initGame(dailyPuzzle.packId, dailyPuzzle.date, pack.name);
        // After initGame, isGameOver reflects saved state
        if (!hasCheckedInit.current) {
            wasAlreadyComplete.current = isGameOver.value;
            hasCheckedInit.current = true;
        }
    }, [dailyPuzzle.packId, dailyPuzzle.date, pack.name]);

    useEffect(() => {
        if (tutorialStep === TUTORIAL_STEPS.COMPLETE) {
            saveTutorialState({ step: tutorialStep, completed: true });
        } else {
            saveTutorialState({ step: tutorialStep, completed: false });
        }
    }, [tutorialStep]);

    // Re-read persisted state before advancing — if another post already
    // progressed further (or completed), jump to that step instead.
    const advanceTutorial = (toStep) => {
        const saved = getTutorialState();
        if (saved.completed) {
            setTutorialStep(TUTORIAL_STEPS.COMPLETE);
            setTipVisible(false);
            return;
        }
        const effective = Math.max(saved.step, tutorialStep);
        if (effective < toStep && toStep <= TUTORIAL_STEPS.NEW_LINE) {
            setTutorialStep(toStep);
            setTipVisible(true);
        } else if (effective >= toStep) {
            // Already past this step — update local state, don't show tip
            setTutorialStep(effective);
            setTipVisible(effective < TUTORIAL_STEPS.COMPLETE);
        }
    };

    const completeTutorial = () => {
        setTutorialStep(TUTORIAL_STEPS.COMPLETE);
        setTipVisible(false);
    };

    const handleMovieSelect = () => {
        if (tutorialStep === TUTORIAL_STEPS.MOVIE_SELECT) {
            advanceTutorial(TUTORIAL_STEPS.CHAR_SELECT);
        } else if (tutorialStep === TUTORIAL_STEPS.NEW_LINE) {
            completeTutorial();
        }
    };

    const handleCharSelect = () => {
        if (tutorialStep === TUTORIAL_STEPS.CHAR_SELECT) {
            advanceTutorial(TUTORIAL_STEPS.GUESS_BUTTON);
        } else if (tutorialStep === TUTORIAL_STEPS.NEW_LINE) {
            completeTutorial();
        }
    };

    const handleGuessSubmit = (isCorrect) => {
        if (tutorialStep === TUTORIAL_STEPS.GUESS_BUTTON) {
            if (isCorrect) {
                completeTutorial();
            } else {
                advanceTutorial(TUTORIAL_STEPS.NEW_LINE);
            }
        } else if (tutorialStep === TUTORIAL_STEPS.NEW_LINE) {
            completeTutorial();
        }
    };

    const handleDiceClick = () => {
        if (tutorialStep === TUTORIAL_STEPS.NEW_LINE) {
            completeTutorial();
        }
    };

    const dismissTip = () => {
        setTipVisible(false);
    };

    const showTutorial = tutorialStep < TUTORIAL_STEPS.COMPLETE && tipVisible && !isGameOver.value;

    const tutorialProps = showTutorial ? {
        tutorialStep,
        onDismissTip: dismissTip,
        TUTORIAL_STEPS
    } : null;

    return (
        <div className="game-container">
            <ScriptDisplay puzzle={puzzle} />

            <div className={`game-footer${isGameOver.value && typeof window !== 'undefined' && window.SCRIPTLE_SHARE_HANDLER ? (wasAlreadyComplete.current ? ' completion-expanded no-animate' : ' completion-expanded') : ''}`} data-testid="game-footer">
                {isGameOver.value ? (
                    <Completion
                        puzzle={puzzle}
                        pack={pack}
                        packTheme={packData.theme}
                    />
                ) : (
                    <Controls
                        metadata={metadata}
                        puzzle={puzzle}
                        pack={pack}
                        onOpenMovies={() => setMoviesModalOpen(true)}
                        onMovieSelect={handleMovieSelect}
                        onCharSelect={handleCharSelect}
                        onDiceClick={handleDiceClick}
                        onGuessSubmit={handleGuessSubmit}
                        tutorialProps={tutorialProps}
                    />
                )}

                <MoviesModal
                    isOpen={moviesModalOpen}
                    onClose={() => setMoviesModalOpen(false)}
                    packName={pack.name}
                    movies={metadata.movies}
                    movieTitles={metadata.movieTitles}
                    movieYears={metadata.movieYears}
                    moviePosters={metadata.moviePosters}
                />
            </div>

            {(import.meta.env.DEV || import.meta.env.VITE_DEBUG_MENU) && <DebugMenu />}
        </div>
    );
}
