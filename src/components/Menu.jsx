import { signal } from '@preact/signals';
import { useState, useEffect } from 'preact/hooks';
import { router } from '../router.jsx';
import { openHelpModal } from './Help.jsx';
import { openStatsModal } from '../pages/Stats.jsx';
import { getTimeUntilMidnight } from '../utils/time.js';
import { track } from '../utils/analytics.js';
import { X, Film, BarChart3, CircleHelp, Info } from 'lucide-preact';

export const isMenuOpen = signal(false);

export function openMenu() {
    track('menu_open');
    isMenuOpen.value = true;
}

export function closeMenu() {
    isMenuOpen.value = false;
}

export function Menu() {
    const [countdown, setCountdown] = useState('00:00:00');

    useEffect(() => {
        const updateCountdown = () => {
            const time = getTimeUntilMidnight();
            const hours = String(time.hours).padStart(2, '0');
            const minutes = String(time.minutes).padStart(2, '0');
            const seconds = String(time.seconds).padStart(2, '0');
            setCountdown(`${hours}:${minutes}:${seconds}`);
        };

        updateCountdown();
        const intervalId = setInterval(updateCountdown, 1000);
        return () => clearInterval(intervalId);
    }, []);

    const handleMenuItemClick = (name, action) => {
        track('menu_click', { item_name: name });
        closeMenu();
        action();
    };

    if (!isMenuOpen.value) {
        return null;
    }

    return (
        <div className="menu-container">
            {/* Overlay - clicking it closes the menu */}
            <div
                className="menu-overlay"
                onClick={closeMenu}
                data-testid="menu-overlay"
            />

            {/* The actual menu panel */}
            <div className="menu-panel" data-testid="menu-panel" data-theme="main">
                {/* Menu Header */}
                <div className="menu-header">
                    <h2 className="menu-title">MENU</h2>
                    <button
                        className="menu-close-btn"
                        onClick={closeMenu}
                        data-testid="menu-close"
                        aria-label="Close menu"
                    >
                        <X size={24} strokeWidth={2} />
                    </button>
                </div>

                <div className="menu-content">
                    {/* Links Section */}
                    <div className="menu-links-section">
                        <button
                            className="menu-link-item"
                            onClick={() => handleMenuItemClick('more_movies', () => router.navigate('/'))}
                            data-testid="menu-all-movies"
                        >
                            <Film size={20} strokeWidth={2} />
                            <span>MORE MOVIES</span>
                        </button>

                        <button
                            className="menu-link-item"
                            onClick={() => handleMenuItemClick('stats', () => openStatsModal())}
                            data-testid="menu-stats"
                        >
                            <BarChart3 size={20} strokeWidth={2} />
                            <span>STATS</span>
                        </button>

                        <button
                            className="menu-link-item"
                            onClick={() => handleMenuItemClick('instructions', () => openHelpModal())}
                            data-testid="menu-help"
                        >
                            <CircleHelp size={20} strokeWidth={2} />
                            <span>INSTRUCTIONS</span>
                        </button>

                        <button
                            className="menu-link-item"
                            onClick={() => handleMenuItemClick('about', () => router.navigate('/about'))}
                            data-testid="menu-about"
                        >
                            <Info size={20} strokeWidth={2} />
                            <span>ABOUT</span>
                        </button>
                    </div>
                </div>

                <div className="menu-footer">
                    <div className="menu-countdown-label">New Puzzles in</div>
                    <div className="menu-countdown">{countdown}</div>
                </div>
            </div>
        </div>
    );
}
