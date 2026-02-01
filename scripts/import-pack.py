#!/usr/bin/env python3
"""
Import Movie Pack - Parse and Add Movies to Scriptdle

This script parses movie transcripts (from URLs or files) and imports them
as packs into Scriptdle, enriching with OMDB metadata and analyzing speaking roles.

The theme colors and tier messages require Claude Code interaction,
so this script handles everything except those LLM-dependent parts.

Usage:
    # Parse from Fandom wiki URLs
    python scripts/import-pack.py shrek --urls \
        "https://movies.fandom.com/wiki/Shrek/Transcript" \
        "https://movies.fandom.com/wiki/Shrek_2/Transcript"

    # Parse from local files
    python scripts/import-pack.py lotr --files \
        lotr-fotr.pdf lotr-ttt.pdf lotr-rotk.pdf

    # Use existing parsed scripts (legacy mode)
    python scripts/import-pack.py frozen --existing frozen frozen-2
"""

import json
import argparse
import urllib.request
import urllib.parse
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter

sys.path.insert(0, str(Path(__file__).parent.parent / "parser"))


def check_parser_dependencies():
    """Check if parser dependencies are installed."""
    try:
        import fitz
        import pydantic
        from google import genai
        return True
    except ImportError as e:
        missing_module = str(e).split("'")[-2] if "'" in str(e) else str(e)
        print(f"Error: Missing dependency '{missing_module}'")
        print(f"\nTo install parser dependencies, run:")
        print(f"  pip install -r parser/requirements.txt")
        print(f"\nOr to set up a virtual environment:")
        print(f"  cd parser")
        print(f"  python3 -m venv .venv")
        print(f"  source .venv/bin/activate")
        print(f"  pip install -r requirements.txt")
        return False


def get_repo_root() -> Path:
    """Get the scriptdle repository root directory."""
    return Path(__file__).parent.parent


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


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    import re
    text = text.lower()
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'[^a-z0-9-]', '', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text


def parse_from_url(url: str, movie_id: str, title: Optional[str], year: Optional[int], verbose: bool = True) -> Optional[Dict[str, Any]]:
    """Parse a transcript from a URL using the local parser."""
    if not check_parser_dependencies():
        sys.exit(1)
    try:
        from src.parsers import parse_transcript_url
        
        if verbose:
            print(f"  Parsing from URL: {url}")
        
        result = parse_transcript_url(
            url=url,
            movie_id=movie_id,
            title=title,
            year=year,
            verbose=verbose
        )
        
        if result:
            return result.to_dict()
        return None
    except Exception as e:
        print(f"  Error parsing URL {url}: {e}")
        return None


def parse_from_file(file_path: Path, movie_id: str, title: Optional[str], year: Optional[int], verbose: bool = True) -> Optional[Dict[str, Any]]:
    """Parse a transcript from a local file using the local parser."""
    if not check_parser_dependencies():
        sys.exit(1)
    try:
        from src.parsers import parse_transcript_pdf, parse_transcript_llm
        from src.extractors import extract_simple
        
        if verbose:
            print(f"  Parsing from file: {file_path}")
        
        if file_path.suffix.lower() == ".pdf":
            result = parse_transcript_pdf(
                source=file_path,
                movie_id=movie_id,
                title=title,
                year=year,
                verbose=verbose
            )
        else:
            text = extract_simple(file_path)
            if not text:
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
            
            result = parse_transcript_llm(
                text=text,
                source_file=str(file_path),
                movie_id=movie_id,
                title=title,
                year=year,
                verbose=verbose
            )
        
        if result:
            return result.to_dict()
        return None
    except Exception as e:
        print(f"  Error parsing file {file_path}: {e}")
        return None


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
    line_counts = Counter(line['character'] for line in lines)
    total_lines = len(lines)

    if total_lines == 0:
        return [], {}

    sorted_chars = sorted(line_counts.items(), key=lambda x: (-x[1], x[0]))

    cumulative = 0
    cutoff_count = 0
    top_cast = []

    for char, count in sorted_chars:
        cumulative += count
        top_cast.append(char)
        cutoff_count += 1

        if cumulative / total_lines >= threshold and cutoff_count >= 5:
            break
        if cutoff_count >= 15:
            break

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

    animated_studios = ['pixar', 'disney', 'dreamworks', 'illumination', 'blue sky', 'laika']
    animated_keywords = ['animated', 'animation', 'cartoon']

    is_animated = False
    for movie in movies:
        title = movie.get('title', '').lower()
        if any(word in title for word in ['toy story', 'shrek', 'frozen', 'moana', 'coco',
                                           'incredibles', 'monsters', 'nemo', 'dory', 'cars',
                                           'wall-e', 'up', 'brave', 'inside out', 'soul',
                                           'ratatouille', 'bugs life', 'tangled', 'zootopia',
                                           'wreck-it', 'ralph', 'big hero', 'encanto']):
            is_animated = True
            break

    if any(keyword in pack_name_lower for keyword in animated_studios + animated_keywords):
        is_animated = True

    if is_animated:
        return "animated"

    classic_franchises = ['star wars', 'harry potter', 'lord of the rings', 'matrix',
                          'back to the future', 'indiana jones', 'jurassic', 'marvel',
                          'avengers', 'spider-man', 'batman', 'dark knight']
    if any(franchise in pack_name_lower for franchise in classic_franchises):
        return "classics"

    return "uncategorized"


def parse_and_enrich_scripts(
    sources: List[Dict[str, Any]],
    dest_dir: Path,
    api_key: str,
    verbose: bool = True
) -> List[Dict[str, Any]]:
    """
    Parse scripts from URLs/files and enrich with metadata.

    Args:
        sources: List of dicts with 'type' ('url' or 'file' or 'existing'),
                 'source' (URL/path/movie_id), and optional 'movie_id', 'title', 'year'
        dest_dir: Directory to save parsed scripts
        api_key: OMDB API key for metadata enrichment
        verbose: Print progress output

    Returns:
        List of movie metadata for pack creation.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    movies_metadata = []

    for source_info in sources:
        source_type = source_info['type']
        source = source_info['source']
        movie_id = source_info.get('movie_id', '')
        title = source_info.get('title')
        year = source_info.get('year')

        script_data = None

        if source_type == 'url':
            if not movie_id:
                movie_id = slugify(title or Path(source).stem)
            script_data = parse_from_url(source, movie_id, title, year, verbose)
        elif source_type == 'file':
            file_path = Path(source)
            if not movie_id:
                movie_id = slugify(title or file_path.stem)
            script_data = parse_from_file(file_path, movie_id, title, year, verbose)
        elif source_type == 'existing':
            existing_file = dest_dir / f"{source}.json"
            if existing_file.exists():
                script_data = load_json(existing_file)
                movie_id = source
            else:
                print(f"  Warning: Existing script not found: {existing_file}")
                continue

        if not script_data:
            print(f"  Warning: Failed to parse {source}")
            continue

        movie_id = script_data.get('id') or movie_id
        title = script_data.get('title', title or movie_id)
        year = script_data.get('year', year)
        lines = script_data.get('lines', [])
        characters = script_data.get('characters', [])

        print(f"\n  Enriching: {title} ({year})")

        if api_key:
            omdb_data = fetch_omdb_metadata(title, year, api_key)
            if omdb_data:
                script_data['imdbId'] = omdb_data.get('imdbID')
                script_data['poster'] = omdb_data.get('Poster')
                script_data['rated'] = omdb_data.get('Rated')
                script_data['runtime'] = omdb_data.get('Runtime')
                script_data['genre'] = omdb_data.get('Genre')
                script_data['director'] = omdb_data.get('Director')
                print(f"    IMDb ID: {omdb_data.get('imdbID')}")

        top_cast, line_counts = analyze_speaking_cast(lines)
        script_data['topSpeakingCast'] = top_cast
        print(f"    Top speaking cast: {len(top_cast)} of {len(characters)} characters")
        if top_cast:
            print(f"    Top 5 by lines: {', '.join(f'{c}({line_counts[c]})' for c in top_cast[:5])}")

        dest_file = dest_dir / f"{movie_id}.json"
        save_json(script_data, dest_file)
        print(f"    Saved: {dest_file.name}")

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
        description="Parse and import movie packs into Scriptdle",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Parse from Fandom wiki URLs
  python scripts/import-pack.py shrek --urls \\
      "https://movies.fandom.com/wiki/Shrek/Transcript" \\
      "https://movies.fandom.com/wiki/Shrek_2/Transcript"

  # Parse from local files
  python scripts/import-pack.py lotr --files \\
      lotr-fotr.pdf lotr-ttt.pdf lotr-rotk.pdf

  # Use existing parsed scripts in public/data/scripts/
  python scripts/import-pack.py frozen --existing frozen frozen-2

  # Specify movie IDs for URLs/files
  python scripts/import-pack.py shrek --urls \\
      "https://movies.fandom.com/wiki/Shrek/Transcript:shrek-1:Shrek:2001" \\
      "https://movies.fandom.com/wiki/Shrek_2/Transcript:shrek-2:Shrek 2:2004"
        """
    )

    parser.add_argument("pack_id", help="Unique identifier for the pack")
    parser.add_argument("--urls", nargs="+", help="URLs to parse (format: URL or URL:movie_id:title:year)")
    parser.add_argument("--files", nargs="+", help="Local files to parse (format: path or path:movie_id:title:year)")
    parser.add_argument("--existing", nargs="+", help="Existing movie IDs in public/data/scripts/")
    parser.add_argument("--name", help="Display name for the pack (default: pack_id titlecased)")
    parser.add_argument("--skip-omdb", action="store_true", help="Skip OMDB API calls")
    parser.add_argument("--skip-qc", action="store_true", help="Skip quality control step")
    parser.add_argument("--skip-puzzles", action="store_true", help="Skip puzzle regeneration")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    repo_root = get_repo_root()
    scripts_dir = repo_root / "public" / "data" / "scripts"
    packs_dir = repo_root / "public" / "data" / "packs"
    index_file = repo_root / "public" / "data" / "index.json"

    env = load_env()
    api_key = env.get('OMDB_API_KEY', '')

    if not api_key and not args.skip_omdb:
        print("Warning: OMDB_API_KEY not found in .env file")
        print("  Skipping OMDB metadata enrichment")
        args.skip_omdb = True

    sources = []

    def parse_source_spec(spec: str) -> Dict[str, Any]:
        """Parse source:movie_id:title:year format."""
        parts = spec.split(':')
        result = {'source': parts[0]}
        if len(parts) > 1 and parts[1]:
            result['movie_id'] = parts[1]
        if len(parts) > 2 and parts[2]:
            result['title'] = parts[2]
        if len(parts) > 3 and parts[3]:
            result['year'] = int(parts[3])
        return result

    if args.urls:
        for url_spec in args.urls:
            source_info = parse_source_spec(url_spec)
            source_info['type'] = 'url'
            sources.append(source_info)
    
    if args.files:
        for file_spec in args.files:
            source_info = parse_source_spec(file_spec)
            source_info['type'] = 'file'
            sources.append(source_info)
    
    if args.existing:
        for movie_id in args.existing:
            sources.append({'type': 'existing', 'source': movie_id})

    if not sources:
        print("Error: No sources provided. Use --urls, --files, or --existing")
        parser.print_help()
        return 1

    pack_name = args.name or args.pack_id.replace('-', ' ').title()

    print(f"\n{'='*60}")
    print(f"Importing Pack: {pack_name}")
    print(f"{'='*60}")
    print(f"  Pack ID: {args.pack_id}")
    print(f"  Sources: {len(sources)} movie(s)")

    print(f"\n[1/5] Parsing and enriching scripts...")
    movies_metadata = parse_and_enrich_scripts(
        sources,
        scripts_dir,
        api_key if not args.skip_omdb else '',
        verbose=args.verbose
    )

    if not movies_metadata:
        print("Error: No movies were imported")
        return 1

    movie_ids = [m['id'] for m in movies_metadata]

    # Quality control step
    if not args.skip_qc:
        print(f"\n[2/6] Running quality control...")
        google_api_key = env.get('GOOGLE_API_KEY') or env.get('GEMINI_API_KEY', '')

        if not google_api_key:
            print("  Warning: GOOGLE_API_KEY or GEMINI_API_KEY not found in .env file")
            print("  Skipping quality control step")
        else:
            try:
                # Import quality control module
                sys.path.insert(0, str(repo_root / "scripts"))
                from quality_control import run_quality_control

                qc_success = 0
                qc_failed = 0

                for movie_id in movie_ids:
                    try:
                        success = run_quality_control(
                            movie_id,
                            scripts_dir,
                            google_api_key,
                            dry_run=False,
                            verbose=args.verbose
                        )
                        if success:
                            qc_success += 1
                        else:
                            qc_failed += 1
                    except Exception as e:
                        print(f"  ⚠️  QC failed for {movie_id}: {e}")
                        qc_failed += 1

                if qc_failed > 0:
                    print(f"  ⚠️  QC completed with {qc_failed} failure(s)")
                else:
                    print(f"  ✅ QC completed successfully for all {qc_success} movie(s)")

            except ImportError as e:
                print(f"  Warning: Could not import quality control module: {e}")
                print("  Continuing without quality control")
    else:
        print(f"\n[2/6] Skipping quality control (--skip-qc)")

    print(f"\n[3/6] Determining category...")
    category = determine_category(pack_name, movies_metadata, {})
    print(f"  Category: {category}")

    print(f"\n[4/6] Updating index.json...")
    update_index(args.pack_id, pack_name, len(movies_metadata), category, index_file)

    print(f"\n[5/6] Creating pack definition...")
    pack_file = packs_dir / f"{args.pack_id}.json"
    packs_dir.mkdir(parents=True, exist_ok=True)
    create_pack_skeleton(args.pack_id, pack_name, movie_ids, pack_file)

    if not args.skip_puzzles:
        print(f"\n[6/6] Regenerating puzzles...")
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
    print(f"""
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
""")

    return 0


if __name__ == "__main__":
    sys.exit(main())
