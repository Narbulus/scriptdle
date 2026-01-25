import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {
    getCompletionsByDate,
    getStreak,
    getAllCompletions
} from '../utils/completionTracker.js';
import { generateFlower } from '../utils/flowerGenerator.js';
import { getCurrentDate, formatDateToLocal, parseLocalDate } from '../utils/time.js';
import { Navigation } from '../components/Navigation.js';

export function StatsContent() {
    const streak = getStreak();
    const completions = getAllCompletions();

    // Calendar Data
    const completionsByDate = getCompletionsByDate();
    const today = parseLocalDate(getCurrentDate());
    const days = [];
    for (let i = 27; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        days.push(date);
    }
    const firstDayOfWeek = days[0].getDay();

    return (
        <div className="stats-container" style={{ padding: 0 }}>
            {/* Streak */}
            <div className="streak-section">
                <div className="streak-text">{streak} day streak</div>
            </div>

            {/* Calendar */}
            <div className="calendar-section">
                <div className="calendar-grid">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="calendar-day empty"></div>
                    ))}
                    {days.map(date => {
                        const dateStr = formatDateToLocal(date);
                        const dayCompletions = completionsByDate[dateStr];
                        const firstSuccess = dayCompletions?.find(c => c.success);
                        let className = "calendar-day";
                        let content = null;

                        if (firstSuccess) {
                            className += " has-completion";
                            const flowerSvg = generateFlower(firstSuccess.packId + dateStr, '#fff9c4');
                            content = (
                                <div
                                    className="calendar-flower"
                                    style={{ backgroundImage: `url("${flowerSvg}")` }}
                                />
                            );
                        } else if (dayCompletions && dayCompletions.length > 0) {
                            className += " has-attempt";
                        }

                        return (
                            <div key={dateStr} className={className} title={dateStr}>
                                {content}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Results */}
            <div className="results-section">
                <h2 className="section-heading">results</h2>
                {completions.length === 0 ? (
                    <p className="empty-state">No completions yet. Play a pack to get started!</p>
                ) : (
                    <ul className="results-list">
                        {completions.map((completion, idx) => {
                            const dateFormatted = formatDate(completion.date);
                            const packName = formatPackName(completion.packId);
                            const result = completion.success ? `Win (${completion.attempts})` : `Loss (${completion.attempts})`;

                            return (
                                <li key={idx} className="result-item">
                                    {completion.success && (
                                        <span
                                            className="flower-bullet"
                                            style={{ backgroundImage: `url("${generateFlower(completion.packId + completion.date, '#fff9c4')}")` }}
                                        />
                                    )}
                                    <span className="result-text">{packName} - {dateFormatted} - {result}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

function StatsModal({ onClose }) {
    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div
            className="modal-overlay"
            data-theme="main"
            style={{ display: 'flex' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">Stats</h2>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-content">
                    <div className="modal-body custom-scrollbar">
                        <StatsContent />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helpers
function formatPackName(packId) {
    return packId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function formatDate(dateStr) {
    const date = parseLocalDate(dateStr);
    const today = parseLocalDate(getCurrentDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ----------------------------------------------------------------------
// Bridge
// ----------------------------------------------------------------------

// Standalone Modal Opener
let modalContainer = null;

export function openStatsModal() {
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'stats-modal-root';
        document.body.appendChild(modalContainer);
    }

    const close = () => {
        render(null, modalContainer); // Unmount
    };

    render(<StatsModal onClose={close} />, modalContainer);
}

// Page Renderer
export function renderStats({ navContainer, contentContainer }) {
    // If navigated to directly, render the page with the modal open?
    // Original behavior: Redirect to home.
    window.location.href = '/';
}
