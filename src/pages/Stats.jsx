import { signal } from '@preact/signals';
import { useState, useEffect } from 'preact/hooks';
import {
    getStreak,
    getAllCompletions
} from '../utils/completionTracker.js';
import { generateFlower, generateBeetle } from '../utils/flowerGenerator.js';
import { parseLocalDate } from '../utils/time.js';
import { Modal } from '../components/common/Modal.jsx';

// Modal pagination: 2 rows per page, columns determined by viewport width
const ROWS_PER_PAGE = 2;

function getGridColumns() {
    if (typeof window === 'undefined') return 3;
    return window.innerWidth >= 500 ? 4 : 3;
}

export function StatsContent({ paginated = true }) {
    const streak = getStreak();
    const completions = getAllCompletions();
    const [selectedIndex, setSelectedIndex] = useState(completions.length > 0 ? 0 : null);
    const [page, setPage] = useState(0);
    const [columnsPerRow, setColumnsPerRow] = useState(getGridColumns);

    useEffect(() => {
        const onResize = () => setColumnsPerRow(getGridColumns());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const itemsPerPage = ROWS_PER_PAGE * columnsPerRow;

    // Pad grid to complete rows so the specimen sheet reads as an intentional album
    const minSlots = paginated ? itemsPerPage : columnsPerRow * 3;
    const totalSlots = Math.max(
        minSlots,
        Math.ceil((completions.length + columnsPerRow) / columnsPerRow) * columnsPerRow
    );
    const emptyCount = totalSlots - completions.length;

    const allItems = [
        ...completions.map((completion, index) => ({ type: 'completion', completion, index })),
        ...Array.from({ length: emptyCount }).map((_, i) => ({ type: 'empty', index: completions.length + i })),
    ];

    const totalPages = paginated ? Math.max(1, Math.ceil(allItems.length / itemsPerPage)) : 1;
    const safePage = Math.min(page, totalPages - 1);
    let pageItems = paginated
        ? allItems.slice(safePage * itemsPerPage, (safePage + 1) * itemsPerPage)
        : allItems;

    // Pad last page to full size so the modal never resizes between pages
    if (paginated && pageItems.length < itemsPerPage) {
        const pad = itemsPerPage - pageItems.length;
        pageItems = [
            ...pageItems,
            ...Array.from({ length: pad }).map((_, i) => ({ type: 'empty', index: allItems.length + i })),
        ];
    }

    const selected = selectedIndex !== null ? completions[selectedIndex] : null;
    const wins = completions.filter(c => c.success).length;
    const perfects = completions.filter(c => c.success && c.attempts === 1).length;

    const gridContent = pageItems.map((item) => {
        if (item.type === 'completion') {
            const { completion, index } = item;
            const seed = completion.packId + completion.date;
            const isPerfect = completion.success && completion.attempts === 1;
            const svgUrl = completion.success
                ? generateFlower(seed, '#fff9c4', { golden: isPerfect })
                : generateBeetle(seed, '#fff9c4');

            return (
                <button
                    type="button"
                    key={`${completion.packId}-${completion.date}`}
                    className={`inventory-item${selectedIndex === index ? ' selected' : ''}`}
                    aria-pressed={selectedIndex === index}
                    aria-label={`${formatPackName(completion.packId)}, ${formatDate(completion.date)}`}
                    onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
                >
                    <div
                        className="inventory-item-svg"
                        style={{ backgroundImage: `url("${svgUrl}")` }}
                    />
                </button>
            );
        }

        return <div key={`empty-${item.index}`} className="inventory-item empty" aria-hidden="true" />;
    });

    return (
        <div className="stats-container" data-testid="stats-collection">
            {/* Streak & summary */}
            <div className="streak-section">
                <span className="streak-count">{streak}</span>
                <span className="streak-label">day streak</span>
                {completions.length > 0 && (
                    <span className="streak-summary">
                        &middot; {wins} solved{perfects > 0 ? ` · ${perfects} perfect` : ''}
                    </span>
                )}
            </div>

            {/* Specimen Grid */}
            <div className="inventory-grid">
                {gridContent}
            </div>

            {/* Selected entry detail — fixed height slot so clicking tiles never reflows */}
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
                        {completions.length > 0
                            ? 'Pick a specimen to see where it came from.'
                            : 'Play a daily puzzle to press your first specimen.'}
                    </div>
                )}
            </div>

            {/* Pagination footer (modal view) */}
            {paginated && totalPages > 1 && (
                <div className="inventory-pagination">
                    <button
                        type="button"
                        className="inventory-page-btn"
                        onClick={() => { setPage(p => Math.max(0, p - 1)); setSelectedIndex(null); }}
                        disabled={safePage === 0}
                    >
                        ◀ Prev
                    </button>
                    <span className="inventory-page-indicator">{safePage + 1} / {totalPages}</span>
                    <button
                        type="button"
                        className="inventory-page-btn"
                        onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); setSelectedIndex(null); }}
                        disabled={safePage >= totalPages - 1}
                    >
                        Next ▶
                    </button>
                </div>
            )}
        </div>
    );
}

function StatsModal({ isOpen, onClose }) {
    return (
        <Modal
            id="stats-modal"
            isOpen={isOpen}
            onClose={onClose}
            title="Your Collection"
            containerClassName="collection-sheet foxed"
        >
            <div className="modal-body custom-scrollbar">
                <StatsContent paginated={true} />
            </div>
        </Modal>
    );
}

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
    useEffect(() => {
        document.title = 'Your Collection - Scriptle';
    }, []);

    return (
        <main className="stats-page" data-testid="stats-page">
            <section className="stats-page-sheet collection-sheet foxed" aria-labelledby="stats-page-title">
                <header className="collection-sheet-header">
                    <h1 id="stats-page-title" className="collection-sheet-title">Your Collection</h1>
                    <a href="/" data-link className="collection-sheet-back">
                        &larr; All Packs
                    </a>
                </header>
                <div className="collection-sheet-body">
                    <StatsContent paginated={false} />
                </div>
            </section>
        </main>
    );
}
