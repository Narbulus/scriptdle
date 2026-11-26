import { useState, useMemo } from 'preact/hooks';
import { Search, X } from 'lucide-preact';
import { PackRow } from './PackRow.jsx';
import { filterPackSections } from './packFilter.js';

export function PackList({ packs, categories, packThemes, history }) {
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const { sections, totalMatches, categories: normalizedCategories } = useMemo(
        () => filterPackSections({ packs, categories, history, query, activeFilter }),
        [packs, categories, history, query, activeFilter]
    );

    const showFilterPills = normalizedCategories.length > 1;
    const hasActiveFilter = query.trim().length > 0 || activeFilter !== 'all';

    return (
        <div className="pack-directory">
            <div className="home-toolbar">
                <div className="home-search-box">
                    <Search className="home-search-icon" size={16} strokeWidth={2} aria-hidden="true" />
                    <input
                        type="search"
                        className="home-search-input"
                        data-testid="pack-search"
                        value={query}
                        onInput={(e) => setQuery(e.currentTarget.value)}
                        placeholder="Find a movie or show..."
                        aria-label="Find a movie or show"
                        autocomplete="off"
                        spellcheck={false}
                    />
                    {query && (
                        <button
                            type="button"
                            className="home-search-clear"
                            aria-label="Clear search"
                            onClick={() => setQuery('')}
                        >
                            <X size={15} strokeWidth={2.2} />
                        </button>
                    )}
                </div>

                {showFilterPills && (
                    <div className="home-filter-pills" role="group" aria-label="Filter packs by category">
                        <button
                            type="button"
                            className={`home-filter-pill${activeFilter === 'all' ? ' is-active' : ''}`}
                            aria-pressed={activeFilter === 'all'}
                            onClick={() => setActiveFilter('all')}
                        >
                            All <span className="home-filter-count">{packs.length}</span>
                        </button>

                        {normalizedCategories.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                className={`home-filter-pill${activeFilter === cat.id ? ' is-active' : ''}`}
                                aria-pressed={activeFilter === cat.id}
                                onClick={() => setActiveFilter(cat.id)}
                            >
                                {cat.name} <span className="home-filter-count">{cat.packs.length}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {totalMatches === 0 ? (
                <div className="home-empty-results" data-testid="home-empty-results">
                    <p>No packs match {query.trim() ? `“${query.trim()}”` : 'this filter'}.</p>
                    {hasActiveFilter && (
                        <button
                            type="button"
                            className="home-reset-filters-btn"
                            onClick={() => {
                                setQuery('');
                                setActiveFilter('all');
                            }}
                        >
                            Show All Packs
                        </button>
                    )}
                </div>
            ) : (
                sections.map(section => (
                    <section key={section.id} className="category-section" aria-label={section.name}>
                        <div className="category-heading-row">
                            <h2 className="category-heading">{section.name}</h2>
                            <span className="category-count">{section.packs.length}</span>
                        </div>
                        <div className="pack-list-container">
                            {section.packs.map(pack => (
                                <PackRow
                                    key={pack.id}
                                    pack={pack}
                                    theme={packThemes[pack.id]}
                                    completion={history[pack.id]}
                                />
                            ))}
                        </div>
                    </section>
                ))
            )}
        </div>
    );
}
