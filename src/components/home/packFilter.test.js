import { describe, expect, test } from 'vitest';
import { buildCategoryList, filterPackSections } from './packFilter.js';

const samplePacks = [
    { id: 'star-wars', name: 'Star Wars', movieCount: 6 },
    { id: 'harry-potter', name: 'Harry Potter', movieCount: 8 },
    { id: 'pixar-classics', name: 'Pixar Classics', movieCount: 8 },
    { id: 'shrek', name: 'Shrek', movieCount: 4 },
    { id: 'indiana-jones', name: 'Indiana Jones', movieCount: 4 },
];

const sampleCategories = [
    { id: 'classics', name: 'Classics', packs: ['star-wars', 'harry-potter'] },
    { id: 'animated', name: 'Animated', packs: ['pixar-classics', 'shrek'] },
];

describe('packFilter', () => {
    test('appends uncategorized packs under More Packs so new packs never vanish', () => {
        const categories = buildCategoryList(samplePacks, sampleCategories);
        expect(categories.map(c => c.name)).toEqual(['Classics', 'Animated', 'More Packs']);
        expect(categories[2].packs).toEqual(['indiana-jones']);
    });

    test('filters packs by search query across name and category', () => {
        const byName = filterPackSections({
            packs: samplePacks,
            categories: sampleCategories,
            query: 'potter',
        });
        expect(byName.totalMatches).toBe(1);
        expect(byName.sections[0].packs[0].id).toBe('harry-potter');

        const byCategory = filterPackSections({
            packs: samplePacks,
            categories: sampleCategories,
            query: 'animated',
        });
        expect(byCategory.totalMatches).toBe(2);
        expect(byCategory.sections[0].id).toBe('animated');
    });

    test('filters packs by category pill', () => {
        const result = filterPackSections({
            packs: samplePacks,
            categories: sampleCategories,
            activeFilter: 'animated',
        });
        expect(result.totalMatches).toBe(2);
        expect(result.sections.map(s => s.id)).toEqual(['animated']);
    });

    test('filters to unplayed packs using today history', () => {
        const result = filterPackSections({
            packs: samplePacks,
            categories: sampleCategories,
            history: {
                'star-wars': { completed: true, success: true },
                'shrek': { completed: true, success: false },
            },
            activeFilter: 'unplayed',
        });

        expect(result.totalMatches).toBe(3);
        const ids = result.sections.flatMap(s => s.packs.map(p => p.id));
        expect(ids).toEqual(['harry-potter', 'pixar-classics', 'indiana-jones']);
    });

    test('returns empty sections when nothing matches', () => {
        const result = filterPackSections({
            packs: samplePacks,
            categories: sampleCategories,
            query: 'nonexistent-franchise',
        });
        expect(result.totalMatches).toBe(0);
        expect(result.sections).toEqual([]);
    });
});
