import { useState, useEffect } from 'preact/hooks';
import { PackList } from '../components/home/PackList.jsx';
import { getCurrentDate } from '../utils/time.js';
import { loadAllGameData } from '../services/dataLoader.js';

export function Home() {
    const [data, setData] = useState(null);
    const [history, setHistory] = useState({ today: {}, recent: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        document.title = 'Scriptle - A daily movie quote game';
        async function loadData() {
            try {
                setLoading(true);

                // Load all game data (cached after first load)
                const gameData = await loadAllGameData();

                const today = getCurrentDate();
                const todayStats = {};
                const recentMap = {};

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('scriptle:')) {
                        const parts = key.split(':');
                        if (parts.length === 3) {
                            const packId = parts[1];
                            const date = parts[2];

                            try {
                                const val = JSON.parse(localStorage.getItem(key));
                                if (val.gameOver) {
                                    if (date === today) {
                                        todayStats[packId] = {
                                            completed: true,
                                            success: val.success,
                                            date: date
                                        };
                                    }
                                    if (!recentMap[packId] || date > recentMap[packId]) {
                                        recentMap[packId] = date;
                                    }
                                }
                            } catch {
                                // Ignore corrupted entries
                            }
                        }
                    }
                }

                const validPackIds = new Set(gameData.packs.map(p => p.id));
                const recentList = Object.entries(recentMap)
                    .filter(([id]) => validPackIds.has(id))
                    .sort((a, b) => b[1].localeCompare(a[1]))
                    .slice(0, 4)
                    .map(([id]) => id);

                setData({
                    packs: gameData.packs,
                    categories: gameData.categories,
                    packThemes: gameData.packThemes
                });
                setHistory({
                    today: todayStats,
                    recent: recentList
                });

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    if (error) {
        return (
            <div style={{ textAlign: 'center', color: 'red', padding: '3rem' }}>
                Failed to load game data. Please try again later.
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div style={{ padding: '2rem' }}>Loading...</div>
        );
    }

    const recentPackObjects = history.recent
        .map(id => data.packs.find(p => p.id === id))
        .filter(Boolean);

    return (
        <div className="script-title-section" style={{ flex: 1 }}>
            {recentPackObjects.length > 0 && (
                <div className="recent-section">
                    <h2 className="category-heading">Recently Played</h2>
                    <PackList
                        packs={recentPackObjects}
                        categories={null}
                        packThemes={data.packThemes}
                        history={history.today}
                    />
                </div>
            )}

            <PackList
                packs={data.packs}
                categories={data.categories}
                packThemes={data.packThemes}
                history={history.today}
                excludedIds={history.recent}
            />
        </div>
    );
}

