#!/usr/bin/env python3
"""
Pack Generation Utility for Scriptdle

This script automates the creation and updating of movie packs by copying
scripts from the script-parser repo.

Usage:
    python scripts/generate-pack.py <pack_id> <pack_name> <pack_type> <movie_id1> [movie_id2 ...]

Example:
    python scripts/generate-pack.py incredibles "The Incredibles" series incredibles-1 incredibles-2
"""

import json
import argparse
import shutil
from pathlib import Path
from typing import List, Dict, Any


def get_repo_root() -> Path:
    """Get the scriptdle repository root directory."""
    return Path(__file__).parent.parent


def get_script_parser_path() -> Path:
    """Get the script-parser repository path (sibling directory)."""
    return get_repo_root().parent / "script-parser"


def load_json(file_path: Path) -> Dict[Any, Any]:
    """Load JSON from a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Dict[Any, Any], file_path: Path) -> None:
    """Save JSON to a file with pretty formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def copy_scripts(movie_ids: List[str], source_dir: Path, dest_dir: Path) -> None:
    """Copy script files from script-parser to scriptdle."""
    dest_dir.mkdir(parents=True, exist_ok=True)

    for movie_id in movie_ids:
        source_file = source_dir / f"{movie_id}.json"
        dest_file = dest_dir / f"{movie_id}.json"

        if not source_file.exists():
            print(f"⚠️  Warning: Source file not found: {source_file}")
            continue

        shutil.copy2(source_file, dest_file)
        print(f"✓ Copied {movie_id}.json")


def create_or_update_pack(
    pack_id: str,
    pack_name: str,
    pack_type: str,
    movie_ids: List[str],
    pack_dir: Path,
    theme: Dict[str, str] = None,
    tier_messages: Dict[str, str] = None
) -> None:
    """Create or update a pack definition file."""
    pack_file = pack_dir / f"{pack_id}.json"

    # Check if pack already exists
    if pack_file.exists():
        print(f"📝 Updating existing pack: {pack_id}")
        pack_data = load_json(pack_file)
        # Update movies list
        pack_data["movies"] = movie_ids
    else:
        print(f"✨ Creating new pack: {pack_id}")
        # Create new pack with default theme
        pack_data = {
            "id": pack_id,
            "name": pack_name,
            "type": pack_type,
            "movies": movie_ids
        }

        # Add theme if provided, otherwise use defaults
        if theme:
            pack_data["theme"] = theme
        else:
            pack_data["theme"] = {
                "primary": "#1976d2",
                "bgColor": "#0d47a1",
                "containerBg": "#ffffff",
                "accentColor": "#1565c0",
                "btnText": "white",
                "cardGradientStart": "#1976d2",
                "cardGradientEnd": "#1565c0",
                "cardBorder": "#1976d2"
            }

        # Add tier messages if provided
        if tier_messages:
            pack_data["tierMessages"] = tier_messages
        else:
            pack_data["tierMessages"] = {
                "perfect": "Perfect!",
                "good": "Great job!",
                "average": "Not bad!",
                "barely": "Almost there!",
                "failure": "Better luck next time!"
            }

    save_json(pack_data, pack_file)
    print(f"✓ Pack definition saved: {pack_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate or update a Scriptdle pack from script-parser data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create a new series pack
  python scripts/generate-pack.py incredibles "The Incredibles" series incredibles-1 incredibles-2

  # Update an existing pack
  python scripts/generate-pack.py shrek "Shrek" series shrek-1 shrek-2 shrek-3 shrek-4

  # Create a collection pack
  python scripts/generate-pack.py pixar-classics "Pixar Classics" collection toy-story finding-nemo monsters-inc
        """
    )

    parser.add_argument("pack_id", help="Unique identifier for the pack (e.g., 'incredibles')")
    parser.add_argument("pack_name", help="Display name for the pack (e.g., 'The Incredibles')")
    parser.add_argument("pack_type", choices=["series", "collection"],
                       help="Type of pack: 'series' for sequels, 'collection' for themed groups")
    parser.add_argument("movie_ids", nargs="+",
                       help="Movie IDs to include in the pack (e.g., incredibles-1 incredibles-2)")

    args = parser.parse_args()

    # Setup paths
    repo_root = get_repo_root()
    script_parser_root = get_script_parser_path()

    source_dir = script_parser_root / "data"
    scripts_dir = repo_root / "public" / "data" / "scripts"
    packs_dir = repo_root / "public" / "data" / "packs"

    # Verify script-parser repo exists
    if not script_parser_root.exists():
        print(f"❌ Error: script-parser repo not found at {script_parser_root}")
        print("   Make sure the script-parser repo is in the same parent directory as scriptdle")
        return 1

    if not source_dir.exists():
        print(f"❌ Error: script-parser data directory not found at {source_dir}")
        return 1

    print(f"\n🎬 Generating pack: {args.pack_name}")
    print(f"   Pack ID: {args.pack_id}")
    print(f"   Type: {args.pack_type}")
    print(f"   Movies: {', '.join(args.movie_ids)}")
    print()

    # Copy scripts
    print("📋 Copying scripts from script-parser...")
    copy_scripts(args.movie_ids, source_dir, scripts_dir)
    print()

    # Create/update pack definition
    print("📦 Creating/updating pack definition...")
    create_or_update_pack(args.pack_id, args.pack_name, args.pack_type, args.movie_ids, packs_dir)
    print()

    print(f"✅ Pack generation complete!")
    print(f"   Scripts: {scripts_dir}")
    print(f"   Pack: {packs_dir / args.pack_id}.json")

    return 0


if __name__ == "__main__":
    exit(main())
