import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'public/data';
const DAILY_ALL_DIR = join(DATA_DIR, 'daily-all');
const PACKS_FILE = join(DATA_DIR, 'packs-full.json');

let errors = [];
let warnings = [];

function error(msg) {
  errors.push(msg);
  console.error(`ERROR: ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`WARN: ${msg}`);
}

function validatePuzzleStructure(puzzle, packId, date) {
  const prefix = `[${packId}/${date}]`;

  if (puzzle.version === undefined) {
    error(`${prefix} Missing 'version' field`);
  }

  if (puzzle.date !== date) {
    error(`${prefix} Date mismatch: expected ${date}, got ${puzzle.date}`);
  }

  if (puzzle.packId !== packId) {
    error(`${prefix} Pack ID mismatch: expected ${packId}, got ${puzzle.packId}`);
  }

  if (!puzzle.puzzle) {
    error(`${prefix} Missing 'puzzle' object`);
    return;
  }

  const p = puzzle.puzzle;

  if (!p.targetLine) {
    error(`${prefix} Missing puzzle.targetLine`);
  } else {
    if (!p.targetLine.character) error(`${prefix} Missing targetLine.character`);
    if (!p.targetLine.text) error(`${prefix} Missing targetLine.text`);
    if (!p.targetLine.movie) error(`${prefix} Missing targetLine.movie`);
  }

  if (!Array.isArray(p.contextAfter)) {
    error(`${prefix} puzzle.contextAfter should be an array`);
  }

  // metadata is now in packs-full.json, not in daily-all puzzles
  if (puzzle.metadata) {
    const m = puzzle.metadata;

    if (!Array.isArray(m.movies) || m.movies.length === 0) {
      error(`${prefix} metadata.movies should be a non-empty array`);
    }

    if (!m.charactersByMovie || typeof m.charactersByMovie !== 'object') {
      error(`${prefix} metadata.charactersByMovie should be an object`);
    } else {
      const movieCount = m.movies?.length || 0;
      const charMovieCount = Object.keys(m.charactersByMovie).length;
      if (charMovieCount !== movieCount) {
        warn(`${prefix} charactersByMovie has ${charMovieCount} entries but movies has ${movieCount}`);
      }
    }
  }
}

function main() {
  console.log('Validating daily puzzle data...\n');

  if (!existsSync(PACKS_FILE)) {
    error(`Packs file not found: ${PACKS_FILE}`);
    process.exit(1);
  }

  const packsData = JSON.parse(readFileSync(PACKS_FILE, 'utf-8'));
  const packIds = packsData.packs.map(p => p.id);

  console.log(`Found ${packIds.length} pack(s): ${packIds.join(', ')}\n`);

  if (!existsSync(DAILY_ALL_DIR)) {
    error(`Daily-all directory not found: ${DAILY_ALL_DIR}`);
    process.exit(1);
  }

  const dailyFiles = readdirSync(DAILY_ALL_DIR).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));

  if (dailyFiles.length === 0) {
    error('No daily puzzle files found');
    process.exit(1);
  }

  console.log(`Found ${dailyFiles.length} daily files\n`);

  const sampleFiles = dailyFiles.slice(0, 5).concat(dailyFiles.slice(-5));
  const uniqueFiles = [...new Set(sampleFiles)];

  console.log(`Validating ${uniqueFiles.length} sample files...\n`);

  for (const file of uniqueFiles) {
    const date = file.replace('.json', '');
    const filePath = join(DAILY_ALL_DIR, file);
    const consolidated = JSON.parse(readFileSync(filePath, 'utf-8'));

    if (!consolidated.date) {
      error(`[${file}] Missing date field`);
      continue;
    }

    if (consolidated.date !== date) {
      error(`[${file}] Date mismatch in file: expected ${date}, got ${consolidated.date}`);
    }

    if (!consolidated.puzzles || typeof consolidated.puzzles !== 'object') {
      error(`[${file}] Missing or invalid puzzles object`);
      continue;
    }

    const puzzlePackIds = Object.keys(consolidated.puzzles);
    if (puzzlePackIds.length === 0) {
      error(`[${file}] No puzzles in file`);
      continue;
    }

    for (const packId of puzzlePackIds) {
      if (!packIds.includes(packId)) {
        warn(`[${file}] Unknown pack ID: ${packId}`);
      }

      const puzzle = consolidated.puzzles[packId];
      validatePuzzleStructure(puzzle, packId, date);
    }

    for (const expectedPackId of packIds) {
      if (!puzzlePackIds.includes(expectedPackId)) {
        warn(`[${file}] Missing puzzle for pack: ${expectedPackId}`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));

  if (errors.length > 0) {
    console.error(`\nValidation FAILED with ${errors.length} error(s) and ${warnings.length} warning(s)`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`\nValidation PASSED with ${warnings.length} warning(s)`);
  } else {
    console.log('\nValidation PASSED');
  }
}

main();
