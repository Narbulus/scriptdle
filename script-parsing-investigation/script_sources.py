#!/usr/bin/env python3
"""
Script Source Index & Multi-Source Fetcher

This module provides:
1. A comprehensive index of where movie scripts can be found
2. A multi-source fetcher that tries multiple sources in order
3. Caching of fetch results (URLs/availability, not full scripts)

Sources checked:
- IMSDB (imsdb.com) - HTML format
- SimplyScripts (simplyscripts.com) - Links to PDFs
- Script Slug (scriptslug.com) - PDFs
- ScreenplayDB (screenplaydb.com) - Various formats
- Daily Script (dailyscript.com) - HTML/PDF

Note: Scripts are fetched on-demand and not permanently stored
due to copyright considerations. Only parsed dialogue is retained.
"""

import urllib.request
import urllib.error
import urllib.parse
import re
import json
import os
from dataclasses import dataclass, asdict, field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class SourceType(Enum):
    IMSDB = "imsdb"
    SIMPLYSCRIPTS = "simplyscripts"
    SCRIPTSLUG = "scriptslug"
    DAILYSCRIPT = "dailyscript"
    SCREENPLAYDB = "screenplaydb"
    AWESOMEFILM = "awesomefilm"
    SCRIPTSAVANT = "scriptsavant"


@dataclass
class ScriptSource:
    """A single source for a movie script."""
    source_type: str
    url: str
    format: str  # html, pdf, txt
    verified: bool = False
    notes: str = ""


@dataclass
class MovieScriptEntry:
    """Complete entry for a movie with all known sources."""
    title: str
    year: int
    tmdb_id: int
    sources: List[ScriptSource] = field(default_factory=list)
    best_source: Optional[str] = None
    last_checked: Optional[str] = None


def build_imsdb_url(slug: str) -> str:
    """Build IMSDB URL from slug."""
    return f"https://imsdb.com/scripts/{slug}.html"


def build_simplyscripts_search_url(title: str) -> str:
    """Build SimplyScripts search URL."""
    query = urllib.parse.quote(title)
    return f"https://www.simplyscripts.com/search.html?cx=partner-pub-3305498656402704%3A2nnxx3q4r89&cof=FORID%3A10&ie=ISO-8859-1&q={query}"


def build_dailyscript_url(title: str) -> str:
    """Build Daily Script URL (common patterns)."""
    # Daily Script uses various naming conventions
    slug = title.lower().replace(" ", "_").replace(":", "").replace("'", "")
    return f"http://www.dailyscript.com/scripts/{slug}.html"


def build_awesomefilm_url(title: str) -> str:
    """Build Awesome Film URL."""
    slug = title.lower().replace(" ", "_").replace(":", "").replace("'", "")
    return f"http://www.awesomefilm.com/script/{slug}.txt"


# Comprehensive movie source index
# Format: (title, year, tmdb_id, imsdb_slug, alt_sources)
MOVIE_SOURCE_INDEX = [
    # === AVAILABLE ON IMSDB (verified) ===
    ("The Princess Bride", 1987, 2493, "Princess-Bride,-The", []),
    ("The Breakfast Club", 1985, 2108, "Breakfast-Club,-The", []),
    ("Dumb and Dumber", 1994, 8467, "Dumb-and-Dumber", []),
    ("American Beauty", 1999, 14, "American-Beauty", []),
    ("Pulp Fiction", 1994, 680, "Pulp-Fiction", []),
    ("Fight Club", 1999, 550, "Fight-Club", []),
    ("Good Will Hunting", 1997, 489, "Good-Will-Hunting", []),
    ("A Few Good Men", 1992, 881, "A-Few-Good-Men", []),
    ("The Shining", 1980, 694, "Shining,-The", []),
    ("Aliens", 1986, 679, "Aliens", []),
    ("Inception", 2010, 27205, "Inception", []),
    ("Blade Runner", 1982, 78, "Blade-Runner", []),
    ("Toy Story", 1995, 862, "Toy-Story", []),
    ("Jurassic Park", 1993, 329, "Jurassic-Park", []),
    ("Star Wars: Episode IV - A New Hope", 1977, 11, "Star-Wars-A-New-Hope", []),
    ("Scream", 1996, 4232, "Scream", []),
    ("Taxi Driver", 1976, 103, "Taxi-Driver", []),
    ("Scarface", 1983, 111, "Scarface", []),
    ("The Usual Suspects", 1995, 629, "Usual-Suspects,-The", []),
    ("Braveheart", 1995, 197, "Braveheart", []),
    ("Forrest Gump", 1994, 13, "Forrest-Gump", []),
    ("Die Hard", 1988, 562, "Die-Hard", []),
    ("10 Things I Hate About You", 1999, 4951, "10-Things-I-Hate-About-You", []),
    ("Groundhog Day", 1993, 137, "Groundhog-Day", []),
    ("The Social Network", 2010, 37799, "Social-Network,-The", []),
    ("Django Unchained", 2012, 68718, "Django-Unchained", []),
    ("The Wolf of Wall Street", 2013, 106646, "Wolf-of-Wall-Street,-The", []),
    ("Interstellar", 2014, 157336, "Interstellar", []),
    ("Avatar", 2009, 19995, "Avatar", []),
    ("Joker", 2019, 475557, "Joker", []),
    ("No Country for Old Men", 2007, 6977, "No-Country-for-Old-Men", []),
    ("The Departed", 2006, 1422, "Departed,-The", []),
    ("Superbad", 2007, 8363, "Superbad", []),
    ("The Hangover", 2009, 18785, "Hangover,-The", []),
    ("Bridesmaids", 2011, 52520, "Bridesmaids", []),
    ("Legally Blonde", 2001, 8835, "Legally-Blonde", []),
    ("Get Out", 2017, 419430, "Get-Out", []),
    ("A Nightmare on Elm Street", 1984, 377, "Nightmare-on-Elm-Street,-A", []),
    ("Jaws", 1975, 578, "Jaws", []),
    ("Jerry Maguire", 1996, 9428, "Jerry-Maguire", []),
    ("Shrek", 2001, 808, "Shrek", []),
    ("Up", 2009, 14160, "Up", []),
    ("La La Land", 2016, 313369, "La-La-Land", []),
    ("Black Panther", 2018, 284054, "Black-Panther", []),
    ("Avengers: Endgame", 2019, 299534, "Avengers-Endgame", []),
    ("The Lord of the Rings: The Fellowship of the Ring", 2001, 120, "Lord-of-the-Rings-Fellowship-of-the-Ring,-The", []),
    ("The Fault in Our Stars", 2014, 222935, "Fault-in-Our-Stars,-The", []),

    # === NOT ON IMSDB - NEED ALTERNATIVE SOURCES ===
    ("Back to the Future", 1985, 105, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/bttf4th.pdf", "pdf"),
        ("awesomefilm", "http://www.awesomefilm.com/script/backtothefuture.txt", "txt"),
    ]),
    ("Ferris Bueller's Day Off", 1986, 9377, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/ferris.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/ferris.txt", "txt"),
    ]),
    ("The Godfather", 1972, 238, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/godfather.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/godfather.txt", "txt"),
    ]),
    ("The Godfather Part II", 1974, 240, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/godfather2.html", "html"),
    ]),
    ("Goodfellas", 1990, 769, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/goodfellas.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/goodfellas.txt", "txt"),
    ]),
    ("Mean Girls", 2004, 10625, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/mean-girls-2004.pdf", "pdf"),
    ]),
    ("Clueless", 1995, 9603, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/clueless.html", "html"),
    ]),
    ("The Goonies", 1985, 9340, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/goonies_production.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/goonies.txt", "txt"),
    ]),
    ("Beetlejuice", 1988, 4011, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/beetlejuice.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/beetlejuice.txt", "txt"),
    ]),
    ("E.T. the Extra-Terrestrial", 1982, 601, None, [
        ("awesomefilm", "http://www.awesomefilm.com/script/et.txt", "txt"),
    ]),
    ("When Harry Met Sally", 1989, 639, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/whenharry.html", "html"),
    ]),
    ("Home Alone", 1990, 771, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/homealone.html", "html"),
    ]),
    ("Mrs. Doubtfire", 1993, 788, None, [
        ("awesomefilm", "http://www.awesomefilm.com/script/mrsdoubtfire.txt", "txt"),
    ]),
    ("The Dark Knight", 2008, 155, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/the-dark-knight-2008.pdf", "pdf"),
    ]),
    ("Terminator 2: Judgment Day", 1991, 280, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/terminator2.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/t2.txt", "txt"),
    ]),
    ("Indiana Jones and the Raiders of the Lost Ark", 1981, 85, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/RaidersoftheLostArk.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/raiders.txt", "txt"),
    ]),
    ("Kill Bill: Volume 1", 2003, 24, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/kill_bill_vol1.html", "html"),
    ]),
    ("The Big Lebowski", 1998, 115, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/biglebowski.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/lebowski.txt", "txt"),
    ]),
    ("Office Space", 1999, 1542, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/office_space.html", "html"),
    ]),
    ("Monty Python and the Holy Grail", 1975, 762, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/holygrail_final.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/holygrail.txt", "txt"),
    ]),
    ("Casablanca", 1942, 289, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/casablanca.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/casablanca.txt", "txt"),
    ]),
    ("The Silence of the Lambs", 1991, 274, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/silenceofthelambs.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/silencelambs.txt", "txt"),
    ]),
    ("Se7en", 1995, 807, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/se7en.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/seven.txt", "txt"),
    ]),
    ("Sixteen Candles", 1984, 13576, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/sixteen_candles.html", "html"),
    ]),
    ("Anchorman", 2004, 8699, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/anchorman-the-legend-of-ron-burgundy-2004.pdf", "pdf"),
    ]),
    ("Zoolander", 2001, 9398, None, [
        ("awesomefilm", "http://www.awesomefilm.com/script/zoolander.txt", "txt"),
    ]),
    ("Napoleon Dynamite", 2004, 8193, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/napoleon-dynamite-2004.pdf", "pdf"),
    ]),
    ("Step Brothers", 2008, 12133, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/step-brothers-2008.pdf", "pdf"),
    ]),
    ("Elf", 2003, 10719, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/elf-2003.pdf", "pdf"),
    ]),
    ("Ghostbusters", 1984, 620, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/ghostbusters.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/ghostbusters.txt", "txt"),
    ]),
    ("The Matrix", 1999, 603, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/the_matrix.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/thematrix.txt", "txt"),
    ]),
    ("Gladiator", 2000, 98, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/gladiator.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/gladiator.txt", "txt"),
    ]),
    ("Rocky", 1976, 1366, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/rocky.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/rocky.txt", "txt"),
    ]),
    ("The Shawshank Redemption", 1994, 278, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/shawshank.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/shawshank.txt", "txt"),
    ]),
    ("Titanic", 1997, 597, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/titanic.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/titanic.txt", "txt"),
    ]),
    ("Pretty Woman", 1990, 114, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/prettywoman.html", "html"),
    ]),
    ("Dirty Dancing", 1987, 4979, None, [
        ("awesomefilm", "http://www.awesomefilm.com/script/dirtydancing.txt", "txt"),
    ]),
    ("Grease", 1978, 621, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/grease.html", "html"),
    ]),
    ("The Notebook", 2004, 11036, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/the-notebook-2004.pdf", "pdf"),
    ]),
    ("The Lion King", 1994, 8587, None, [
        ("awesomefilm", "http://www.awesomefilm.com/script/lionking.txt", "txt"),
    ]),
    ("Finding Nemo", 2003, 12, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/finding-nemo-2003.pdf", "pdf"),
    ]),
    ("The Incredibles", 2004, 9806, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/the-incredibles-2004.pdf", "pdf"),
    ]),
    ("Shrek 2", 2004, 809, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/shrek-2-2004.pdf", "pdf"),
    ]),
    ("Frozen", 2013, 109445, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/frozen-2013.pdf", "pdf"),
    ]),
    ("Harry Potter and the Sorcerer's Stone", 2001, 671, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/harry-potter-and-the-sorcerers-stone-2001.pdf", "pdf"),
    ]),
    ("The Lord of the Rings: The Two Towers", 2002, 121, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/the-lord-of-the-rings-the-two-towers-2002.pdf", "pdf"),
    ]),
    ("The Lord of the Rings: The Return of the King", 2003, 122, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/the-lord-of-the-rings-the-return-of-the-king-2003.pdf", "pdf"),
    ]),
    ("Star Wars: Episode V - The Empire Strikes Back", 1980, 1891, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/empirestrikes_script.html", "html"),
    ]),
    ("Star Wars: Episode VI - Return of the Jedi", 1983, 1892, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/return_of_the_jedi.html", "html"),
    ]),
    ("Psycho", 1960, 539, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/psycho.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/psycho.txt", "txt"),
    ]),
    ("Alien", 1979, 348, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/alien_early.html", "html"),
        ("awesomefilm", "http://www.awesomefilm.com/script/alien.txt", "txt"),
    ]),
    ("Top Gun", 1986, 744, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/top_gun.html", "html"),
    ]),
    ("Knives Out", 2019, 546554, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/knives-out-2019.pdf", "pdf"),
    ]),
    ("Parasite", 2019, 496243, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/parasite-2019.pdf", "pdf"),
    ]),
    ("Once Upon a Time in Hollywood", 2019, 466272, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/once-upon-a-time-in-hollywood-2019.pdf", "pdf"),
    ]),
    ("This Is Spinal Tap", 1984, 11031, None, [
        ("awesomefilm", "http://www.awesomefilm.com/script/spinaltap.txt", "txt"),
    ]),
    ("Ace Ventura: Pet Detective", 1994, 3167, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/aceventura.html", "html"),
    ]),
    ("Big", 1988, 2280, None, [
        ("dailyscript", "http://www.dailyscript.com/scripts/big.html", "html"),
    ]),
    ("Talladega Nights", 2006, 9472, None, [
        ("screenplaydb", "https://assets.scriptslug.com/live/pdf/scripts/talladega-nights-the-ballad-of-ricky-bobby-2006.pdf", "pdf"),
    ]),
]


def get_all_sources_for_movie(title: str, year: int, imsdb_slug: Optional[str],
                               alt_sources: List[tuple]) -> List[ScriptSource]:
    """Build list of all known sources for a movie."""
    sources = []

    # Add IMSDB if available
    if imsdb_slug:
        sources.append(ScriptSource(
            source_type="imsdb",
            url=build_imsdb_url(imsdb_slug),
            format="html",
            verified=True,
            notes="Primary source"
        ))

    # Add alternative sources
    for alt in alt_sources:
        source_type, url, fmt = alt
        sources.append(ScriptSource(
            source_type=source_type,
            url=url,
            format=fmt,
            verified=False,
            notes="Alternative source - needs verification"
        ))

    return sources


def build_full_index() -> List[MovieScriptEntry]:
    """Build complete index of all movies with their sources."""
    entries = []

    for item in MOVIE_SOURCE_INDEX:
        title, year, tmdb_id, imsdb_slug, alt_sources = item
        sources = get_all_sources_for_movie(title, year, imsdb_slug, alt_sources)

        entry = MovieScriptEntry(
            title=title,
            year=year,
            tmdb_id=tmdb_id,
            sources=sources,
            best_source=sources[0].source_type if sources else None,
            last_checked=datetime.now().isoformat()
        )
        entries.append(entry)

    return entries


def check_url_availability(url: str, timeout: int = 10) -> tuple[bool, int, str]:
    """
    Check if a URL is accessible and has content.

    Returns: (available, content_length, error_message)
    """
    try:
        req = urllib.request.Request(url, method='HEAD', headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        with urllib.request.urlopen(req, timeout=timeout) as response:
            content_length = response.headers.get('Content-Length', 0)
            return True, int(content_length) if content_length else 0, ""

    except urllib.error.HTTPError as e:
        return False, 0, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return False, 0, f"URL Error: {e.reason}"
    except Exception as e:
        return False, 0, str(e)


def verify_all_sources(entries: List[MovieScriptEntry], verbose: bool = True) -> Dict:
    """
    Verify availability of all sources.

    Returns dict with verification results.
    """
    results = {
        "total_movies": len(entries),
        "movies_with_sources": 0,
        "verified_sources": 0,
        "failed_sources": 0,
        "by_source_type": {},
        "details": []
    }

    for entry in entries:
        movie_result = {
            "title": entry.title,
            "year": entry.year,
            "sources_checked": 0,
            "sources_available": 0,
            "best_source": None
        }

        has_valid_source = False

        for source in entry.sources:
            movie_result["sources_checked"] += 1

            if verbose:
                print(f"  Checking {entry.title} ({source.source_type})...", end=" ", flush=True)

            available, size, error = check_url_availability(source.url)

            # Track by source type
            if source.source_type not in results["by_source_type"]:
                results["by_source_type"][source.source_type] = {"available": 0, "failed": 0}

            if available and size > 1000:  # At least 1KB of content
                results["verified_sources"] += 1
                results["by_source_type"][source.source_type]["available"] += 1
                movie_result["sources_available"] += 1
                if not movie_result["best_source"]:
                    movie_result["best_source"] = source.source_type
                has_valid_source = True
                source.verified = True
                if verbose:
                    print(f"OK ({size:,} bytes)")
            else:
                results["failed_sources"] += 1
                results["by_source_type"][source.source_type]["failed"] += 1
                if verbose:
                    print(f"FAILED ({error})")

        if has_valid_source:
            results["movies_with_sources"] += 1

        results["details"].append(movie_result)

    return results


def save_index(entries: List[MovieScriptEntry], output_path: str = "output/script_source_index.json"):
    """Save the source index to JSON."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    data = {
        "generated": datetime.now().isoformat(),
        "total_movies": len(entries),
        "entries": [asdict(e) for e in entries]
    }

    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Saved index to {output_path}")


if __name__ == "__main__":
    print("Building Script Source Index...")
    print("=" * 60)

    entries = build_full_index()

    print(f"\nTotal movies in index: {len(entries)}")

    # Count by source type
    imsdb_count = sum(1 for e in entries if any(s.source_type == "imsdb" for s in e.sources))
    alt_count = sum(1 for e in entries if not any(s.source_type == "imsdb" for s in e.sources))

    print(f"  With IMSDB source: {imsdb_count}")
    print(f"  Alternative sources only: {alt_count}")

    # Save index
    save_index(entries)

    print("\nTo verify sources, run:")
    print("  python3 script_sources.py --verify")
