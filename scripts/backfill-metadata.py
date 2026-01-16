#!/usr/bin/env python3
"""
One-time script to backfill metadata to existing script files.

Adds lineCount, characterCount, topCastCount to scripts without modifying
the existing pack theme colors and tier messages.

Usage:
    python scripts/backfill-metadata.py [--dry-run]
"""

import json
import argparse
from pathlib import Path
from typing import Dict, Any, List
from collections import Counter


def get_repo_root() -> Path:
    """Get the scriptdle repository root directory."""
    return Path(__file__).parent.parent


def load_json(file_path: Path) -> Dict[Any, Any]:
    """Load JSON from a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Dict[Any, Any], file_path: Path) -> None:
    """Save JSON to a file with pretty formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def analyze_top_characters(lines: List[Dict[str, str]], min_line_threshold: int = 5) -> List[str]:
    """
    Analyze speaking roles and return top characters.

    Top characters are those with at least min_line_threshold lines.
    """
    if not lines:
        return []

    # Count lines per character
    character_counts = Counter()
    for line in lines:
        character = line.get('character', '').strip()
        if character and character not in ['ALL', 'BOTH', 'EVERYONE']:
            character_counts[character] += 1

    # Get characters with enough lines
    top_characters = [
        char for char, count in character_counts.most_common()
        if count >= min_line_threshold
    ]

    return top_characters


def backfill_script_metadata(script_file: Path, dry_run: bool = False) -> bool:
    """
    Add missing metadata to a script file.

    Returns True if changes were made, False otherwise.
    """
    script_data = load_json(script_file)

    # Check if already has metadata
    has_line_count = 'lineCount' in script_data
    has_character_count = 'characterCount' in script_data
    has_top_cast_count = 'topCastCount' in script_data
    has_top_cast = 'topCast' in script_data

    if has_line_count and has_character_count and has_top_cast_count and has_top_cast:
        print(f"  ✓ {script_file.name} - Already has metadata")
        return False

    # Calculate metadata
    lines = script_data.get('lines', [])
    characters = script_data.get('characters', [])
    top_cast = analyze_top_characters(lines, min_line_threshold=5)

    # Add metadata
    if not has_line_count:
        script_data['lineCount'] = len(lines)
    if not has_character_count:
        script_data['characterCount'] = len(characters)
    if not has_top_cast_count:
        script_data['topCastCount'] = len(top_cast)
    if not has_top_cast:
        script_data['topCast'] = top_cast

    # Save if not dry run
    if not dry_run:
        save_json(script_data, script_file)
        print(f"  ✓ {script_file.name} - Added metadata (lines: {len(lines)}, chars: {len(characters)}, top cast: {len(top_cast)})")
    else:
        print(f"  [DRY RUN] {script_file.name} - Would add metadata (lines: {len(lines)}, chars: {len(characters)}, top cast: {len(top_cast)})")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Backfill metadata to existing script files",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without actually modifying files"
    )

    args = parser.parse_args()

    # Setup paths
    repo_root = get_repo_root()
    scripts_dir = repo_root / "public" / "data" / "scripts"

    if not scripts_dir.exists():
        print(f"❌ Scripts directory not found: {scripts_dir}")
        return 1

    # Get all script files
    script_files = sorted(scripts_dir.glob("*.json"))

    if not script_files:
        print(f"❌ No script files found in: {scripts_dir}")
        return 1

    print(f"🔍 Found {len(script_files)} script files")
    print()

    if args.dry_run:
        print("🧪 DRY RUN MODE - No files will be modified")
        print()

    # Process each script
    modified_count = 0
    for script_file in script_files:
        try:
            if backfill_script_metadata(script_file, dry_run=args.dry_run):
                modified_count += 1
        except Exception as e:
            print(f"  ❌ Error processing {script_file.name}: {e}")

    print()
    print(f"{'Would modify' if args.dry_run else 'Modified'} {modified_count} of {len(script_files)} files")

    if args.dry_run and modified_count > 0:
        print()
        print("Run without --dry-run to apply changes")

    return 0


if __name__ == "__main__":
    exit(main())
