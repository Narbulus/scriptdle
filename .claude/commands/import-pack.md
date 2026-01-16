# Import Movie Pack from Script Parser

Import a movie pack from the script-parser repo with full metadata enrichment.

## Arguments

`$ARGUMENTS` - Pack ID and optional movie IDs

Format: `<pack_id> [movie_id1 movie_id2 ...]`

If no movie IDs provided, will auto-detect from script-parser/data/.

## Instructions

### Step 1: Parse Arguments & Validate

Extract pack_id and movie_ids from `$ARGUMENTS`.
- If empty, ask user what pack to import
- Verify source files exist in `../script-parser/data/`

### Step 2: Run Import Script

Run the automated import script:

```bash
python scripts/import-pack.py [--name "Pack Display Name"] <pack_id> [movie_ids...]
```

This script automatically:
- Copies scripts from script-parser to public/data/scripts/
- Fetches OMDB metadata (IMDb IDs, posters, etc.)
- Analyzes speaking roles to identify top cast
- Determines the appropriate category
- Updates index.json
- Creates pack skeleton with placeholder theme/messages
- Regenerates puzzles

### Step 3: Generate Theme Colors

The pack file at `public/data/packs/<pack_id>.json` has placeholder theme colors.
Generate themed colors that evoke the movie/pack's aesthetic.

**Required theme properties:**
- `primary`: Main accent color (buttons, highlights)
- `bgColor`: Page background
- `containerBg`: Card/container backgrounds
- `accentColor`: Secondary accent
- `btnText`: Button text color ("white" or "black")
- `cardGradientStart`: Card gradient start
- `cardGradientEnd`: Card gradient end
- `cardBorder`: Card border color
- `cardText`: Text on cards

**Requirements:**
- WCAG AA contrast minimum (4.5:1 for text)
- Colors should evoke the movie's aesthetic/mood
- cardText must be readable on cardGradientStart/End
- btnText must be readable on primary

**Reference examples:**

Harry Potter (dark magical):
```json
"theme": {
  "primary": "#d4af37",
  "bgColor": "#2a0000",
  "containerBg": "#fff5e6",
  "accentColor": "#740001",
  "btnText": "white",
  "cardGradientStart": "#2a0000",
  "cardGradientEnd": "#740001",
  "cardBorder": "#d4af37",
  "cardText": "#ffd54f"
}
```

Shrek (earthy, swamp):
```json
"theme": {
  "primary": "#7cb342",
  "bgColor": "#5d4037",
  "containerBg": "#faf5e9",
  "accentColor": "#558b2f",
  "btnText": "white",
  "cardGradientStart": "#5d4037",
  "cardGradientEnd": "#6d4c41",
  "cardBorder": "#7cb342",
  "cardText": "#c5e1a5"
}
```

### Step 4: Generate Tier Messages

Generate five themed messages for game completion feedback:

- `perfect`: First try (enthusiastic, celebratory)
- `good`: 2-3 tries (positive, encouraging)
- `average`: 4-5 tries (neutral, acknowledging)
- `barely`: 6 tries (barely made it)
- `failure`: Failed all tries (commiserative/humorous)

Messages should be memorable quotes or themed phrases from the movies.

**Reference examples:**

Harry Potter:
```json
"tierMessages": {
  "perfect": "Outstanding! First try!",
  "good": "Excellent work, wizard!",
  "average": "Exceeds Expectations",
  "barely": "Acceptable",
  "failure": "Troll..."
}
```

Shrek:
```json
"tierMessages": {
  "perfect": "Ogres have layers!",
  "good": "That'll do, Donkey!",
  "average": "Not bad for an ogre",
  "barely": "Better out than in",
  "failure": "Get out of my swamp!"
}
```

### Step 5: Update Pack File

Edit `public/data/packs/<pack_id>.json`:
1. Remove the `_comment` fields from theme and tierMessages
2. Replace placeholder theme with generated colors
3. Replace placeholder tierMessages with generated messages

### Step 6: Report Results

Show the user:
- Movies imported with IMDb IDs
- Top speaking cast identified for each movie
- Theme colors generated
- Tier messages generated
- Category assigned
- Puzzle count generated

Ask if they want to test by running `npm run dev`.

## Example Usage

```
/import-pack frozen
# Auto-detects frozen.json and frozen-2.json

/import-pack frozen frozen frozen-2
# Explicit movie list

/import-pack --name "The Incredibles" incredibles incredibles-1 incredibles-2
# With custom display name
```

## Notes

- OMDB API key is in `.env` (OMDB_API_KEY)
- Script-parser repo should be at `../script-parser`
- All paths are relative to scriptdle repo root
