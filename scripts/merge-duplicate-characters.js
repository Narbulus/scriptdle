import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Script to merge duplicate character names across all movie script JSON files
 * Based on comprehensive duplicate analysis and user approval
 */

const SCRIPT_DIR = resolve(process.cwd(), 'public/data/scripts');

// Define all character merges to apply
const CHARACTER_MERGES = [
  // Technical notation removals
  { file: 'aladdin-1992.json', from: 'PEDDLER (VO)', to: 'PEDDLER' },
  { file: 'shrek-3.json', from: 'PRINCE CHARMING (CONT\'D)', to: 'PRINCE CHARMING' },
  { file: 'shrek-3.json', from: 'GUINEVERE (CONT\'D)', to: 'GUINEVERE' },
  { file: 'coco-2017.json', from: 'ABUELA ELENA (O.S.)', to: 'ABUELA ELENA' },
  { file: 'coco-2017.json', from: 'MIGUEL (V.O)', to: 'MIGUEL' },
  { file: 'coco-2017.json', from: 'MIGUEL (V.O.)', to: 'MIGUEL' },
  { file: 'ratatouille.json', from: 'REMY (V.O)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (V.O.)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (O.C.)', to: 'REMY' },
  { file: 'up-2009.json', from: 'NEWSREEL ANNOUNCER (O.S.)', to: 'NEWSREEL ANNOUNCER' },
  { file: 'up-2009.json', from: 'NEWSREEL ANNOUNCER (V.O.)', to: 'NEWSREEL ANNOUNCER' },
  { file: 'up-2009.json', from: 'YOUNG ELLIE (O.S.)', to: 'YOUNG ELLIE' },
  { file: 'wall-e.json', from: 'AUTOPILOT (O.S.)', to: 'AUTOPILOT' },
  { file: 'wall-e.json', from: 'CAPTAIN (INTERCOM)', to: 'CAPTAIN' },
  { file: 'wall-e.json', from: 'CAPTAIN (ON INTERCOM)', to: 'CAPTAIN' },
  { file: 'wall-e.json', from: 'CAPTAIN (OVER INTERCOM)', to: 'CAPTAIN' },
  { file: 'wall-e.json', from: 'MARY (CONT\'D)', to: 'MARY' },
  { file: 'wall-e.json', from: 'SHIP\'S COMPUTER (V.O.)', to: 'SHIP\'S COMPUTER' },

  // Emotional/location state removals
  { file: 'ratatouille.json', from: 'REMY (GIDDY)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (GUILTY)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'REMY (MOANING)', to: 'REMY' },
  { file: 'ratatouille.json', from: 'GUSTEAU (ON T.V.)', to: 'GUSTEAU' },
  { file: 'ratatouille.json', from: 'GUSTEAU (TV)', to: 'GUSTEAU' },
  { file: 'wall-e.json', from: 'PASSENGER #2 (ON SCREEN)', to: 'PASSENGER #2' },
  { file: 'the-lion-king.json', from: 'SCAR (& HYENAS)', to: 'SCAR' },

  // Use full names/more context
  { file: 'incredibles-1.json', from: 'BOB', to: 'BOB (MR. INCREDIBLE)' },
  { file: 'the-incredibles.json', from: 'BOB', to: 'BOB (MR. INCREDIBLE)' },
  { file: 'incredibles-1.json', from: 'HELEN', to: 'HELEN (ELASTIGIRL)' },
  { file: 'the-incredibles.json', from: 'HELEN', to: 'HELEN (ELASTIGIRL)' },
  { file: 'captain-america-the-first-avenger.json', from: 'HOWARD', to: 'HOWARD STARK' },
  { file: 'captain-america-the-first-avenger.json', from: 'STARK', to: 'HOWARD STARK' },
  { file: 'captain-america-the-first-avenger.json', from: 'PEGGY', to: 'PEGGY CARTER' },
  { file: 'captain-america-the-first-avenger.json', from: 'PHILLIPS', to: 'COLONEL PHILLIPS' },
  { file: 'captain-america-the-first-avenger.json', from: 'ZOLA', to: 'DR. ZOLA' },
  { file: 'captain-america-the-first-avenger.json', from: 'SCHMIDT', to: 'RED SKULL' },
  { file: 'captain-america-the-first-avenger.json', from: 'ROGERS', to: 'STEVE' },
  { file: 'black-panther.json', from: 'JAMES', to: 'JAMES (ZURI)' },
  { file: 'captain-marvel.json', from: 'STEVE', to: 'STEVE ROGERS' },
  { file: 'captain-marvel.json', from: 'BANNER', to: 'BRUCE BANNER' },
  { file: 'captain-marvel.json', from: 'NATASHA', to: 'NATASHA ROMANOFF' },
  { file: 'captain-marvel.json', from: 'RHODEY', to: 'JAMES RHODES' },
  { file: 'captain-marvel.json', from: 'LAWSON', to: 'WENDY LAWSON' },
  { file: 'captain-marvel.json', from: 'TALOS', to: 'GENERAL TALOS' },
  { file: 'iron-man.json', from: 'HAPPY', to: 'HAPPY HOGAN' },
  { file: 'iron-man.json', from: 'STARK', to: 'TONY STARK' },
  { file: 'back-to-the-future-part-ii.json', from: 'DOC', to: 'DOC BROWN' },
  { file: 'back-to-the-future-part-ii.json', from: 'MARTY', to: 'MARTY MCFLY' },
  { file: 'back-to-the-future-part-iii.json', from: 'MARSHALL', to: 'MARSHALL STRICKLAND' },

  // Merge age variants
  { file: 'captain-marvel.json', from: 'VERS (11-YEARS OLD)', to: 'VERS' },
  { file: 'captain-marvel.json', from: 'VERS (6-YEARS-OLD)', to: 'VERS' },
  { file: 'captain-marvel.json', from: 'CAROL', to: 'VERS' },

  // Fix typos
  { file: 'ratatouille.json', from: 'LINGUNI', to: 'LINGUINI' },
  { file: 'black-panther.json', from: 'T\'CHALLLA', to: 'T\'CHALLA' },
  { file: 'black-panther.json', from: 'YOUNG KILLLMONGER', to: 'YOUNG KILLMONGER' },
  { file: 'iron-man.json', from: 'TONY STARK1', to: 'TONY STARK' },
  { file: 'captain-marvel.json', from: 'COULON', to: 'COULSON' },
  { file: 'back-to-the-future-part-ii.json', from: 'MARTY JR', to: 'MARTY JR.' },
];

// Special case: Delete invalid character from Iron Man
const CHARACTERS_TO_DELETE = [
  { file: 'iron-man.json', character: 'I\'M SORRY. I\'M SORRY.' }
];

function mergeCharacters() {
  console.log('🎬 Starting character merge process...\n');

  // Group merges by file for efficient processing
  const mergesByFile = {};
  CHARACTER_MERGES.forEach(merge => {
    if (!mergesByFile[merge.file]) {
      mergesByFile[merge.file] = [];
    }
    mergesByFile[merge.file].push({ from: merge.from, to: merge.to });
  });

  let totalChanges = 0;
  let filesModified = 0;

  // Process each file
  Object.entries(mergesByFile).forEach(([filename, merges]) => {
    const filePath = resolve(SCRIPT_DIR, filename);
    console.log(`📄 Processing: ${filename}`);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      let fileChanges = 0;

      // Apply character merges
      merges.forEach(({ from, to }) => {
        let changed = false;

        // Update characters array
        if (data.characters) {
          const fromIndex = data.characters.indexOf(from);
          if (fromIndex !== -1) {
            // Remove the "from" character if "to" already exists
            if (data.characters.includes(to)) {
              data.characters.splice(fromIndex, 1);
            } else {
              // Replace "from" with "to"
              data.characters[fromIndex] = to;
            }
            changed = true;
          }
        }

        // Update all dialogue lines
        if (data.lines) {
          data.lines.forEach(line => {
            if (line.character === from) {
              line.character = to;
              changed = true;
            }
          });
        }

        if (changed) {
          console.log(`  ✓ Merged: "${from}" → "${to}"`);
          fileChanges++;
          totalChanges++;
        }
      });

      // Check for characters to delete
      const deleteEntry = CHARACTERS_TO_DELETE.find(d => d.file === filename);
      if (deleteEntry) {
        const charToDelete = deleteEntry.character;

        // Remove from characters array
        if (data.characters) {
          const index = data.characters.indexOf(charToDelete);
          if (index !== -1) {
            data.characters.splice(index, 1);
            console.log(`  ✓ Deleted character: "${charToDelete}"`);
            fileChanges++;
          }
        }

        // Remove all associated dialogue lines
        if (data.lines) {
          const originalLength = data.lines.length;
          data.lines = data.lines.filter(line => line.character !== charToDelete);
          const removed = originalLength - data.lines.length;
          if (removed > 0) {
            console.log(`  ✓ Removed ${removed} dialogue line(s) for "${charToDelete}"`);
            fileChanges++;
          }
        }
      }

      if (fileChanges > 0) {
        // Sort characters alphabetically
        if (data.characters) {
          data.characters.sort();
        }

        // Write back to file with pretty formatting
        writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        filesModified++;
        console.log(`  ✅ Saved with ${fileChanges} change(s)\n`);
      } else {
        console.log(`  ⏭️  No changes needed\n`);
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${filename}:`, error.message);
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Character merge complete!`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Total changes: ${totalChanges}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the merge
mergeCharacters();
