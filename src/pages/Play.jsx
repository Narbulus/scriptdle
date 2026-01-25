import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Game } from '../components/game/Game.jsx';
import { Navigation } from '../components/Navigation.js';
import { getCurrentDate } from '../utils/time.js';

// Preact Component that handles data loading
function GameLoader({ packId }) {
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

                const today = getCurrentDate();

                // 1. Fetch Pack & Manifest
                const [packRes, manifestRes] = await Promise.all([
                    fetch(`/data/packs/${packId}.json`),
                    fetch(`/data/daily/${packId}/manifest.json`)
                ]);

                if (!packRes.ok) throw new Error(`Pack "${packId}" not found`);
                if (!manifestRes.ok) throw new Error(`Pack "${packId}" has no daily puzzles`);

                const [packData, manifest] = await Promise.all([
                    packRes.json(),
                    manifestRes.json()
                ]);

                // Apply theme immediately
                applyTheme(packData.theme);

                // Update Title
                document.title = `Scriptle - A daily ${packData.name} movie quote game`;

                // 2. Fetch Puzzle & Index (for other packs)
                const [puzzleRes, indexRes] = await Promise.all([
                    fetch(`/data/daily/${packId}/${today}.json`),
                    fetch('/data/packs-full.json')
                ]);

                if (!puzzleRes.ok) throw new Error('Daily puzzle not available');

                const [dailyPuzzle, indexData] = await Promise.all([
                    puzzleRes.json(),
                    indexRes.ok ? indexRes.json() : { packs: [] }
                ]);

                setData({
                    dailyPuzzle,
                    manifest,
                    allPacks: indexData.packs,
                    packData
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
            {/* Title rendering could be here or inside Game */}
            <div className="script-title-section">
                <div className="script-title">{data.packData.name}</div>
                <div className="script-subtitle">{data.packData.movies?.length || 0} Movies</div>
            </div>

            <Game
                dailyPuzzle={data.dailyPuzzle}
                manifest={data.manifest}
                allPacks={data.allPacks}
                packData={data.packData}
            />
        </div>
    );
}

// Helper to apply theme variables (migrated from logic in Play.js)
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

// ----------------------------------------------------------------------
// Bridge Function (called by router.js)
// ----------------------------------------------------------------------
export function renderPlay(params) {
    const { packId, navContainer, contentContainer } = params;

    // 1. Render Navigation (Legacy)
    navContainer.innerHTML = '';
    // Navigation returns a DOM node
    navContainer.appendChild(Navigation({ showBackButton: true }));

    // 2. Mount Preact App
    // Clear container
    contentContainer.innerHTML = '';

    // Render
    render(<GameLoader packId={packId} />, contentContainer);
}
