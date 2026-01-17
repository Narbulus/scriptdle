#!/usr/bin/env python3
"""
Backfill IMDB Metadata for Existing Movies

This script adds IMDB IDs and related metadata to existing movie JSON files
by fetching data from the OMDB API.

Usage:
    python scripts/backfill-imdb-metadata.py --dry-run  # Preview changes
    python scripts/backfill-imdb-metadata.py            # Apply changes
"""

import json
import argparse
import urllib.request
import urllib.parse
import time
from pathlib import Path
from typing import Dict, Any, Optional


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
                print(f"  OMDB: No results for '{title}' ({year}): {data.get('Error', 'Unknown error')}")
                return None
    except Exception as e:
        print(f"  OMDB Error for '{title}': {e}")
        return None


def backfill_movie(script_file: Path, api_key: str, dry_run: bool) -> bool:
    """
    Backfill IMDB metadata for a single movie.
    Returns True if changes were made (or would be made in dry-run).
    """
    try:
        script_data = load_json(script_file)

        # Check if metadata already exists (skip if has both imdbId and poster)
        if script_data.get('imdbId') and script_data.get('poster'):
            print(f"  ✓ {script_data.get('title', script_file.stem)} - Already has IMDB metadata")
            return False

        title = script_data.get('title')
        year = script_data.get('year')

        if not title:
            print(f"  ✗ {script_file.name} - Missing title field")
            return False

        print(f"  → {title} ({year}) - Fetching OMDB data...")

        # Fetch OMDB metadata
        omdb_data = fetch_omdb_metadata(title, year, api_key)

        if omdb_data:
            # Add OMDB fields to script data
            script_data['imdbId'] = omdb_data.get('imdbID')
            script_data['poster'] = omdb_data.get('Poster')
            script_data['rated'] = omdb_data.get('Rated')
            script_data['runtime'] = omdb_data.get('Runtime')
            script_data['genre'] = omdb_data.get('Genre')
            script_data['director'] = omdb_data.get('Director')

            if dry_run:
                print(f"    [DRY RUN] Would add IMDB ID: {omdb_data.get('imdbID')}")
            else:
                save_json(script_data, script_file)
                print(f"    ✓ Added IMDB ID: {omdb_data.get('imdbID')}")

            return True
        else:
            print(f"    ✗ Failed to fetch OMDB data")
            return False

    except Exception as e:
        print(f"  ✗ Error processing {script_file.name}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Backfill IMDB metadata for existing movie scripts'
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

    print(f"\nBackfilling IMDB metadata for {len(script_files)} movies...")
    if args.dry_run:
        print("(DRY RUN MODE - No files will be modified)\n")
    else:
        print("(Files will be modified)\n")

    # Process each script
    updated_count = 0
    skipped_count = 0
    failed_count = 0

    for script_file in script_files:
        try:
            changed = backfill_movie(script_file, api_key, args.dry_run)
            if changed:
                updated_count += 1
            else:
                skipped_count += 1
            # Add delay to respect API rate limits (after every request)
            if not args.dry_run:
                time.sleep(2.5)  # 2.5 second delay for generous backoff
        except Exception as e:
            print(f"  ✗ Unexpected error with {script_file.name}: {e}")
            failed_count += 1

    # Print summary
    print(f"\n{'=' * 60}")
    print("Summary:")
    print(f"  Total movies: {len(script_files)}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped (already had IMDB ID): {skipped_count}")
    print(f"  Failed: {failed_count}")

    if args.dry_run:
        print("\nThis was a dry run. Run without --dry-run to apply changes.")

    return 0


if __name__ == '__main__':
    exit(main())
