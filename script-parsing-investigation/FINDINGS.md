# Script Parsing Investigation - Comprehensive Findings

## Executive Summary

Tested **106 popular/quotable movies** against IMSDB for script availability and parsing quality.

### Key Results
- **65 scripts available** (61% availability)
- **2 excellent quality**, 37 fair, 21 poor
- **41 scripts unavailable** on IMSDB - need alternative sources
- **Major parsing issues** with title cards, credits, and format variations

### Critical Insight
Many scripts marked "fair" or "poor" have good dialogue content but need:
1. Title/credit cruft removal
2. Character name filtering via TMDB
3. Optional LLM validation for cleanest results

---

## 1. Full Assessment Results (106 Movies)

### Availability by Category

| Category | Available | Unavailable | Notes |
|----------|-----------|-------------|-------|
| Classic Comedies | 10 | 10 | Many 80s classics missing |
| Action/Adventure | 7 | 4 | Good availability |
| Star Wars | 1* | 2 | Only Episode IV has full script |
| Drama/Thriller | 14 | 3 | Best category |
| Sci-Fi/Fantasy | 8 | 5 | Mixed availability |
| Animated | 4 | 4 | Many Disney missing |
| Horror | 6 | 0 | Excellent availability |
| Romance | 3 | 4 | Mixed |
| Recent (2010s+) | 12 | 5 | Good modern coverage |

### Quality Distribution

```
Excellent (2):   ██ 2%
Good (0):
Fair (37):       █████████████████████████████████████ 35%
Poor (21):       █████████████████████ 20%
Unavailable (41):████████████████████████████████████████ 39%
Unknown (5):     █████ 5%
```

### Excellent Quality Scripts (Ready for Game)

| Movie | Year | Lines | Characters | Top Characters |
|-------|------|-------|------------|----------------|
| Dumb and Dumber | 1994 | 908 | 47 | LLOYD, HARRY, MARY |
| American Beauty | 1999 | 757 | 23 | LESTER, RICKY, JANE |

### High-Volume Fair Quality (Need Cleanup)

These scripts have lots of dialogue but need title cruft removed:

| Movie | Year | Lines | Main Chars | Issue |
|-------|------|-------|------------|-------|
| Fight Club | 1999 | 1,819 | 6 | Title card cruft |
| A Few Good Men | 1992 | 1,815 | 13 | Clean |
| Pulp Fiction | 1994 | 1,707 | 17 | Dictionary definition |
| 10 Things I Hate About You | 1999 | 1,566 | 10 | Clean |
| Star Wars: A New Hope | 1977 | 1,354 | 11 | Lucasfilm credit |
| The Princess Bride | 1987 | 740 | 11 | Clean |

### Scripts with Wrong Content

**WARNING:** Some IMSDB entries are for different films with the same name:

| Expected Movie | IMSDB Content | Issue |
|----------------|---------------|-------|
| Frozen (2013, Disney) | Frozen (2010, thriller) | Different movie |
| The Hangover (2009) | Shows "VICK" not "PHIL" | Possibly draft/different version |

### Partial/Stub Scripts (Only Credits)

These have IMSDB pages but only title/credit info:

| Movie | Lines | Notes |
|-------|-------|-------|
| The Matrix | 3 | Title only |
| Gladiator | 3 | Title only |
| The Shawshank Redemption | 3 | Title only |
| Ghostbusters | 3 | "Real Ghostbusters" cartoon |
| Empire Strikes Back | 5 | Title card only |
| Rocky | 2 | Title only |

---

## 2. Unavailable Scripts (Need Alternative Sources)

### Must-Have Movies Without IMSDB Scripts

**80s Classics:**
- Back to the Future (1985)
- Ferris Bueller's Day Off (1986)
- The Goonies (1985)
- Beetlejuice (1988)
- E.T. the Extra-Terrestrial (1982)

**Popular Comedies:**
- Mean Girls (2004)
- Clueless (1995)
- Anchorman (2004)
- Elf (2003)
- Step Brothers (2008)
- Napoleon Dynamite (2004)

**Classics:**
- The Godfather (1972, 1974)
- Goodfellas (1990)
- Casablanca (1942)
- When Harry Met Sally (1989)

**Animation:**
- The Lion King (1994)
- The Incredibles (2004)
- Shrek 2 (2004)

**Action:**
- The Dark Knight (2008)
- Terminator 2 (1991)
- Kill Bill (2003)
- Indiana Jones (1981)

### Alternative Sources to Try

| Source | Format | Pros | Cons |
|--------|--------|------|------|
| SimplyScripts | PDF | Large collection | Need PDF parser |
| Script Slug | PDF | Award scripts | Limited catalog |
| ScriptPDF | PDF | Clean PDFs | Smaller collection |
| SFY.ru | Various | International | Quality varies |
| Transcripts sites | Text | Actual dialogue | May differ from script |

---

## 3. Parsing Quality Analysis

### Why "Poor" Quality Doesn't Mean Bad Dialogue

Many scripts rated "poor" actually have excellent dialogue but fail quality checks due to:

1. **Title cruft** in first 10 lines (captured as character dialogue)
2. **High character count** (includes extras like "MAN 1")
3. **Format variations** (unusual indentation or structure)

**Example - Good Will Hunting (rated "poor"):**
- 1,522 dialogue lines
- Top characters: WILL, SEAN, LAMBEAU, CHUCKIE, SKYLAR
- Issue: Camera directions parsed as dialogue

**Fix:** Filter with TMDB character list, remove first 10 lines if they contain title words.

### Common Parsing Issues

| Issue | Frequency | Solution |
|-------|-----------|----------|
| Title cards as dialogue | ~40% | Skip first 10-20 lines or filter by title words |
| Credits parsed as character | ~25% | Filter names containing "BY", "WRITTEN", etc. |
| Camera directions | ~15% | LLM validation |
| Too many characters | ~60% | TMDB filtering (top 15-20) |

### Parsing Success Rate by Era

| Era | Scripts | Avg Quality | Notes |
|-----|---------|-------------|-------|
| 1970s | 5 | Fair | Varies by format |
| 1980s | 12 | Fair | Many classics missing |
| 1990s | 20 | Fair-Good | Best formatted |
| 2000s | 15 | Fair | Good availability |
| 2010s+ | 13 | Fair-Poor | More format variation |

---

## 4. Recommended Workflow

### For High-Quality Scripts

```python
# Scripts that need minimal processing
READY_TO_USE = [
    "Dumb and Dumber",
    "American Beauty",
    "The Breakfast Club",
    "The Princess Bride",
    "Inception",
    "Aliens",
    "Toy Story",
    "Scream",
]
```

### For Fair-Quality Scripts (Need Cleanup)

```python
def process_fair_quality(dialogues, title, tmdb_characters):
    # 1. Remove title cruft from start
    clean = [d for d in dialogues if not is_title_cruft(d, title)]

    # 2. Filter to TMDB characters only
    filtered = [d for d in clean if d.character in tmdb_characters]

    # 3. Normalize character names
    normalized = normalize_names(filtered, tmdb_characters)

    return normalized
```

### For Poor-Quality Scripts (Need LLM)

Use the LLM extraction prompts in `llm_parser.py` to:
1. Chunk the raw script text
2. Extract only spoken dialogue
3. Filter narrative descriptions
4. Normalize character names

---

## 5. Implementation Recommendations

### Phase 1: Quick Wins (20 scripts)

Use the excellent/good quality scripts immediately:

```python
PHASE_1_SCRIPTS = [
    # Excellent
    ("Dumb and Dumber", "dumb-and-dumber", 1994),
    ("American Beauty", "american-beauty", 1999),

    # Clean Fair-Quality
    ("The Princess Bride", "princess-bride", 1987),
    ("The Breakfast Club", "breakfast-club", 1985),
    ("A Few Good Men", "a-few-good-men", 1992),
    ("Inception", "inception", 2010),
    ("Aliens", "aliens", 1986),
    ("The Shining", "the-shining", 1980),
    ("Toy Story", "toy-story", 1995),
    ("Jurassic Park", "jurassic-park", 1993),
    # ... etc
]
```

### Phase 2: Cleanup (30 scripts)

Apply automated cleanup to fair-quality scripts:
- Title cruft removal
- TMDB character filtering
- Character name normalization

### Phase 3: LLM Processing (15 scripts)

For scripts with significant issues:
- Use Claude to extract clean dialogue
- Cost: ~$0.10-0.50 per script
- Time: ~1-2 minutes per script

### Phase 4: Alternative Sources (40 scripts)

Build PDF parsing capability for:
- SimplyScripts downloads
- Other sources

---

## 6. Technical Files Created

```
script-parsing-investigation/
├── FINDINGS.md                    # This document
├── movie_catalog.py               # 106 movie definitions
├── script_availability_checker.py # Assessment runner
├── improved_parser.py             # HTML screenplay parser
├── llm_parser.py                  # LLM prompt templates
├── tmdb_character_resolver.py     # TMDB API integration
├── fetch_script.py                # Basic IMSDB fetcher
├── demo_workflow.py               # Full pipeline demo
└── output/
    ├── ASSESSMENT_REPORT.md       # Full assessment report
    ├── assessment_results.json    # Raw assessment data
    └── *.json                     # Individual parsed scripts
```

---

## 7. Next Steps

1. **Get TMDB API key** for character filtering
2. **Process Phase 1 scripts** (20 ready-to-use)
3. **Build PDF parser** for SimplyScripts
4. **Create cleanup pipeline** for fair-quality scripts
5. **Test LLM approach** on 2-3 difficult scripts

---

## 8. Full Script Availability List

### Available on IMSDB (65 scripts)

| Movie | Year | Lines | Quality |
|-------|------|-------|---------|
| 10 Things I Hate About You | 1999 | 1,566 | Fair |
| A Few Good Men | 1992 | 1,815 | Fair |
| A Nightmare on Elm Street | 1984 | 1,117 | Fair |
| Alien | 1979 | 14 | Stub |
| Aliens | 1986 | 1,131 | Fair |
| American Beauty | 1999 | 757 | Excellent |
| Avatar | 2009 | 1,741 | Poor |
| Avengers: Endgame | 2019 | 1,194 | Fair |
| Black Panther | 2018 | 1,089 | Poor |
| Blade Runner | 1982 | 1,193 | Fair |
| Braveheart | 1995 | 1,246 | Fair |
| Bridesmaids | 2011 | 1,403 | Poor |
| Die Hard | 1988 | 1,302 | Poor |
| Django Unchained | 2012 | 1,276 | Poor |
| Dumb and Dumber | 1994 | 908 | Excellent |
| Fight Club | 1999 | 1,819 | Fair |
| Forrest Gump | 1994 | 1,531 | Poor |
| Frozen (2010 thriller) | 2010 | 1,027 | Poor* |
| Get Out | 2017 | 1,173 | Poor |
| Ghostbusters | 1984 | 3 | Stub |
| Gladiator | 2000 | 3 | Stub |
| Good Will Hunting | 1997 | 1,522 | Poor |
| Groundhog Day | 1993 | 1,069 | Poor |
| Inception | 2010 | 1,209 | Fair |
| Interstellar | 2014 | 1,736 | Poor |
| Jaws | 1975 | 1,308 | Poor |
| Jerry Maguire | 1996 | 1,404 | Poor |
| Joker | 2019 | 1,081 | Fair |
| Jurassic Park | 1993 | 782 | Fair |
| La La Land | 2016 | 1,139 | Poor |
| Legally Blonde | 2001 | 1,335 | Poor |
| LOTR: Fellowship | 2001 | 811 | Fair |
| No Country for Old Men | 2007 | 975 | Fair |
| Office Space | 1999 | 2 | Stub |
| Pretty Woman | 1990 | 63 | Stub |
| Psycho | 1960 | 4 | Stub |
| Pulp Fiction | 1994 | 1,707 | Fair |
| Rocky | 1976 | 2 | Stub |
| Scarface | 1983 | 1,460 | Fair |
| Scream | 1996 | 970 | Fair |
| Shrek | 2001 | 861 | Fair |
| Star Wars: A New Hope | 1977 | 1,354 | Fair |
| Star Wars: Empire Strikes Back | 1980 | 5 | Stub |
| Superbad | 2007 | 1,376 | Poor |
| Taxi Driver | 1976 | 719 | Fair |
| The Breakfast Club | 1985 | 1,089 | Fair |
| The Departed | 2006 | 1,578 | Poor |
| The Fault in Our Stars | 2014 | 1,297 | Poor |
| The Hangover | 2009 | 1,066 | Poor |
| The Matrix | 1999 | 3 | Stub |
| The Princess Bride | 1987 | 740 | Fair |
| The Shawshank Redemption | 1994 | 3 | Stub |
| The Shining | 1980 | 915 | Fair |
| The Social Network | 2010 | 1,750 | Poor |
| The Usual Suspects | 1995 | 1,236 | Fair |
| The Wolf of Wall Street | 2013 | 1,605 | Poor |
| Titanic | 1997 | 2 | Stub |
| Top Gun | 1986 | 5 | Stub |
| Toy Story | 1995 | 877 | Fair |
| Up | 2009 | 1,094 | Fair |

*Note: IMSDB's "Frozen" is the 2010 thriller, not Disney's 2013 film

### Not Available on IMSDB (41 scripts)

- Anchorman (2004)
- Back to the Future (1985)
- Beetlejuice (1988)
- Casablanca (1942)
- Clueless (1995)
- Dirty Dancing (1987)
- E.T. (1982)
- Elf (2003)
- Ferris Bueller's Day Off (1986)
- Finding Nemo (2003)
- Goodfellas (1990)
- Grease (1978)
- Harry Potter (2001)
- Home Alone (1990)
- Indiana Jones (1981)
- Kill Bill (2003)
- Knives Out (2019)
- Mean Girls (2004)
- Monty Python (1975)
- Mrs. Doubtfire (1993)
- Napoleon Dynamite (2004)
- Once Upon a Time in Hollywood (2019)
- Parasite (2019)
- Return of the Jedi (1983)
- Se7en (1995)
- Shrek 2 (2004)
- Silence of the Lambs (1991)
- Sixteen Candles (1984)
- Step Brothers (2008)
- Talladega Nights (2006)
- Terminator 2 (1991)
- The Big Lebowski (1998)
- The Dark Knight (2008)
- The Godfather (1972)
- The Godfather Part II (1974)
- The Goonies (1985)
- The Incredibles (2004)
- The Lion King (1994)
- LOTR: Two Towers (2002)
- LOTR: Return of the King (2003)
- The Notebook (2004)
- This Is Spinal Tap (1984)
- When Harry Met Sally (1989)
- Zoolander (2001)
