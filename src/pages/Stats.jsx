import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import {
    getStreak,
    getAllCompletions
} from '../utils/completionTracker.js';
import { generateFlower, generateBeetle } from '../utils/flowerGenerator.js';
import { parseLocalDate } from '../utils/time.js';
import { isCompactPlatform } from '../services/platform.js';

// Compact pagination: 2 rows per page, columns determined by viewport width
const ROWS_PER_PAGE = 2;

function getCompactColumns() {
    if (typeof window === 'undefined') return 3;
    return window.innerWidth >= 500 ? 4 : 3;
}

export function StatsContent() {
    const streak = getStreak();
    const completions = getAllCompletions();
    const [selectedIndex, setSelectedIndex] = useState(completions.length > 0 ? 0 : null);
    const [page, setPage] = useState(0);
    const compact = isCompactPlatform();

    const columnsPerRow = compact ? getCompactColumns() : 3;
    const itemsPerPage = ROWS_PER_PAGE * columnsPerRow;

    // Calculate empty slots: pad to fill rows
    const minSlots = compact ? itemsPerPage : 9;
    const totalSlots = Math.max(minSlots, Math.ceil((completions.length + (compact ? columnsPerRow : 9)) / columnsPerRow) * columnsPerRow);
    const emptyCount = totalSlots - completions.length;

    // Build all items (completions + empty slots)
    const allItems = [
        ...completions.map((completion, index) => ({ type: 'completion', completion, index })),
        ...Array.from({ length: emptyCount }).map((_, i) => ({ type: 'empty', index: completions.length + i })),
    ];

    // Pagination keeps compact modals at a stable height.
    const totalPages = compact ? Math.max(1, Math.ceil(allItems.length / itemsPerPage)) : 1;
    let pageItems = compact ? allItems.slice(page * itemsPerPage, (page + 1) * itemsPerPage) : allItems;

    // Pad last page to full size so the modal doesn't resize between pages
    if (compact && pageItems.length < itemsPerPage) {
        const pad = itemsPerPage - pageItems.length;
        pageItems = [
            ...pageItems,
            ...Array.from({ length: pad }).map((_, i) => ({ type: 'empty', index: allItems.length + i })),
        ];
    }

    const selected = selectedIndex !== null ? completions[selectedIndex] : null;

    // Detail lives in a fixed slot below the grid rather than being injected
    // into it. The old .inventory-tooltip spanned a grid row above the
    // selected tile, so every click reflowed the grid and jumped the tiles —
    // and its caret offset hardcoded 3 columns while getCompactColumns()
    // returns 4 above 500px, so it pointed at the wrong tile on wide views.
    const gridContent = [];
    for (let i = 0; i < pageItems.length; i++) {
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
            {/* Streak */}
            {(
                <div className="streak-section">
                    <span className="streak-count">{streak}</span>
                    <span className="streak-label">day streak</span>
                </div>
            )}

            {/* Inventory Grid */}
            <div className="inventory-grid">
                {gridContent}
            </div>

            {/* Selected entry detail — fixed slot, reserved height */}
            <div className="inventory-detail">
                {selected ? (
                    <>
                        <div className="inventory-detail-name">
                            {formatPackName(selected.packId)}
                        </div>
                        <div className="inventory-detail-meta">
                            {formatDate(selected.date)}
                            {' · '}
                            {selected.success
                                ? `${selected.attempts}/5 attempts`
                                : 'X/5 attempts'}
                        </div>
                    </>
                ) : (
                    <div className="inventory-detail-empty">
                        Pick a specimen to see where it came from.
                    </div>
                )}
            </div>

            {/* Pagination footer for compact layouts */}
            {compact && totalPages > 1 && (
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
            id="stats-modal"
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
