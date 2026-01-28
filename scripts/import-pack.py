#!/usr/bin/env python3
"""
Import Movie Pack from Script Parser

This script automates importing movie packs from the script-parser repo,
enriching them with OMDB metadata and analyzing speaking roles.

The theme colors and tier messages require Claude Code interaction,
so this script handles everything except those LLM-dependent parts.

Usage:
    python scripts/import-pack.py <pack_id> [movie_id1 movie_id2 ...]

    # Auto-detect movies matching pack name
    python scripts/import-pack.py frozen

    # Explicit movie list
    python scripts/import-pack.py frozen frozen frozen-2
"""

import json
import argparse
import shutil
import urllib.request
import urllib.parse
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter


def get_repo_root() -> Path:
    """Get the scriptdle repository root directory."""
    return Path(__file__).parent.parent


def get_script_parser_path() -> Path:
    """Get the script-parser repository path (sibling directory)."""
    return get_repo_root().parent / "script-parser"


def load_env() -> Dict[str, str]:
    """Load environment variables from .env file."""
    env_file = get_repo_root() / ".env"
    env_vars = {}
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars


def load_json(file_path: Path) -> Dict[Any, Any]:
    """Load JSON from a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Dict[Any, Any], file_path: Path) -> None:
    """Save JSON to a file with pretty formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def find_matching_movies(pack_id: str, source_dir: Path) -> List[str]:
    """Find movie JSON files matching the pack ID pattern."""
    movies = []

    # Look for exact match first
    exact_match = source_dir / f"{pack_id}.json"
    if exact_match.exists():
        movies.append(pack_id)

    # Look for numbered sequels (pack-id-2, pack-id-3, etc.)
    for json_file in sorted(source_dir.glob(f"{pack_id}-*.json")):
        movie_id = json_file.stem
        if movie_id not in movies:
            movies.append(movie_id)

    # Also check for pack-id without number and numbered variants
    base_pattern = pack_id.rstrip('s')  # Handle plural (e.g., "incredibles" -> "incredible")
    for json_file in sorted(source_dir.glob(f"{base_pattern}*.json")):
        movie_id = json_file.stem
        if movie_id not in movies and json_file.exists():
            movies.append(movie_id)

    return sorted(set(movies))


def fetch_omdb_metadata(title: str, year: Optional[int], api_key: str) -> Optional[Dict[str, Any]]:
    """Fetch movie metadata from OMDB API."""
    base_url = "http://www.omdbapi.com/"
    params = {
        "t": title,
        "apikey": api_key,
        "type": "movie"
    }
    if year:
        params["y"] = str(year)

    url = f"{base_url}?{urllib.parse.urlencode(params)}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            if data.get("Response") == "True":
                return data
            else:
                print(f"  OMDB: No results for '{title}' ({year}): {data.get('Error', 'Unknown error')}")
                return None
    except Exception as e:
        print(f"  OMDB Error for '{title}': {e}")
        return None


def analyze_speaking_cast(lines: List[Dict[str, str]], threshold: float = 0.85) -> Tuple[List[str], Dict[str, int]]:
    """
    Analyze speaking lines to identify top speaking cast.

    Args:
        lines: List of line dicts with 'character' key
        threshold: Percentage of dialogue to include (default 85%)

    Returns:
        Tuple of (top_speaking_cast list, line_counts dict)
    """
    # Count lines per character
    line_counts = Counter(line['character'] for line in lines)
    total_lines = len(lines)

    if total_lines == 0:
        return [], {}

    # Sort by line count descending
    sorted_chars = sorted(line_counts.items(), key=lambda x: (-x[1], x[0]))

    # Find cutoff for top speaking cast
    cumulative = 0
    cutoff_count = 0
    top_cast = []

    for char, count in sorted_chars:
        cumulative += count
        top_cast.append(char)
        cutoff_count += 1

        # Stop when we've captured threshold% of dialogue
        # But ensure we have at least 5 characters and at most 15
        if cumulative / total_lines >= threshold and cutoff_count >= 5:
            break
        if cutoff_count >= 15:
            break

    # Also include any character with > 3% of lines even if after cutoff
    min_threshold = max(3, int(total_lines * 0.03))
    for char, count in sorted_chars:
        if char not in top_cast and count >= min_threshold:
            top_cast.append(char)

    return top_cast, dict(line_counts)


def determine_category(pack_name: str, movies: List[Dict[str, Any]], index_data: Dict[str, Any]) -> str:
    """
    Determine the appropriate category for a pack.

    Returns category ID or "uncategorized"
    """
    pack_name_lower = pack_name.lower()

    # Check for animated indicators
    animated_studios = ['pixar', 'disney', 'dreamworks', 'illumination', 'blue sky', 'laika']
    animated_keywords = ['animated', 'animation', 'cartoon']

    # Check movie titles for animated indicators
    is_animated = False
    for movie in movies:
        title = movie.get('title', '').lower()
        # Common animated movie patterns
        if any(word in title for word in ['toy story', 'shrek', 'frozen', 'moana', 'coco',
                                           'incredibles', 'monsters', 'nemo', 'dory', 'cars',
                                           'wall-e', 'up', 'brave', 'inside out', 'soul',
                                           'ratatouille', 'bugs life', 'tangled', 'zootopia',
                                           'wreck-it', 'ralph', 'big hero', 'encanto']):
            is_animated = True
            break

    # Check pack name too
    if any(keyword in pack_name_lower for keyword in animated_studios + animated_keywords):
        is_animated = True

    if is_animated:
        return "animated"

    # Check for classics (major franchises)
    classic_franchises = ['star wars', 'harry potter', 'lord of the rings', 'matrix',
                          'back to the future', 'indiana jones', 'jurassic', 'marvel',
                          'avengers', 'spider-man', 'batman', 'dark knight']
    if any(franchise in pack_name_lower for franchise in classic_franchises):
        return "classics"

    # Default to uncategorized
    return "uncategorized"


def copy_and_enrich_scripts(
    movie_ids: List[str],
    source_dir: Path,
    dest_dir: Path,
    api_key: str
) -> List[Dict[str, Any]]:
    """
    Copy scripts from script-parser and enrich with metadata.

    Returns list of movie metadata for pack creation.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    movies_metadata = []

    for movie_id in movie_ids:
        source_file = source_dir / f"{movie_id}.json"
        dest_file = dest_dir / f"{movie_id}.json"

        if not source_file.exists():
            print(f"  Warning: Source file not found: {source_file}")
            continue

        # Load script
        script_data = load_json(source_file)
        title = script_data.get('title', movie_id)
        year = script_data.get('year')
        lines = script_data.get('lines', [])
        characters = script_data.get('characters', [])

        print(f"\n  Processing: {title} ({year})")

        # Fetch OMDB metadata
        omdb_data = fetch_omdb_metadata(title, year, api_key)
        if omdb_data:
            script_data['imdbId'] = omdb_data.get('imdbID')
            script_data['poster'] = omdb_data.get('Poster')
            script_data['rated'] = omdb_data.get('Rated')
            script_data['runtime'] = omdb_data.get('Runtime')
            script_data['genre'] = omdb_data.get('Genre')
            script_data['director'] = omdb_data.get('Director')
            print(f"    IMDb ID: {omdb_data.get('imdbID')}")

        # Analyze speaking cast
        top_cast, line_counts = analyze_speaking_cast(lines)
        script_data['topSpeakingCast'] = top_cast
        print(f"    Top speaking cast: {len(top_cast)} of {len(characters)} characters")
        print(f"    Top 5 by lines: {', '.join(f'{c}({line_counts[c]})' for c in top_cast[:5])}")

        # Save enriched script
        save_json(script_data, dest_file)
        print(f"    Saved: {dest_file.name}")

        # Collect metadata for pack
        movies_metadata.append({
            'id': movie_id,
            'title': title,
            'year': year,
            'imdbId': script_data.get('imdbId'),
            'lineCount': len(lines),
            'characterCount': len(characters),
            'topCastCount': len(top_cast)
        })

    return movies_metadata


def update_index(pack_id: str, pack_name: str, movie_count: int, category: str, index_file: Path) -> None:
    """Update the main index.json with the new pack."""
    index_data = load_json(index_file) if index_file.exists() else {
        "featured": [],
        "categories": [],
        "packs": []
    }

    # Check if pack already exists
    existing_pack = next((p for p in index_data.get('packs', []) if p['id'] == pack_id), None)

    if existing_pack:
        # Update existing pack
        existing_pack['name'] = pack_name
        existing_pack['movieCount'] = movie_count
        print(f"\n  Updated existing pack in index: {pack_id}")
    else:
        # Add new pack
        index_data['packs'].append({
            'id': pack_id,
            'name': pack_name,
            'movieCount': movie_count
        })
        print(f"\n  Added new pack to index: {pack_id}")

    # Ensure category exists
    existing_category = next((c for c in index_data.get('categories', []) if c['id'] == category), None)

    if not existing_category:
        # Create new category if it doesn't exist
        category_names = {
            'classics': 'Classics',
            'animated': 'Animated',
            'uncategorized': 'Other'
        }
        index_data['categories'].append({
            'id': category,
            'name': category_names.get(category, category.title()),
            'packs': [pack_id]
        })
        print(f"  Created new category: {category}")
    elif pack_id not in existing_category['packs']:
        existing_category['packs'].append(pack_id)
        print(f"  Added to category: {category}")

    save_json(index_data, index_file)


def create_pack_skeleton(
    pack_id: str,
    pack_name: str,
    movie_ids: List[str],
    pack_file: Path
) -> None:
    """
    Create pack definition with placeholder theme and messages.
    These should be filled in by Claude interactively.
    """
    pack_data = {
        "id": pack_id,
        "name": pack_name,
        "type": "series",
        "movies": movie_ids,
        "theme": {
            "_comment": "TODO: Generate themed colors using Claude",
            "primary": "#1976d2",
            "bgColor": "#0d47a1",
            "containerBg": "#ffffff",
            "accentColor": "#1565c0",
            "btnText": "white",
            "cardGradientStart": "#1976d2",
            "cardGradientEnd": "#1565c0",
            "cardBorder": "#1976d2",
            "cardText": "#ffffff"
        },
        "tierMessages": {
            "_comment": "TODO: Generate themed messages using Claude",
            "perfect": "Perfect!",
            "good": "Great job!",
            "average": "Not bad!",
            "barely": "Close one!",
            "failure": "Better luck next time!"
        }
    }

    save_json(pack_data, pack_file)
    print(f"\n  Created pack skeleton: {pack_file}")
    print("  NOTE: Theme and tierMessages have placeholders - use Claude to generate themed versions!")


def main():
    parser = argparse.ArgumentParser(
        description="Import movie pack from script-parser with metadata enrichment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-detect movies matching pack name
  python scripts/import-pack.py frozen

  # Explicit movie list
  python scripts/import-pack.py incredibles incredibles-1 incredibles-2

  # Import with pack display name
  python scripts/import-pack.py --name "The Incredibles" incredibles incredibles-1 incredibles-2
        """
    )

    parser.add_argument("pack_id", help="Unique identifier for the pack")
    parser.add_argument("movie_ids", nargs="*", help="Movie IDs to include (auto-detected if not provided)")
    parser.add_argument("--name", help="Display name for the pack (default: pack_id titlecased)")
    parser.add_argument("--skip-omdb", action="store_true", help="Skip OMDB API calls")
    parser.add_argument("--skip-puzzles", action="store_true", help="Skip puzzle regeneration")

    args = parser.parse_args()

    # Setup paths
    repo_root = get_repo_root()
    script_parser_root = get_script_parser_path()

    source_dir = script_parser_root / "data" / "transcripts" / "parsed"
    scripts_dir = repo_root / "public" / "data" / "scripts"
    packs_dir = repo_root / "public" / "data" / "packs"
    index_file = repo_root / "public" / "data" / "index.json"

    # Load environment
    env = load_env()
    api_key = env.get('OMDB_API_KEY', '')

    if not api_key and not args.skip_omdb:
        print("Warning: OMDB_API_KEY not found in .env file")
        print("  Skipping OMDB metadata enrichment")
        args.skip_omdb = True

    # Verify script-parser repo exists
    if not script_parser_root.exists():
        print(f"Error: script-parser repo not found at {script_parser_root}")
        return 1

    # Find movies
    movie_ids = args.movie_ids if args.movie_ids else find_matching_movies(args.pack_id, source_dir)

    if not movie_ids:
        print(f"Error: No movies found for pack '{args.pack_id}'")
        print(f"  Searched in: {source_dir}")
        return 1

    pack_name = args.name or args.pack_id.replace('-', ' ').title()

    print(f"\n{'='*60}")
    print(f"Importing Pack: {pack_name}")
    print(f"{'='*60}")
    print(f"  Pack ID: {args.pack_id}")
    print(f"  Movies: {', '.join(movie_ids)}")
    print(f"  Source: {source_dir}")

    # Copy and enrich scripts
    print(f"\n[1/5] Copying and enriching scripts...")
    movies_metadata = copy_and_enrich_scripts(
        movie_ids,
        source_dir,
        scripts_dir,
        api_key if not args.skip_omdb else ''
    )

    if not movies_metadata:
        print("Error: No movies were imported")
        return 1

    # Determine category
    print(f"\n[2/5] Determining category...")
    category = determine_category(pack_name, movies_metadata, {})
    print(f"  Category: {category}")

    # Update index
    print(f"\n[3/5] Updating index.json...")
    update_index(args.pack_id, pack_name, len(movies_metadata), category, index_file)

    # Create pack skeleton
    print(f"\n[4/5] Creating pack definition...")
    pack_file = packs_dir / f"{args.pack_id}.json"
    packs_dir.mkdir(parents=True, exist_ok=True)
    create_pack_skeleton(args.pack_id, pack_name, movie_ids, pack_file)

    # Regenerate puzzles
    if not args.skip_puzzles:
        print(f"\n[5/5] Regenerating puzzles...")
        import subprocess
        puzzle_script = repo_root / "scripts" / "generate-daily-puzzles.py"
        result = subprocess.run(
            [sys.executable, str(puzzle_script), "--pack", args.pack_id],
            cwd=repo_root,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"  Warning: Puzzle generation failed: {result.stderr}")
        else:
            print(f"  Puzzles generated successfully")

    # Summary
    print(f"\n{'='*60}")
    print("Import Complete!")
    print(f"{'='*60}")
    print(f"\nMovies imported:")
    for m in movies_metadata:
        imdb = f" (IMDb: {m.get('imdbId')})" if m.get('imdbId') else ""
        print(f"  - {m['title']} ({m['year']}){imdb}")
        print(f"    {m['lineCount']} lines, {m['topCastCount']}/{m['characterCount']} top cast")

    print(f"\nFiles created/modified:")
    print(f"  - {scripts_dir.relative_to(repo_root)}/*.json (scripts)")
    print(f"  - {pack_file.relative_to(repo_root)} (pack definition)")
    print(f"  - {index_file.relative_to(repo_root)} (index)")

    print(f"\n{'='*60}")
    print("NEXT STEPS:")
    print(f"{'='*60}")
    print("""
1. Generate themed colors and messages using Claude Code:

   Edit the pack file and ask Claude to generate:
   - Theme colors that evoke the pack's aesthetic
   - Tier messages that are themed quotes/references

   Example prompt:
   "Generate theme colors and tier messages for the {pack_name} pack.
    Colors should evoke the movie's aesthetic with good contrast.
    Messages should be themed quotes going from celebratory to commiserative."

2. Test the pack:
   npm run dev
   Navigate to the new pack and play a game

3. If everything looks good, commit the changes!
""".format(pack_name=pack_name))

    return 0


if __name__ == "__main__":
    sys.exit(main())
