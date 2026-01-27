#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const scriptsDir = 'public/data/scripts';
const packsFile = 'public/data/packs-full.json';

console.log('═'.repeat(80));
console.log('COMPREHENSIVE CHARACTER NAME AUDIT');
console.log('═'.repeat(80));
console.log('');

// Load packs data
const packsData = JSON.parse(fs.readFileSync(packsFile, 'utf8'));

// Load all scripts
const allScripts = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.json'));
const scriptData = {};

for (const scriptFile of allScripts) {
    const data = JSON.parse(fs.readFileSync(path.join(scriptsDir, scriptFile), 'utf8'));
    scriptData[data.id] = {
        file: scriptFile,
        title: data.title,
        year: data.year,
        characters: data.characters || []
    };
}

// Define pack movie mappings
const packMovies = {
    'harry-potter': [
        'hp-sorcerers-stone',
        'hp-chamber-of-secrets',
        'hp-prisoner-of-azkaban',
        'hp-goblet-of-fire',
        'hp-order-of-phoenix',
        'hp-half-blood-prince',
        'hp-deathly-hallows-1',
        'hp-deathly-hallows-2'
    ],
    'star-wars': [
        'star-wars-episode-iv-a-new-hope',
        'star-wars-episode-v-the-empire-strikes-back',
        'star-wars-episode-vi-return-of-the-jedi',
        'star-wars-episode-i-the-phantom-menace',
        'star-wars-episode-ii-attack-of-the-clones',
        'star-wars-episode-iii-revenge-of-the-sith'
    ],
    'the-lord-of-the-rings': [
        'the-lord-of-the-rings-fotr',
        'the-lord-of-the-rings-ttt',
        'the-lord-of-the-rings-rotk'
    ],
    'marvel': [
        'iron-man',
        'the-incredible-hulk',
        'iron-man-2',
        'thor',
        'captain-america-the-first-avenger',
        'the-avengers-2012',
        'captain-marvel',
        'black-widow-film',
        'guardians-of-the-galaxy',
        'doctor-strange',
        'black-panther'
    ],
    'shrek': [
        'shrek-1',
        'shrek-2',
        'shrek-3',
        'shrek-the-third'
    ],
    'bttf-trilogy': [
        'back-to-the-future',
        'back-to-the-future-part-ii',
        'back-to-the-future-part-iii'
    ]
};

function findIssues(characters) {
    const issues = [];

    // Check for duplicates
    const seen = {};
    for (const char of characters) {
        const upper = char.toUpperCase();
        if (seen[upper]) {
            if (seen[upper] !== char) {
                issues.push({
                    type: 'case_difference',
                    char1: seen[upper],
                    char2: char
                });
            } else {
                issues.push({
                    type: 'exact_duplicate',
                    char: char
                });
            }
        }
        seen[upper] = char;
    }

    // Check for extra spaces
    for (const char of characters) {
        if (char !== char.trim()) {
            issues.push({
                type: 'whitespace',
                char: `"${char}"`
            });
        }
        if (char.includes('  ')) {
            issues.push({
                type: 'double_space',
                char: char
            });
        }
    }

    // Check for similar names (simple heuristic)
    const sorted = [...characters].sort();
    for (let i = 0; i < sorted.length - 1; i++) {
        const char1 = sorted[i];
        const char2 = sorted[i + 1];

        // Check if one is a substring of the other
        if (char1.length > 5 && char2.includes(char1)) {
            issues.push({
                type: 'substring',
                char1: char1,
                char2: char2
            });
        }
    }

    return issues;
}

// Check each pack
for (const [packId, movieIds] of Object.entries(packMovies)) {
    const pack = packsData.packs.find(p => p.id === packId);
    if (!pack) continue;

    console.log('─'.repeat(80));
    console.log(`📦 PACK: ${pack.name}`);
    console.log('─'.repeat(80));

    const allPackCharacters = new Set();
    const charactersByMovie = {};
    let totalIssues = 0;

    for (const movieId of movieIds) {
        if (!scriptData[movieId]) continue;

        const chars = scriptData[movieId].characters;
        charactersByMovie[movieId] = chars;
        chars.forEach(c => allPackCharacters.add(c));

        // Check this movie for issues
        const issues = findIssues(chars);
        if (issues.length > 0) {
            console.log(`\n  🎬 ${scriptData[movieId].title}:`);
            for (const issue of issues) {
                totalIssues++;
                if (issue.type === 'exact_duplicate') {
                    console.log(`    ⚠️  Duplicate: "${issue.char}"`);
                } else if (issue.type === 'case_difference') {
                    console.log(`    ⚠️  Case diff: "${issue.char1}" vs "${issue.char2}"`);
                } else if (issue.type === 'whitespace') {
                    console.log(`    ⚠️  Whitespace: ${issue.char}`);
                } else if (issue.type === 'double_space') {
                    console.log(`    ⚠️  Double space: "${issue.char}"`);
                } else if (issue.type === 'substring') {
                    console.log(`    ℹ️  Substring: "${issue.char1}" in "${issue.char2}"`);
                }
            }
        }
    }

    // Check for variations across movies in the pack
    const characterVariations = {};
    for (const char of allPackCharacters) {
        const normalized = char.toUpperCase().trim();
        if (!characterVariations[normalized]) {
            characterVariations[normalized] = [];
        }
        characterVariations[normalized].push(char);
    }

    const crossMovieIssues = Object.entries(characterVariations)
        .filter(([_, variants]) => variants.length > 1);

    if (crossMovieIssues.length > 0) {
        console.log(`\n  🔄 Cross-movie variations:`);
        for (const [normalized, variants] of crossMovieIssues) {
            console.log(`    ⚠️  "${variants[0]}" has variants: ${variants.slice(1).map(v => `"${v}"`).join(', ')}`);
            totalIssues++;
        }
    }

    if (totalIssues === 0) {
        console.log(`  ✅ No issues found`);
    } else {
        console.log(`\n  📊 Total issues: ${totalIssues}`);
    }
}

console.log('\n' + '═'.repeat(80));
console.log('AUDIT COMPLETE');
console.log('═'.repeat(80));
