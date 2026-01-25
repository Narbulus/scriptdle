#!/usr/bin/env node
/**
 * generate-packs-full.js
 * 
 * Generates a combined packs-full.json file that includes all pack data
 * with their themes, eliminating N+1 fetches on the home page.
 * 
 * Usage: node scripts/generate-packs-full.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../public/data');
const PACKS_DIR = path.join(DATA_DIR, 'packs');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'packs-full.json');

async function generatePacksFull() {
    console.log('📦 Generating packs-full.json...\n');

    // Read the index file
    const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));

    // Read all pack files and extract theme data
    const packsWithThemes = [];

    for (const pack of indexData.packs) {
        const packFile = path.join(PACKS_DIR, `${pack.id}.json`);

        if (fs.existsSync(packFile)) {
            const packData = JSON.parse(fs.readFileSync(packFile, 'utf-8'));

            packsWithThemes.push({
                id: pack.id,
                name: pack.name,
                movieCount: pack.movieCount,
                theme: packData.theme || null,
                tierMessages: packData.tierMessages || null
            });

            console.log(`  ✓ ${pack.name} (${pack.movieCount} movies)`);
        } else {
            console.warn(`  ⚠ Pack file not found: ${packFile}`);
            packsWithThemes.push({
                id: pack.id,
                name: pack.name,
                movieCount: pack.movieCount,
                theme: null,
                tierMessages: null
            });
        }
    }

    // Build the combined output
    const output = {
        featured: indexData.featured,
        categories: indexData.categories,
        packs: packsWithThemes,
        generatedAt: new Date().toISOString()
    };

    // Write the output file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log(`\n✅ Generated ${OUTPUT_FILE}`);
    console.log(`   ${packsWithThemes.length} packs with themes`);
}

generatePacksFull().catch(err => {
    console.error('Error generating packs-full.json:', err);
    process.exit(1);
});
