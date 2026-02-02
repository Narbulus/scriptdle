import { useState, useEffect } from 'preact/hooks';
import { isGameOver, initGame } from '../../services/game-state.js';
import { ScriptDisplay } from './ScriptDisplay.jsx';
import { Controls } from './Controls.jsx';
import { Completion } from './Completion.jsx';
import { MoviesModal } from './MoviesModal.jsx';
import { isFirstVisit, markAsVisited, getTutorialState, saveTutorialState } from '../../services/storage.js';

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

    const [tutorialStep, setTutorialStep] = useState(() => {
        const state = getTutorialState();
        if (state.completed) return TUTORIAL_STEPS.COMPLETE;
        if (!isFirstVisit() && state.step === 1) return TUTORIAL_STEPS.COMPLETE;
        return state.step;
    });
    const [tipVisible, setTipVisible] = useState(() => {
        const state = getTutorialState();
        return !state.completed && isFirstVisit();
    });

    const pack = {
        id: dailyPuzzle.packId,
        name: manifest.packName,
        theme: manifest.theme,
        tierMessages: manifest.tierMessages
    };

    useEffect(() => {
        initGame(dailyPuzzle.packId, dailyPuzzle.date, pack.name);
    }, [dailyPuzzle.packId, dailyPuzzle.date, pack.name]);

    useEffect(() => {
        if (tutorialStep === TUTORIAL_STEPS.COMPLETE) {
            saveTutorialState({ step: tutorialStep, completed: true });
            markAsVisited();
        } else if (tutorialStep > 1) {
            saveTutorialState({ step: tutorialStep, completed: false });
        }
    }, [tutorialStep]);

    const advanceTutorial = (toStep) => {
        if (tutorialStep < toStep && toStep <= TUTORIAL_STEPS.NEW_LINE) {
            setTutorialStep(toStep);
            setTipVisible(true);
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

            <div className="game-footer" data-testid="game-footer">
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
        </div>
    );
}
