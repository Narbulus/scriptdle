import { router } from '../router.jsx';
import { openStatsModal } from '../pages/Stats.jsx';
import { openHelpModal } from '../components/Help.jsx';

export function Navigation({ showHelpButton = true } = {}) {
  return (
    <div className="nav-bar" data-testid="nav-bar">
      <div className="nav-left" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {showHelpButton && (
          <button
            className="nav-help-btn"
            title="How to Play"
            data-testid="help-button"
            onClick={() => openHelpModal()}
          >
            <span className="nav-help-icon">?</span>
            <span>HELP</span>
          </button>
        )}
      </div>

      <div className="nav-center">
        <div
          className="nav-logo"
          style={{ cursor: 'pointer' }}
          data-testid="nav-logo"
          onClick={() => router.navigate('/')}
        >
          Scriptle
        </div>
      </div>

      <div className="nav-right">
        <button
          className="nav-results-link"
          data-testid="stats-button"
          onClick={() => openStatsModal()}
        >
          STATS
        </button>
      </div>
    </div>
  );
}
