import { useState, useEffect } from 'preact/hooks';
import { PackList } from '../components/home/PackList.jsx';
import { getCurrentDate } from '../utils/time.js';
import { loadAllGameData } from '../services/dataLoader.js';
import { getStorageBackend } from '../services/storage.js';

export function Home() {
    const [data, setData] = useState(null);
    const [history, setHistory] = useState({});
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

                const backend = getStorageBackend();
                for (const key of backend.keys()) {
                    if (key && key.startsWith('scriptle:')) {
                        const parts = key.split(':');
                        if (parts.length === 3) {
                            const packId = parts[1];
                            const date = parts[2];

                            try {
                                const val = JSON.parse(backend.getItem(key));
                                if (val.gameOver && date === today) {
                                    todayStats[packId] = {
                                        completed: true,
                                        success: val.success,
                                        date: date,
                                        attempts: val.attempts
                                    };
                                }
                            } catch {
                                // Ignore corrupted entries
                            }
                        }
                    }
                }

                setData({
                    packs: gameData.packs,
                    categories: gameData.categories,
                    packThemes: gameData.packThemes
                });
                setHistory(todayStats);

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
        // Match the real content structure
        return (
            <div className="script-title-section" style={{ flex: 1 }}>
                <div className="category-section">
                    <h2 className="category-heading" style={{ textAlign: 'center' }}>
                        Loading...
                    </h2>
                </div>
            </div>
        );
    }

    return (
        <div className="script-title-section" style={{ flex: 1 }}>
            <PackList
                packs={data.packs}
                categories={data.categories}
                packThemes={data.packThemes}
                history={history}
            />
        </div>
    );
}

