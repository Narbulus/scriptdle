/**
 * Pure filtering and category-grouping logic for the Home pack directory.
 * Designed to scale smoothly from a handful of packs to 100+ packs.
 */

export function buildCategoryList(packs, categories = []) {
    const packIds = new Set(packs.map(p => p.id));
    const assigned = new Set();

    const normalized = (categories || [])
        .map(cat => {
            const validIds = (cat.packs || []).filter(id => packIds.has(id));
            validIds.forEach(id => assigned.add(id));
            return {
                id: cat.id || cat.name.toLowerCase().replace(/\s+/g, '-'),
                name: cat.name,
                packs: validIds,
            };
        })
        .filter(cat => cat.packs.length > 0);

    // Ensure packs not listed in any category still appear
    const uncategorized = packs.filter(p => !assigned.has(p.id)).map(p => p.id);
    if (uncategorized.length > 0) {
        normalized.push({
            id: 'more',
            name: normalized.length > 0 ? 'More Packs' : 'All Packs',
            packs: uncategorized,
        });
    }

    return normalized;
}

/**
 * Filter packs by search query, active category ('all' | 'unplayed' | categoryId),
 * and today's completion map, returning grouped sections ready for display.
 */
export function filterPackSections({ packs, categories, history = {}, query = '', activeFilter = 'all' }) {
    const packsById = new Map(packs.map(p => [p.id, p]));
    const normalizedCategories = buildCategoryList(packs, categories);
    const trimmedQuery = query.trim().toLowerCase();

    const matchesPack = (pack, categoryName = '') => {
        if (activeFilter === 'unplayed' && history[pack.id]?.completed) {
            return false;
        }
        if (!trimmedQuery) return true;
        return (
            pack.name.toLowerCase().includes(trimmedQuery) ||
            pack.id.toLowerCase().includes(trimmedQuery) ||
            categoryName.toLowerCase().includes(trimmedQuery)
        );
    };

    const sections = [];
    for (const cat of normalizedCategories) {
        if (activeFilter !== 'all' && activeFilter !== 'unplayed' && cat.id !== activeFilter) {
            continue;
        }

        const matchedPacks = cat.packs
            .map(id => packsById.get(id))
            .filter(pack => pack && matchesPack(pack, cat.name));

        if (matchedPacks.length > 0) {
            sections.push({
                id: cat.id,
                name: cat.name,
                packs: matchedPacks,
            });
        }
    }

    const totalMatches = sections.reduce((sum, sec) => sum + sec.packs.length, 0);
    return { sections, totalMatches, categories: normalizedCategories };
}
