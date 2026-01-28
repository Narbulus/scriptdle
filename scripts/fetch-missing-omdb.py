#!/usr/bin/env python3
"""
Fetch OMDB metadata for movies that are missing it.

This script scans all movie scripts and fetches OMDB data for those
that don't have imdbId, poster, or other metadata.

Usage:
    python scripts/fetch-missing-omdb.py --dry-run  # Preview changes
    python scripts/fetch-missing-omdb.py            # Apply changes
"""

import json
import argparse
import urllib.request
import urllib.parse
import time
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple


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


def parse_title_year(title: str) -> Tuple[str, Optional[int]]:
    """
    Parse title and year from a string like 'Frozen (2013)' or 'Frozen'.

    Returns (title_without_year, year)
    """
    # Check for year in parentheses at the end
    match = re.search(r'^(.+?)\s*\((\d{4})\)\s*$', title)
    if match:
        clean_title = match.group(1).strip()
        year = int(match.group(2))
        return (clean_title, year)
    return (title, None)


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
        with urllib.request.urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode())
            if data.get("Response") == "True":
                return data
            else:
                return None
    except Exception as e:
        print(f"    OMDB Error: {e}")
        return None


def process_movie(script_file: Path, api_key: str, dry_run: bool) -> bool:
    """
    Fetch OMDB metadata for a movie if it's missing.
    Returns True if changes were made (or would be made in dry-run).
    """
    try:
        script_data = load_json(script_file)

        # Check if metadata already exists
        has_metadata = bool(script_data.get('imdbId') and script_data.get('poster'))

        if has_metadata:
            return False

        title = script_data.get('title')
        if not title:
            print(f"  ✗ {script_file.name} - No title field")
            return False

        # Parse year from title if present
        clean_title, parsed_year = parse_title_year(title)

        # Use parsed year or fall back to year field
        year = parsed_year or script_data.get('year')

        print(f"  → {clean_title} ({year or 'no year'}) - Fetching OMDB...")

        # Fetch OMDB metadata
        omdb_data = fetch_omdb_metadata(clean_title, year, api_key)

        if omdb_data:
            # Update script data
            script_data['imdbId'] = omdb_data.get('imdbID')
            script_data['poster'] = omdb_data.get('Poster')
            script_data['rated'] = omdb_data.get('Rated')
            script_data['runtime'] = omdb_data.get('Runtime')
            script_data['genre'] = omdb_data.get('Genre')
            script_data['director'] = omdb_data.get('Director')

            # Add year if we parsed it from title
            if parsed_year and not script_data.get('year'):
                script_data['year'] = parsed_year

            if dry_run:
                print(f"    [DRY RUN] Would add: IMDb {omdb_data.get('imdbID')}")
            else:
                save_json(script_data, script_file)
                print(f"    ✓ Added: IMDb {omdb_data.get('imdbID')}")

            return True
        else:
            print(f"    ✗ No OMDB results found")
            return False

    except Exception as e:
        print(f"  ✗ Error processing {script_file.name}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Fetch OMDB metadata for movies missing it'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying files'
    )
    args = parser.parse_args()

    # Load API key
    env_vars = load_env()
    api_key = env_vars.get('OMDB_API_KEY')

    if not api_key:
        print("Error: OMDB_API_KEY not found in .env file")
        print("Please add your OMDB API key to .env:")
        print("  OMDB_API_KEY=your_key_here")
        return 1

    # Get all script files
    scripts_dir = get_repo_root() / "public" / "data" / "scripts"
    script_files = sorted(scripts_dir.glob("*.json"))

    if not script_files:
        print(f"No script files found in {scripts_dir}")
        return 1

    print(f"\nFetching OMDB metadata for {len(script_files)} movies...")
    if args.dry_run:
        print("(DRY RUN MODE - No files will be modified)\n")
    else:
        print("(Files will be modified)\n")

    # Process each script
    updated_count = 0
    skipped_count = 0

    for script_file in script_files:
        try:
            changed = process_movie(script_file, api_key, args.dry_run)
            if changed:
                updated_count += 1
                # Add delay to respect API rate limits
                if not args.dry_run:
                    time.sleep(1.0)
            else:
                skipped_count += 1
        except Exception as e:
            print(f"  ✗ Unexpected error with {script_file.name}: {e}")

    # Print summary
    print(f"\n{'=' * 60}")
    print("Summary:")
    print(f"  Total movies: {len(script_files)}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped (already had metadata): {skipped_count}")

    if args.dry_run:
        print("\nThis was a dry run. Run without --dry-run to apply changes.")

    return 0


if __name__ == '__main__':
    exit(main())
