import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Update topSpeakingCast arrays based on current character names in dialogue lines
 */

const SCRIPT_DIR = resolve(process.cwd(), 'public/data/scripts');
const THRESHOLD = 0.85; // Include characters that account for 85% of dialogue

function analyzeTopSpeakingCast(lines) {
  if (!lines || lines.length === 0) {
    return [];
  }

  // Count lines per character
  const lineCounts = {};
  lines.forEach(line => {
    const char = line.character;
    lineCounts[char] = (lineCounts[char] || 0) + 1;
  });

  // Sort by line count descending
  const sortedChars = Object.entries(lineCounts)
    .sort((a, b) => {
      // Sort by count desc, then name asc for ties
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

  // Find characters that account for 85% of dialogue
  const totalLines = lines.length;
  let cumulative = 0;
  const topCast = [];

  for (const [char, count] of sortedChars) {
    topCast.push(char);
    cumulative += count;

    if (cumulative / totalLines >= THRESHOLD) {
      break;
    }
  }

  return topCast;
}

function updateTopSpeakingCast() {
  console.log('🎬 Updating topSpeakingCast arrays based on current character names...\n');

  const files = readdirSync(SCRIPT_DIR).filter(f => f.endsWith('.json'));
  let filesUpdated = 0;
  let totalChanges = 0;

  for (const filename of files) {
    const filePath = join(SCRIPT_DIR, filename);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.lines || data.lines.length === 0) {
        console.log(`⏭️  ${filename}: No dialogue lines`);
        continue;
      }

      // Generate new topSpeakingCast based on actual dialogue
      const oldTopCast = data.topSpeakingCast || [];
      const newTopCast = analyzeTopSpeakingCast(data.lines);

      // Check if it changed
      const changed = JSON.stringify(oldTopCast) !== JSON.stringify(newTopCast);

      if (changed) {
        data.topSpeakingCast = newTopCast;

        // Write back with pretty formatting
        writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

        const addedChars = newTopCast.filter(c => !oldTopCast.includes(c));
        const removedChars = oldTopCast.filter(c => !newTopCast.includes(c));

        console.log(`✅ ${filename}`);
        console.log(`   Size: ${oldTopCast.length} → ${newTopCast.length}`);
        if (addedChars.length > 0) {
          console.log(`   Added: ${addedChars.join(', ')}`);
        }
        if (removedChars.length > 0) {
          console.log(`   Removed: ${removedChars.join(', ')}`);
        }
        console.log();

        filesUpdated++;
        totalChanges++;
      } else {
        console.log(`⏭️  ${filename}: No changes needed`);
      }

    } catch (error) {
      console.error(`❌ Error processing ${filename}:`, error.message);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ topSpeakingCast update complete!`);
  console.log(`   Files updated: ${filesUpdated}/${files.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the update
updateTopSpeakingCast();
