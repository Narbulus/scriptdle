import { useState, useEffect } from 'preact/hooks';
import { Game } from '../components/game/Game.jsx';
import { loadPackPuzzleForDate, getDataCache, getPackData } from '../services/dataLoader.js';
import { applyPackTheme } from '../services/theme.js';
import { getCurrentDate } from '../utils/time.js';
import { isValidArchiveDate } from '../utils/archive.js';

function getCachedPlayState(packId, activeDate, today) {
    if (activeDate !== today) return null;
    const packData = getPackData(packId);
    if (!packData?.manifest || !packData?.dailyPuzzle) return null;
    return {
        dailyPuzzle: packData.dailyPuzzle,
        manifest: packData.manifest,
        packData: packData.packData,
    };
}

function getOptimisticTheme(packId) {
    return (
        getDataCache().value.packThemes[packId] ||
        (typeof window !== 'undefined' && window.SCRIPTLE_THEMES?.[packId]) ||
        null
    );
}

export function Play({ packId, queryDate = null }) {
    const today = getCurrentDate();
    const activeDate = isValidArchiveDate(queryDate, today) ? queryDate : today;
    const initialCached = packId ? getCachedPlayState(packId, activeDate, today) : null;
    const [data, setData] = useState(initialCached);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(!initialCached);

    // Apply pack theme synchronously on render if available so the first frame
    // already carries the pack palette without a color flash.
    const optimisticTheme = data?.packData?.theme || getOptimisticTheme(packId);
    if (optimisticTheme) {
        applyPackTheme(optimisticTheme);
    }

    useEffect(() => {
        let cancelled = false;

        async function loadGameData() {
            try {
                const cached = getCachedPlayState(packId, activeDate, today);
                if (!cached) {
                    setLoading(true);
                }
                setError(null);

                const packData = cached || await loadPackPuzzleForDate(packId, activeDate);
                if (cancelled) return;

                applyPackTheme(packData.packData.theme);

                const pageTitle = `Scriptle: Daily ${packData.packData.name} quote guessing game`;
                document.title = pageTitle;

                updateMetaTag('og:title', pageTitle);
                updateMetaTag('og:description', `Play daily ${packData.packData.name} quote puzzles on Scriptle. Guess the movie from gradually revealed quotes!`);
                updateMetaTag('og:url', window.location.href);

                updateMetaTag('twitter:title', pageTitle);
                updateMetaTag('twitter:description', `Play daily ${packData.packData.name} quote puzzles on Scriptle. Guess the movie from gradually revealed quotes!`);

                setData({
                    dailyPuzzle: packData.dailyPuzzle,
                    manifest: packData.manifest,
                    packData: packData.packData,
                });
            } catch (err) {
                if (cancelled) return;
                console.error('Game Load Error', err);
                setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (packId) {
            loadGameData();
        }

        return () => {
            cancelled = true;
        };
    }, [packId, activeDate]);

    if (error) {
        return (
            <div className="play-error-state" data-testid="game-error">
                <h2>Error Loading Game</h2>
                <p>{error}</p>
                <div className="play-error-actions">
                    <button onClick={() => window.location.reload()}>Retry</button>
                    <a href="/" data-link className="footer-more-movies">Back to Packs</a>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div id="game-area" data-testid="game-loading">
                <div className="game-container">
                    <div className="script-area foxed loading-skeleton" data-theme="script" data-testid="script-skeleton">
                        <div className="script-scroll-wrapper">
                            <div className="script-scroll-inner">
                                <div className="script-content">
                                    <div className="script-skeleton-lines" aria-hidden="true">
                                        <div className="script-skeleton-char" />
                                        <div className="script-skeleton-line script-skeleton-line-lg" />
                                        <div className="script-skeleton-line script-skeleton-line-md" />
                                        <div className="script-skeleton-char script-skeleton-faint" />
                                        <div className="script-skeleton-line script-skeleton-line-sm script-skeleton-faint" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="game-footer loading-skeleton" data-testid="footer-skeleton" aria-hidden="true">
                        <div className="footer-skeleton-inner">
                            <div className="footer-skeleton-bar footer-skeleton-header" />
                            <div className="footer-skeleton-selectors">
                                <div className="footer-skeleton-bar footer-skeleton-select" />
                                <div className="footer-skeleton-bar footer-skeleton-select" />
                            </div>
                            <div className="footer-skeleton-bar footer-skeleton-btn" />
                            <div className="footer-skeleton-bar footer-skeleton-meta" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="game-area">
            <Game
                key={`${packId}:${data.dailyPuzzle.date}`}
                dailyPuzzle={data.dailyPuzzle}
                manifest={data.manifest}
                packData={data.packData}
            />
        </div>
    );
}

function updateMetaTag(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
        meta = document.querySelector(`meta[name="${property}"]`);
    }

    if (meta) {
        meta.setAttribute('content', content);
    } else {
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
