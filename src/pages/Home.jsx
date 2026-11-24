import { useState, useEffect } from 'preact/hooks';
import { PackList } from '../components/home/PackList.jsx';
import { getCurrentDate } from '../utils/time.js';
import { loadAllGameData, getDataCache } from '../services/dataLoader.js';
import { getStorageBackend } from '../services/storage.js';
import { getStreak } from '../utils/completionTracker.js';

function readTodayHistory() {
    const today = getCurrentDate();
    const todayStats = {};
    const backend = getStorageBackend();

    for (const key of backend.keys()) {
        if (key && key.startsWith('scriptle:')) {
            const parts = key.split(':');
            if (parts.length === 3) {
                const packId = parts[1];
                const date = parts[2];

                try {
                    const val = JSON.parse(backend.getItem(key));
                    if (val?.gameOver && date === today) {
                        todayStats[packId] = {
                            completed: true,
                            success: val.success,
                            date,
                            attempts: val.attempts,
                        };
                    }
                } catch {
                    // Ignore corrupted entries
                }
            }
        }
    }

    return todayStats;
}

function getCachedHomeData() {
    const cache = getDataCache().value;
    if (!cache.loaded) return null;
    return {
        packs: cache.packs,
        categories: cache.categories,
        packThemes: cache.packThemes,
    };
}

function HomeSkeleton() {
    return (
        <main className="home-page" data-testid="home-loading" aria-busy="true" aria-label="Loading movie packs">
            <div className="home-header home-skeleton-header" aria-hidden="true">
                <div className="home-skeleton-bar home-skeleton-eyebrow" />
                <div className="home-skeleton-bar home-skeleton-pill" />
            </div>
            <div className="home-toolbar" aria-hidden="true">
                <div className="home-skeleton-bar home-skeleton-search" />
                <div className="home-skeleton-pills">
                    <div className="home-skeleton-bar home-skeleton-chip" />
                    <div className="home-skeleton-bar home-skeleton-chip" />
                    <div className="home-skeleton-bar home-skeleton-chip" />
                </div>
            </div>
            <div className="category-section" aria-hidden="true">
                <div className="home-skeleton-bar home-skeleton-heading" />
                <div className="pack-list-container">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="pack-row-skeleton">
                            <div className="home-skeleton-bar home-skeleton-title" />
                            <div className="home-skeleton-bar home-skeleton-sub" />
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}

export function Home() {
    const initialCached = getCachedHomeData();
    const [data, setData] = useState(initialCached);
    const [history, setHistory] = useState(() => readTodayHistory());
    const [loading, setLoading] = useState(!initialCached);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        document.title = 'Scriptle - A daily movie quote game';

        async function loadData() {
            try {
                if (!getCachedHomeData()) {
                    setLoading(true);
                }

                const gameData = await loadAllGameData();
                if (cancelled) return;

                setData({
                    packs: gameData.packs,
                    categories: gameData.categories,
                    packThemes: gameData.packThemes,
                });
                setHistory(readTodayHistory());
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadData();
        return () => {
            cancelled = true;
        };
    }, []);

    if (error) {
        return (
            <main className="home-page">
                <div className="home-error-state" role="alert">
                    <h2>Unable to Load Packs</h2>
                    <p>Failed to load game data. Please try again later.</p>
                    <button type="button" className="home-retry-btn" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </main>
        );
    }

    if (loading || !data) {
        return <HomeSkeleton />;
    }

    const totalPacks = data.packs.length;
    const completedToday = data.packs.filter(p => history[p.id]?.completed).length;
    const streak = getStreak();

    return (
        <main className="home-page">
            <header className="home-header">
                <div className="home-header-copy">
                    <h1 className="home-tagline">Daily Movie Quote Puzzles</h1>
                    <div className="home-progress-meta" data-testid="home-progress">
                        <span>{completedToday}/{totalPacks} played today</span>
                        {streak > 0 && (
                            <>
                                <span aria-hidden="true">&middot;</span>
                                <span>{streak} day streak</span>
                            </>
                        )}
                    </div>
                </div>
                <a href="/stats" data-link className="home-collection-link" data-testid="home-collection-link">
                    Collection
                </a>
            </header>

            <PackList
                packs={data.packs}
                categories={data.categories}
                packThemes={data.packThemes}
                history={history}
            />
        </main>
    );
}
