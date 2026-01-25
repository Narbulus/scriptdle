import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { PackList } from '../components/home/PackList.jsx';
import { Navigation } from '../components/Navigation.js';
import { getCurrentDate } from '../utils/time.js';

function HomeLoader() {
    const [data, setData] = useState(null);
    const [history, setHistory] = useState({ today: {}, recent: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                // Fetch packs
                const response = await fetch('/data/packs-full.json');
                if (!response.ok) throw new Error('Failed to load packs');
                const packsData = await response.json();

                // Process LocalStorage
                const today = getCurrentDate();
                const todayStats = {};
                const recentMap = {}; // packId -> latestDate

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('scriptle:')) {
                        // key: scriptle:packId:YYYY-MM-DD
                        const parts = key.split(':');
                        if (parts.length === 3) {
                            const packId = parts[1];
                            const date = parts[2];

                            // Parse data
                            try {
                                const val = JSON.parse(localStorage.getItem(key));
                                if (val.gameOver) {
                                    // Check for today
                                    if (date === today) {
                                        todayStats[packId] = {
                                            completed: true,
                                            success: val.success,
                                            date: date
                                        };
                                    }

                                    // Update recent
                                    if (!recentMap[packId] || date > recentMap[packId]) {
                                        recentMap[packId] = date;
                                    }
                                }
                            } catch (e) {
                                // ignore
                            }
                        }
                    }
                }

                // Filter and Sort Recent
                const validPackIds = new Set(packsData.packs.map(p => p.id));
                const recentList = Object.entries(recentMap)
                    .filter(([id]) => validPackIds.has(id))
                    .sort((a, b) => b[1].localeCompare(a[1]))
                    .slice(0, 4)
                    .map(([id]) => id);

                // Extract themes map
                const packThemes = {};
                packsData.packs.forEach(p => {
                    if (p.theme) packThemes[p.id] = p.theme;
                });

                setData({
                    packs: packsData.packs,
                    categories: packsData.categories,
                    packThemes
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

    // Prepare Recent Packs Objects
    // We need to pass [packObject]s to PackList
    const recentPackObjects = history.recent
        .map(id => data.packs.find(p => p.id === id))
        .filter(Boolean);

    return (
        <div className="script-title-section" style={{ flex: 1 }}>
            {/* Recently Played */}
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

            {/* Categories / All Packs */}
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

// ----------------------------------------------------------------------
// Bridge
// ----------------------------------------------------------------------
export function renderHome({ navContainer, contentContainer }) {
    // 1. Title
    document.title = 'Scriptle - A daily movie quote game';

    // 2. Navigation
    navContainer.innerHTML = '';
    navContainer.appendChild(Navigation({ showBackButton: false, showHelpButton: true }));

    // 3. Mount Preact
    contentContainer.innerHTML = '';
    render(<HomeLoader />, contentContainer);
}
