import { useState, useEffect } from 'preact/hooks';
import { Game } from '../components/game/Game.jsx';
import { loadAllGameData, getPackData } from '../services/dataLoader.js';

export function Play({ packId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // Optimistic theme from global cache
    const themeData = window.SCRIPTLE_THEMES?.[packId];

    useEffect(() => {
        async function loadGameData() {
            try {
                setLoading(true);
                setError(null);

                // Load all game data (cached after first load)
                await loadAllGameData();

                // Get this pack's data from cache
                const packData = getPackData(packId);

                if (!packData) {
                    throw new Error(`Pack "${packId}" not found`);
                }

                if (!packData.manifest) {
                    throw new Error(`Pack "${packId}" has no daily puzzles`);
                }

                if (!packData.dailyPuzzle) {
                    throw new Error('Daily puzzle not available');
                }

                // Apply theme immediately
                applyTheme(packData.packData.theme);

                // Update Title and Meta Tags
                const pageTitle = `Scriptle: Daily ${packData.packData.name} quote guessing game`;
                document.title = pageTitle;

                // Update Open Graph meta tags for link previews
                updateMetaTag('og:title', pageTitle);
                updateMetaTag('og:description', `Play daily ${packData.packData.name} quote puzzles on Scriptle. Guess the movie from gradually revealed quotes!`);
                updateMetaTag('og:url', window.location.href);

                // Update Twitter Card meta tags
                updateMetaTag('twitter:title', pageTitle);
                updateMetaTag('twitter:description', `Play daily ${packData.packData.name} quote puzzles on Scriptle. Guess the movie from gradually revealed quotes!`);

                setData({
                    dailyPuzzle: packData.dailyPuzzle,
                    manifest: packData.manifest,
                    packData: packData.packData
                });

            } catch (err) {
                console.error("Game Load Error", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        if (packId) {
            loadGameData();
        }
    }, [packId]);

    if (error) {
        return (
            <div data-testid="game-error" style="text-align: center; padding: 3rem; color: #ff6b6b;">
                <h2>Error Loading Game</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} style="margin-top:1rem; padding:0.5rem 1rem;">Retry</button>
            </div>
        );
    }

    if (loading || !data) {
        // Show Skeleton/Loading State
        return (
            <div id="game-area" data-testid="game-loading">
                {themeData && (
                    <div className="script-title-section">
                        <div className="script-title">{themeData.name}</div>
                        <div className="script-subtitle">{themeData.movieCount} Movies</div>
                    </div>
                )}
                <div id="loading" data-testid="loading-text" style="text-align:center; padding: 3rem; opacity: 0.7;">
                    Loading... {packId ? packId : 'NO_ID'}
                </div>
            </div>
        );
    }

    return (
        <div id="game-area">
            <Game
                dailyPuzzle={data.dailyPuzzle}
                manifest={data.manifest}
                packData={data.packData}
            />
        </div>
    );
}

function applyTheme(t) {
    if (!t) return;
    const root = document.documentElement;

    root.style.setProperty('--pack-primary', t.primary || '#333');
    root.style.setProperty('--pack-bg', t.bgColor || '#f4f4f4');
    root.style.setProperty('--pack-surface', t.containerBg || '#ffffff');
    root.style.setProperty('--pack-accent', t.accentColor || '#555');
    root.style.setProperty('--pack-btn-text', t.btnText || '#ffffff');
    root.style.setProperty('--pack-text', t.primary || '#333');
    root.style.setProperty('--pack-text-secondary', t.accentColor || '#555');
    root.style.setProperty('--pack-text-muted', t.muted || '#999');

    root.style.setProperty('--pack-card-gradient-start', t.cardGradientStart || t.bgColor || '#333');
    root.style.setProperty('--pack-card-gradient-end', t.cardGradientEnd || t.bgColor || '#555');
    root.style.setProperty('--pack-card-border', t.cardBorder || t.primary || '#333');
    root.style.setProperty('--pack-card-text', t.cardText || '#ffffff');
}

function updateMetaTag(property, content) {
    // Try og: property first
    let meta = document.querySelector(`meta[property="${property}"]`);

    // If not found, try name attribute (for twitter:)
    if (!meta) {
        meta = document.querySelector(`meta[name="${property}"]`);
    }

    if (meta) {
        meta.setAttribute('content', content);
    } else {
        // Create new meta tag if it doesn't exist
        meta = document.createElement('meta');
        if (property.startsWith('og:')) {
            meta.setAttribute('property', property);
        } else {
            meta.setAttribute('name', property);
        }
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
    }
}

