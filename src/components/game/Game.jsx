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
                />

                {/* Other Packs Section */}
                <div id="other-packs-container" style={{ marginTop: '2rem', padding: '1rem' }}>
                    {/* Placeholder for other packs - can be implemented as a component later */}
                    <h3 style={{ textAlign: 'center', opacity: 0.7, marginBottom: '1rem' }}>MORE PACKS</h3>
                    <div className="pack-list-container">
                        {otherPacks.map(p => (
                            <a
                                key={p.id}
                                href={`/play/${p.id}`}
                                className="pack-row"
                                data-link
                                data-theme="pack"
                                style={{
                                    '--pack-card-gradient-start': p.theme?.cardGradientStart || '#333',
                                    '--pack-card-gradient-end': p.theme?.cardGradientEnd || '#555',
                                    '--pack-card-border': p.theme?.cardBorder || '#777',
                                    '--pack-card-text': p.theme?.cardText || '#fff',
                                }}
                            >
                                <div className="pack-row-content">
                                    <span className="pack-row-name">{p.name}</span>
                                    <span className="pack-row-count">{p.movieCount} movies</span>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
