import { PackRow } from './PackRow.jsx';

export function PackList({ packs, categories, packThemes, history }) {
    const packsById = {};
    packs.forEach(p => packsById[p.id] = p);

    // Helper to get completion for a pack
    const getCompletion = (packId) => {
        // History is map of packId -> { completed: boolean, success: boolean, date: string }
        return history[packId];
    };

    const renderPack = (packId) => {
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
        return (
            <div className="pack-list-container">
                {packs.map(p => renderPack(p.id))}
            </div>
        );
    }

    return (
        <div>
            {categories.map(category => (
                <div key={category.name} className="category-section">
                    <h2 className="category-heading">{category.name}</h2>
                    <div className="pack-list-container">
                        {category.packs.map(packId => renderPack(packId))}
                    </div>
                </div>
            ))}
        </div>
    );
}
