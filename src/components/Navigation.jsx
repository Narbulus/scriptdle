import { router } from '../router.jsx';
import { openMenu } from './Menu.jsx';
import { openHelpModal } from './Help.jsx';
import { currentPackName } from '../services/game-state.js';
import { CircleHelp, Menu as MenuIcon } from 'lucide-preact';

export function Navigation() {
  return (
    <div className="nav-bar" data-testid="nav-bar">
      <div className="nav-left">
        <button
          className="nav-help-btn"
          title="How to Play"
          data-testid="help-button"
          onClick={() => openHelpModal(currentPackName.value)}
        >
          <span className="nav-help-icon">
            <CircleHelp size={20} strokeWidth={2} />
          </span>
          <span>HELP</span>
        </button>
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
          className="nav-menu-btn"
          title="Menu"
          data-testid="menu-button"
          onClick={() => openMenu()}
        >
          <span className="nav-menu-icon">
            <MenuIcon size={20} strokeWidth={2} />
          </span>
          <span>MENU</span>
        </button>
      </div>
    </div>
  );
}
