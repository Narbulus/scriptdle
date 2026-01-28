import { signal } from '@preact/signals';
import {
    getCompletionsByDate,
    getStreak,
    getAllCompletions
} from '../utils/completionTracker.js';
import { generateFlower } from '../utils/flowerGenerator.js';
import { getCurrentDate, formatDateToLocal, parseLocalDate } from '../utils/time.js';

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
                        {completions.map((completion) => {
                            const dateFormatted = formatDate(completion.date);
                            const packName = formatPackName(completion.packId);
                            const result = completion.success ? `Win (${completion.attempts})` : `Loss (${completion.attempts})`;

                            return (
                                <li key={`${completion.packId}-${completion.date}`} className="result-item">
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

import { Modal } from '../components/common/Modal.jsx';

function StatsModal({ isOpen, onClose }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Stats"
        >
            <div className="modal-body custom-scrollbar">
                <StatsContent />
            </div>
        </Modal>
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

const isStatsModalOpen = signal(false);

export function openStatsModal() {
    isStatsModalOpen.value = true;
}

export function StatsModalContainer() {
    return (
        <StatsModal
            isOpen={isStatsModalOpen.value}
            onClose={() => isStatsModalOpen.value = false}
        />
    );
}

export function Stats() {
    window.location.href = '/';
    return null;
}
