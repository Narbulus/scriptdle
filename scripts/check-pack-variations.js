#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const scriptsDir = 'public/data/scripts';

// Define all pack movie IDs
const packs = {
    'Harry Potter': [
        'hp-sorcerers-stone', 'hp-chamber-of-secrets', 'hp-prisoner-of-azkaban',
        'hp-goblet-of-fire', 'hp-order-of-phoenix', 'hp-half-blood-prince',
        'hp-deathly-hallows-1', 'hp-deathly-hallows-2'
    ],
    'Star Wars': [
        'star-wars-episode-i-the-phantom-menace', 'star-wars-episode-ii-attack-of-the-clones',
        'star-wars-episode-iii-revenge-of-the-sith', 'star-wars-episode-iv-a-new-hope',
        'star-wars-episode-v-the-empire-strikes-back', 'star-wars-episode-vi-return-of-the-jedi'
    ],
    'Lord of the Rings': [
        'the-lord-of-the-rings-fotr', 'the-lord-of-the-rings-ttt', 'the-lord-of-the-rings-rotk'
    ],
    'Marvel': [
        'iron-man', 'the-incredible-hulk', 'iron-man-2', 'thor',
        'captain-america-the-first-avenger', 'the-avengers-2012',
        'captain-marvel', 'black-widow-film', 'guardians-of-the-galaxy',
        'doctor-strange', 'black-panther'
    ],
    'Shrek': ['shrek-1', 'shrek-2', 'shrek-3', 'shrek-the-third'],
    'Back to the Future': ['back-to-the-future', 'back-to-the-future-part-ii', 'back-to-the-future-part-iii']
};

console.log('CROSS-PACK CHARACTER NAME VARIATIONS CHECK\n');
console.log('='.repeat(80));

for (const [packName, movieIds] of Object.entries(packs)) {
    console.log(`\n${packName} Pack:`);
    console.log('-'.repeat(80));

    // Collect all unique character names across movies
    const charVariations = {};

    for (const movieId of movieIds) {
        const scriptPath = path.join(scriptsDir, `${movieId}.json`);
        if (!fs.existsSync(scriptPath)) continue;

        const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
        const characters = script.characters || [];

        for (const char of characters) {
            const normalized = char.toUpperCase().replace(/\s+/g, ' ').trim();
            if (!charVariations[normalized]) {
                charVariations[normalized] = new Set();
            }
            charVariations[normalized].add(char);
        }
    }

    // Find variations
    let foundIssues = false;
    for (const [_normalized, variants] of Object.entries(charVariations)) {
        if (variants.size > 1) {
            foundIssues = true;
            const variantArray = Array.from(variants);
            console.log(`  ⚠️  "${variantArray[0]}" has variations:`);
            for (let i = 1; i < variantArray.length; i++) {
                console.log(`      - "${variantArray[i]}"`);
            }
        }
    }

    if (!foundIssues) {
        console.log('  ✅ No character name variations found');
    }
}

console.log('\n' + '='.repeat(80));
console.log('CHECK COMPLETE\n');
