import { PackRow } from './PackRow.jsx';

export function PackList({ packs, categories, packThemes, history, excludedIds = [] }) {
    const packsById = {};
    packs.forEach(p => packsById[p.id] = p);
    const excludedSet = new Set(excludedIds);

    // Helper to get completion for a pack
    const getCompletion = (packId) => {
        // History is map of packId -> { completed: boolean, success: boolean, date: string }
        return history[packId];
    };

    const renderPack = (packId) => {
        if (excludedSet.has(packId)) return null;

        const pack = packsById[packId];
        if (!pack) return null;
        return (
            <PackRow
                key={packId}
                pack={pack}
                theme={packThemes[packId]}
                completion={getCompletion(packId)}
            />
        );
    };

    if (!categories || categories.length === 0) {
        const visiblePacks = packs.filter(p => !excludedSet.has(p.id));
        if (visiblePacks.length === 0) return null;

        return (
            <div className="pack-list-container">
                {visiblePacks.map(p => renderPack(p.id))}
            </div>
        );
    }

    return (
        <div>
            {categories.map(category => {
                const visiblePacks = category.packs.filter(pid => !excludedSet.has(pid));
                if (visiblePacks.length === 0) return null;

                return (
                    <div key={category.name} className="category-section">
                        <h2 className="category-heading">{category.name}</h2>
                        <div className="pack-list-container">
                            {visiblePacks.map(packId => renderPack(packId))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
