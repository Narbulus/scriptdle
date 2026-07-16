import './stats.css';

const BUCKETS = ['1', '2', '3', '4', '5', 'fail'];
const BUCKET_LABELS = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', 'fail': '\u2717' };

export function StatsSection({ stats, playerBucket }) {
    if (!stats) {
        return (
            <div className="stats-section">
                <div className="stats-header stats-header-shimmer">Loading...</div>
                <div className="stats-chart">
                    {BUCKETS.map((b) => (
                        <div key={b} className="stats-row">
                            <span className="stats-label">{BUCKET_LABELS[b]}</span>
                            <div className="stats-bar-track">
                                <div className="stats-bar stats-bar-placeholder shimmer" style={{ width: '30%' }} />
                            </div>
                            <span className="stats-pct stats-pct-placeholder">0%</span>
                        </div>
                    ))}
                </div>
                <div className="stats-percentile stats-percentile-shimmer">&nbsp;</div>
            </div>
        );
    }

    const { subreddit, playerResult } = stats;
    const { distribution, totalPlayers, name } = subreddit;
    const maxCount = Math.max(1, ...BUCKETS.map(b => parseInt(distribution[b] || '0', 10)));

    return (
        <div className="stats-section">
            <div className="stats-header">
                r/{name} &middot; {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}
            </div>

            <div className="stats-chart">
                {BUCKETS.map((bucket) => {
                    const count = parseInt(distribution[bucket] || '0', 10);
                    const pct = totalPlayers > 0 ? Math.round(count / totalPlayers * 100) : 0;
                    const barWidth = Math.max(2, (count / maxCount) * 100);
                    const isPlayer = bucket === playerBucket;

                    return (
                        <div key={bucket} className={`stats-row ${isPlayer ? 'stats-row-player' : ''}`}>
                            <span className="stats-label">{BUCKET_LABELS[bucket]}</span>
                            <div className="stats-bar-track">
                                <div
                                    className={`stats-bar ${isPlayer ? 'stats-bar-player' : ''}`}
                                    style={{ width: `${barWidth}%` }}
                                />
                            </div>
                            <span className="stats-pct">
                                {pct}%{isPlayer && <span className="stats-you">YOU</span>}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="stats-percentile">
                Better than {playerResult.percentile}% of players
            </div>
        </div>
    );
}
