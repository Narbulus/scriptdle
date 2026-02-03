# Puzzle Generation Deployment Guide

## Minimum Word Length Feature

### What Changed
Added a `--min-words` parameter (default: 5) to filter out very short quotes, making the game easier.

### How It Works
- Filters target quotes to only include lines with at least N words
- Default is 5 words minimum
- Uses simple `text.split()` word counting (punctuation counted as part of words)

### Backward Compatibility Strategy

**IMPORTANT**: Regenerating puzzles will change quotes for all users on those dates.

#### Safe Deployment (Recommended)
Only regenerate **future dates** to avoid disrupting active players:

```bash
# Generate only for tomorrow and beyond (adjust --days as needed)
python3 scripts/generate-daily-puzzles.py --days 365 --min-words 5
```

This works because:
1. The script generates from `today - 1 day` by default
2. Existing players on today's puzzle continue with their current quote
3. New players tomorrow get the easier, longer quotes

#### Full Regeneration (Use with caution)
To regenerate all dates including today (will affect active players):

```bash
# This will change today's puzzle for everyone
python3 scripts/generate-daily-puzzles.py --days 365 --min-words 5
```

**Impact**:
- Anyone mid-game today will have their puzzle changed
- May cause confusion if they refresh
- Only do this during low-traffic times (early morning UTC)

### Testing Individual Packs

```bash
# Test on a single pack
python3 scripts/generate-daily-puzzles.py --pack star-wars --days 7 --min-words 5

# Try different minimums
python3 scripts/generate-daily-puzzles.py --pack harry-potter --days 7 --min-words 3
python3 scripts/generate-daily-puzzles.py --pack marvel --days 7 --min-words 7
```

### Deployment Steps

1. **Commit the code changes**
   ```bash
   git add scripts/generate-daily-puzzles.py
   git commit -m "feat: add minimum word length filter for puzzle generation"
   ```

2. **Regenerate puzzles** (choose safe or full method above)
   ```bash
   python3 scripts/generate-daily-puzzles.py --days 365 --min-words 5
   ```

3. **Commit the generated puzzle files**
   ```bash
   git add public/data/daily/ public/data/daily-all/
   git commit -m "chore: regenerate puzzles with 5-word minimum"
   ```

4. **Deploy to production**
   ```bash
   git push
   ```

### Statistics Example
```
Star Wars Pack:
- Total lines: 6267
- Minimum words per quote: 5
- Significant character lines (meeting criteria): 3538
- Movies: 6
```

The filter typically keeps 50-70% of lines depending on the pack's dialogue style.

### Adjusting Difficulty

To make the game easier or harder in the future:

```bash
# Easier (shorter quotes)
python3 scripts/generate-daily-puzzles.py --min-words 3

# Current default
python3 scripts/generate-daily-puzzles.py --min-words 5

# Harder (longer quotes)
python3 scripts/generate-daily-puzzles.py --min-words 8
```

### Notes
- The puzzle selection uses deterministic RNG based on date + pack ID
- Same min-words value will always generate the same puzzle for a given date
- Changing min-words changes which lines are eligible, so puzzles will differ
