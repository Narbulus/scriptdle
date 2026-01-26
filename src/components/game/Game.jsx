import { useState, useEffect } from 'preact/hooks';
import { isGameOver, initGame, currentPackId } from '../../services/game-state.js';
import { ScriptDisplay } from './ScriptDisplay.jsx';
import { Controls } from './Controls.jsx';
import { Completion } from './Completion.jsx';
import { MoviesModal } from './MoviesModal.jsx';

export function Game({ dailyPuzzle, manifest, allPacks, packData }) {
    const puzzle = dailyPuzzle.puzzle;
    const metadata = dailyPuzzle.metadata;
    const [moviesModalOpen, setMoviesModalOpen] = useState(false);

    // Pack object normalization
    const pack = {
        id: dailyPuzzle.packId,
        name: manifest.packName,
        theme: manifest.theme,
        tierMessages: manifest.tierMessages
    };

    // Initialize Game State on Mount
    useEffect(() => {
        initGame(dailyPuzzle.packId, dailyPuzzle.date);
    }, [dailyPuzzle.packId, dailyPuzzle.date]);

    // Handle "Other Packs" (simple version for now)
    const otherPacks = allPacks.filter(p => p.id !== pack.id).slice(0, 4);

    return (
        <div className="game-container">
            {/* Script Area */}
            <ScriptDisplay puzzle={puzzle} />

            {/* Footer Area */}
            <div className="game-footer" data-testid="game-footer">

                {/* Toggle between Controls and Completion */}
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
