import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import {
    getStreak,
    getAllCompletions
} from '../utils/completionTracker.js';
import { generateFlower, generateBeetle } from '../utils/flowerGenerator.js';
import { parseLocalDate } from '../utils/time.js';

function isReddit() {
    return typeof window !== 'undefined' && !!window.SCRIPTLE_SHARE_HANDLER;
}

// Reddit pagination: 2 rows per page, columns determined by viewport width
const ROWS_PER_PAGE = 2;

function getRedditColumns() {
    if (typeof window === 'undefined') return 3;
    return window.innerWidth >= 500 ? 4 : 3;
}

export function StatsContent() {
    const streak = getStreak();
    const completions = getAllCompletions();
    const [selectedIndex, setSelectedIndex] = useState(completions.length > 0 ? 0 : null);
    const [page, setPage] = useState(0);
    const reddit = isReddit();

    const columnsPerRow = reddit ? getRedditColumns() : 3;
    const itemsPerPage = ROWS_PER_PAGE * columnsPerRow;

    // Calculate empty slots: pad to fill rows
    const minSlots = reddit ? itemsPerPage : 9;
    const totalSlots = Math.max(minSlots, Math.ceil((completions.length + (reddit ? columnsPerRow : 9)) / columnsPerRow) * columnsPerRow);
    const emptyCount = totalSlots - completions.length;

    // Build all items (completions + empty slots)
    const allItems = [
        ...completions.map((completion, index) => ({ type: 'completion', completion, index })),
        ...Array.from({ length: emptyCount }).map((_, i) => ({ type: 'empty', index: completions.length + i })),
    ];

    // Pagination (Reddit only)
    const totalPages = reddit ? Math.max(1, Math.ceil(allItems.length / itemsPerPage)) : 1;
    const pageItems = reddit ? allItems.slice(page * itemsPerPage, (page + 1) * itemsPerPage) : allItems;

    const selected = selectedIndex !== null ? completions[selectedIndex] : null;
    // For tooltip positioning, use the index within the current page slice
    const selectedPageOffset = reddit ? page * itemsPerPage : 0;
    const selectedLocalIndex = selectedIndex !== null ? selectedIndex - selectedPageOffset : -1;
    const selectedRow = selectedLocalIndex >= 0 && selectedLocalIndex < pageItems.length
        ? Math.floor(selectedLocalIndex / columnsPerRow) : -1;

    // Build grid content with tooltip
    const gridContent = [];
    for (let i = 0; i < pageItems.length; i++) {
        const row = Math.floor(i / columnsPerRow);
        const isFirstInRow = i % columnsPerRow === 0;

        if (isFirstInRow && row === selectedRow && selected) {
            const colInRow = selectedLocalIndex % columnsPerRow;
            gridContent.push(
                <div
                    key="tooltip"
                    className="inventory-tooltip"
                    style={{ '--tooltip-col': colInRow }}
                >
                    <div className="inventory-tooltip-body">
                        <div className="inventory-tooltip-line1">
                            {formatPackName(selected.packId)}
                            <span className="inventory-tooltip-date"> &middot; {formatDate(selected.date)}</span>
                        </div>
                        <div className="inventory-tooltip-line2">
                            {selected.success
                                ? `Won in ${selected.attempts} attempt${selected.attempts !== 1 ? 's' : ''}`
                                : `Lost after ${selected.attempts} attempts`}
                        </div>
                    </div>
                    <div className="inventory-tooltip-caret" />
                </div>
            );
        }

        const item = pageItems[i];
        if (item.type === 'completion') {
            const { completion, index } = item;
            const seed = completion.packId + completion.date;
            const isPerfect = completion.success && completion.attempts === 1;
            const svgUrl = completion.success
                ? generateFlower(seed, '#fff9c4', { golden: isPerfect })
                : generateBeetle(seed, '#fff9c4');

            gridContent.push(
                <div
                    key={`${completion.packId}-${completion.date}`}
                    className={`inventory-item${selectedIndex === index ? ' selected' : ''}`}
                    onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
                >
                    <div
                        className="inventory-item-svg"
                        style={{ backgroundImage: `url("${svgUrl}")` }}
                    />
                </div>
            );
        } else {
            gridContent.push(
                <div key={`empty-${item.index}`} className="inventory-item empty" />
            );
        }
    }

    return (
        <div className="stats-container" style={{ padding: 0 }}>
            {/* Streak — only on first page in Reddit mode */}
            {(!reddit || page === 0) && (
                <div className="streak-section">
                    <span className="streak-count">{streak}</span>
                    <span className="streak-label">day streak</span>
                </div>
            )}

            {/* Inventory Grid */}
            <div className="inventory-grid">
                {gridContent}
            </div>

            {/* Pagination footer (Reddit only) */}
            {reddit && totalPages > 1 && (
                <div className="inventory-pagination">
                    <button
                        className="inventory-page-btn"
                        onClick={() => { setPage(p => p - 1); setSelectedIndex(null); }}
                        disabled={page === 0}
                    >
                        ◀ Prev
                    </button>
                    <span className="inventory-page-indicator">{page + 1} / {totalPages}</span>
                    <button
                        className="inventory-page-btn"
                        onClick={() => { setPage(p => p + 1); setSelectedIndex(null); }}
                        disabled={page >= totalPages - 1}
                    >
                        Next ▶
                    </button>
                </div>
            )}
        </div>
    );
}

import { Modal } from '../components/common/Modal.jsx';

function StatsModal({ isOpen, onClose }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Your Collection"
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
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
