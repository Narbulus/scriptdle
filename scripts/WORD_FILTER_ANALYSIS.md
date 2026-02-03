# 5-Word Minimum Filter: Impact Analysis

## Executive Summary

The 5-word minimum filter makes the game easier by filtering out very short quotes. Analysis shows:

✅ **Retains 60-68% of puzzles** across all packs (1,394 to 5,728 eligible lines per pack)
✅ **All packs have 1,000+ years of unique puzzles** before repeating
✅ **Main characters well-represented** (top 10 characters retain 50-80% of their lines)
⚠️ **5 minor characters lose all lines** (mostly single-word speakers like Groot, Cri-Kee)
⚠️ **39 minor characters severely reduced** (>70% reduction, mostly background characters)

**Recommendation**: ✅ Safe to deploy with 5-word minimum

---

## Puzzle Pool Impact by Pack

| Pack | No Filter | 5-Word Min | % Retained | Years Until Repeat |
|------|-----------|------------|------------|-------------------|
| Marvel | 8,889 | 5,728 | 64.4% | **15.7 years** |
| Harry Potter | 6,708 | 4,279 | 63.8% | **11.7 years** |
| Pixar Classics | 6,625 | 3,947 | 59.6% | **10.8 years** |
| Disney Classics | 6,322 | 3,986 | 63.0% | **10.9 years** |
| Star Wars | 5,850 | 3,538 | 60.5% | **9.7 years** |
| Disney Pixar | 5,078 | 3,164 | 62.3% | **8.7 years** |
| Lord of the Rings | 3,000 | 2,031 | 67.7% | **5.6 years** |
| Shrek | 3,005 | 1,910 | 63.6% | **5.2 years** |
| Back to the Future | 2,114 | 1,394 | 65.9% | **3.8 years** |

**All packs have ample variety** - smallest pack (BTTF) still has 3.8 years of unique puzzles.

---

## Quote Length Distribution

With 5-word minimum, quotes average:

- **Star Wars**: 11.2 words/quote (was 7.8)
- **Marvel**: 13.6 words/quote (was 9.7)
- **Harry Potter**: 14.6 words/quote (was 10.2)
- **BTTF**: 15.9 words/quote (was 11.3)
- **LOTR**: 13.4 words/quote (was 9.9)

**Impact**: Quotes are **40-50% longer** on average, making them significantly easier to guess.

---

## Character Representation Impact

### Characters That Lost ALL Lines (5 total)

| Character | Pack | Original Lines | Notes |
|-----------|------|----------------|-------|
| Groot | Marvel | 16 | Only says "I am Groot" (3 words) |
| Cri-Kee | Disney Classics | 5 | Cricket sounds/short reactions |
| Pete Docter | Pixar Classics | 7 | Cameo character |
| ALL (ensemble) | Pixar Classics | 12 | Group responses |
| MAN 4 | Disney Classics | 8 | Background character |

**Impact**: All lost characters are minor/background. No main characters affected.

### Severely Reduced Characters (39 total, >70% line reduction)

Most are:
- **Background characters** (MAN 1, GUARD, SOLDIER)
- **Single-word speakers** (EVE from WALL-E: "Eve?" repeated)
- **Animal/sound characters** (ABU, HYENAS)
- **Minor comic relief** (Flash Slothmore, Butter Pants)

**Impact**: Minor characters lose representation, but this may actually be desirable - main characters become more prominent.

### Top Characters (Well Protected)

Main protagonists retain 50-80% of their lines:

| Character | Pack | Lines Retained |
|-----------|------|----------------|
| Harry Potter | HP | 1,050 lines (55%) |
| Hermione | HP | 530 lines (63%) |
| Ron Weasley | HP | 511 lines (59%) |
| Shrek | Shrek | 525 lines (58%) |
| Donkey | Shrek | 404 lines (72%) |
| Tony Stark | Marvel | 391 lines (66%) |
| Gandalf | LOTR | 286 lines (75%) |
| Anakin | Star Wars | 300 lines (66%) |
| Mike Wazowski | Pixar | 261 lines (72%) |

**Impact**: All main characters well-represented with hundreds of eligible lines.

---

## Comparison: Different Word Minimums

| Min Words | Avg % Retained | Avg Quote Length | Notes |
|-----------|----------------|------------------|-------|
| 0 (none) | 100% | 9.2 words | Current baseline |
| 3 | 81% | 11.3 words | Gentle filter |
| **5** | **63%** | **13.5 words** | **Recommended** |
| 7 | 48% | 16.0 words | Moderate filter |
| 10 | 33% | 20.0 words | Aggressive filter |

**Recommendation**: 5 words is the sweet spot
- Removes very short quotes (1-4 words) that are too hard
- Keeps variety (60-68% of puzzles)
- Makes quotes 40-50% longer
- All packs have 3-15 years of unique puzzles

---

## Notable Character Changes

### Positive Changes
- **Main characters more prominent**: Harry, Shrek, Tony Stark get higher representation
- **Better quote quality**: Longer lines tend to have more context and personality

### Notable Losses
- **Groot (Marvel)**: Lost all lines (only says 3-word phrases)
- **EVE (Pixar)**: 76 → 6 lines (says "Eve?" a lot)
- **Flash Slothmore (Zootopia)**: 27 → 3 lines (slow speech = short lines)
- **Abu (Aladdin)**: 27 → 2 lines (mostly sounds)

### Workaround for Special Cases
If you want to preserve characters like Groot:
1. Lower minimum to 3 words (retains 81% of puzzles)
2. Or add special handling for specific iconic short quotes

---

## Recommendations

### ✅ Deploy with 5-word minimum
- Significant difficulty reduction (40-50% longer quotes)
- All packs retain excellent variety (3-15 years of puzzles)
- Main characters well-represented
- Only minor/background characters affected

### Alternative: 3-word minimum
- More conservative approach
- Retains 81% of puzzles
- Preserves Groot, EVE, and other short speakers
- Still removes 1-2 word quotes that are hardest

### Future Adjustments
If game is still too hard after 5-word minimum:
- Increase to 7 words (48% retention, 16 avg words)
- Add hint system
- Show first letter of movie title

If game becomes too easy:
- Decrease to 3 words
- Add "hard mode" option
