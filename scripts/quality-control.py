#!/usr/bin/env python3
"""
Quality Control for Movie Scripts

Automatically detects and fixes character name issues:
- Duplicate character names (same person with different names)
- Typos in character names
- Inconsistent naming conventions

Uses LLM to intelligently identify which characters are the same person.

Usage:
    # Run QC on specific movies
    python scripts/quality-control.py frozen frozen-2

    # Run QC on entire pack
    python scripts/quality-control.py --pack shrek

    # Run QC on all movies
    python scripts/quality-control.py --all

    # Dry run mode (show suggestions without applying)
    python scripts/quality-control.py --dry-run frozen
"""

import json
import argparse
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter


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


def check_dependencies() -> bool:
    """Check if required dependencies are installed."""
    try:
        from google import genai
        return True
    except ImportError as e:
        missing_module = str(e).split("'")[-2] if "'" in str(e) else str(e)
        print(f"Error: Missing dependency '{missing_module}'")
        print(f"\nTo install dependencies, run:")
        print(f"  pip install -r parser/requirements.txt")
        return False


def load_json(file_path: Path) -> Dict[Any, Any]:
    """Load JSON from a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Dict[Any, Any], file_path: Path) -> None:
    """Save JSON to a file with pretty formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def analyze_character_duplicates(
    characters: List[str],
    title: str,
    year: Optional[int],
    api_key: str,
    verbose: bool = False
) -> List[Dict[str, Any]]:
    """
    Use LLM to identify duplicate character names.

    Args:
        characters: List of character names
        title: Movie title
        year: Movie year
        api_key: Google API key
        verbose: Print debug output

    Returns:
        List of merge suggestions with confidence levels
    """
    from google import genai
    from google.genai import types

    if not characters or len(characters) < 2:
        return []

    # Create prompt for LLM
    movie_context = f"{title} ({year})" if year else title
    character_list = "\n".join(f"- {char}" for char in characters)

    prompt = f"""You are analyzing a movie script for character name consistency.
Given a list of character names from the movie "{movie_context}", identify which names refer to the same character.

Common patterns to look for:
1. Same character with different names (e.g., STRIDER and ARAGORN)
2. Typos or spelling variations (e.g., VOLDEMORT and VOLDERMORT)
3. Full names vs. nicknames (e.g., LIGHTNING MCQUEEN and LIGHTNING)
4. Character name changes (e.g., FN-2187 and FINN)
5. Generic numbered characters (e.g., GUARD 1, GUARD 2 → GUARD)
6. Voice annotations (e.g., DONKEY'S VOICE → DONKEY)

Character names:
{character_list}

Return ONLY a JSON array of merge suggestions. Each suggestion must have this exact format:
[
  {{
    "from": "CHARACTER_NAME_TO_REPLACE",
    "to": "CANONICAL_CHARACTER_NAME",
    "confidence": "high",
    "reason": "Brief explanation"
  }}
]

Confidence levels:
- "high": Definitely the same character (>95% confident)
- "medium": Likely the same character (80-95% confident)
- "low": Possibly the same character (<80% confident)

IMPORTANT:
- Only suggest merges where you are confident they are the same character
- Use your knowledge of the movie to make informed decisions
- For generic characters (GUARD 1, GUARD 2), merge into singular form (GUARD)
- Prefer the most recognizable/canonical name as the target
- If no duplicates are found, return an empty array: []
- Return ONLY valid JSON, no additional text or explanation"""

    try:
        client = genai.Client(api_key=api_key)

        if verbose:
            print(f"    Analyzing {len(characters)} characters with Gemini Flash...")

        config = types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json"
        )

        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=config
        )

        if not response or not response.text:
            if verbose:
                print("    Warning: Empty response from LLM")
            return []

        # Parse JSON response
        response_text = response.text.strip()
        if verbose:
            print(f"    LLM response: {response_text[:200]}...")

        suggestions = json.loads(response_text)

        if not isinstance(suggestions, list):
            if verbose:
                print(f"    Warning: Expected JSON array, got {type(suggestions)}")
            return []

        # Validate suggestions
        valid_suggestions = []
        for suggestion in suggestions:
            if not isinstance(suggestion, dict):
                continue

            if all(k in suggestion for k in ['from', 'to', 'confidence', 'reason']):
                # Verify characters exist
                if suggestion['from'] in characters:
                    valid_suggestions.append(suggestion)

        return valid_suggestions

    except json.JSONDecodeError as e:
        if verbose:
            print(f"    Warning: Failed to parse LLM response as JSON: {e}")
        return []
    except Exception as e:
        if verbose:
            print(f"    Warning: LLM analysis failed: {e}")
        return []


def apply_character_merge(script_data: Dict[str, Any], from_char: str, to_char: str) -> Dict[str, Any]:
    """Apply a character name merge to script data."""
    changes_made = False

    # Update dialogue lines
    for line in script_data.get('lines', []):
        if line.get('character') == from_char:
            line['character'] = to_char
            changes_made = True

    # Update characters array
    if from_char in script_data.get('characters', []):
        script_data['characters'].remove(from_char)
        changes_made = True

    if to_char not in script_data.get('characters', []):
        script_data['characters'].append(to_char)

    # Sort alphabetically
    script_data['characters'].sort()

    return script_data


def regenerate_top_speaking_cast(script_data: Dict[str, Any], threshold: float = 0.85) -> List[str]:
    """Regenerate topSpeakingCast based on current dialogue."""
    lines = script_data.get('lines', [])
    if not lines:
        return []

    # Count lines per character
    line_counts = Counter(line.get('character') for line in lines if line.get('character'))

    # Sort by count desc, name asc
    sorted_chars = sorted(line_counts.items(), key=lambda x: (-x[1], x[0]))

    # Include characters accounting for threshold% of dialogue
    total_lines = len(lines)
    cumulative = 0
    top_cast = []

    for char, count in sorted_chars:
        top_cast.append(char)
        cumulative += count
        if cumulative / total_lines >= threshold:
            break

    return top_cast


def run_quality_control(
    movie_id: str,
    scripts_dir: Path,
    api_key: str,
    dry_run: bool = False,
    verbose: bool = False
) -> bool:
    """
    Run quality control on a single movie.

    Args:
        movie_id: Movie ID
        scripts_dir: Directory containing script JSON files
        api_key: Google API key
        dry_run: If True, show suggestions without applying
        verbose: Print detailed output

    Returns:
        True if successful, False if failed
    """
    script_file = scripts_dir / f"{movie_id}.json"

    if not script_file.exists():
        print(f"  ❌ Script not found: {movie_id}")
        return False

    try:
        # Load script data
        script_data = load_json(script_file)

        title = script_data.get('title', movie_id)
        year = script_data.get('year')
        characters = script_data.get('characters', [])

        if verbose:
            print(f"\n  🎬 {title} ({year})")
            print(f"    Characters: {len(characters)}")

        # Analyze for duplicates
        suggestions = analyze_character_duplicates(
            characters, title, year, api_key, verbose
        )

        if not suggestions:
            if verbose:
                print(f"  ✅ {movie_id}: No issues found")
            else:
                print(f"  ✅ {movie_id}")
            return True

        # Filter by confidence level
        high_confidence = [s for s in suggestions if s['confidence'] == 'high']
        medium_confidence = [s for s in suggestions if s['confidence'] == 'medium']

        if not high_confidence and not medium_confidence:
            if verbose:
                print(f"  ✅ {movie_id}: No high/medium confidence issues found")
            else:
                print(f"  ✅ {movie_id}")
            return True

        # Display suggestions
        print(f"\n  🔍 {movie_id}: Found {len(high_confidence)} high-confidence issue(s)")

        for suggestion in high_confidence:
            print(f"    • {suggestion['from']} → {suggestion['to']}")
            if verbose:
                print(f"      Reason: {suggestion['reason']}")

        if medium_confidence and verbose:
            print(f"\n    📋 Medium confidence suggestions (not applied automatically):")
            for suggestion in medium_confidence:
                print(f"      • {suggestion['from']} → {suggestion['to']}")
                print(f"        Reason: {suggestion['reason']}")

        if dry_run:
            print(f"    [DRY RUN] Would apply {len(high_confidence)} merge(s)")
            return True

        # Apply high-confidence merges
        original_char_count = len(script_data['characters'])

        for suggestion in high_confidence:
            script_data = apply_character_merge(
                script_data,
                suggestion['from'],
                suggestion['to']
            )

        # Regenerate topSpeakingCast
        old_top_cast = script_data.get('topSpeakingCast', [])
        new_top_cast = regenerate_top_speaking_cast(script_data)
        script_data['topSpeakingCast'] = new_top_cast

        # Save updated script
        save_json(script_data, script_file)

        new_char_count = len(script_data['characters'])
        print(f"    ✅ Applied {len(high_confidence)} merge(s)")
        print(f"    Characters: {original_char_count} → {new_char_count}")

        if old_top_cast != new_top_cast:
            print(f"    Updated topSpeakingCast: {len(old_top_cast)} → {len(new_top_cast)}")

        return True

    except Exception as e:
        print(f"  ❌ Error processing {movie_id}: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Quality control for movie scripts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run QC on specific movies
  python scripts/quality-control.py frozen frozen-2

  # Run QC on entire pack
  python scripts/quality-control.py --pack shrek

  # Run QC on all movies
  python scripts/quality-control.py --all

  # Dry run mode (show suggestions without applying)
  python scripts/quality-control.py --dry-run frozen
        """
    )

    parser.add_argument("movie_ids", nargs="*", help="Movie IDs to process")
    parser.add_argument("--pack", help="Process all movies in a pack")
    parser.add_argument("--all", action="store_true", help="Process all movies")
    parser.add_argument("--dry-run", action="store_true", help="Show suggestions without applying")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    if not check_dependencies():
        return 1

    repo_root = get_repo_root()
    scripts_dir = repo_root / "public" / "data" / "scripts"

    env = load_env()
    api_key = env.get('GOOGLE_API_KEY') or env.get('GEMINI_API_KEY', '')

    if not api_key:
        print("Error: GOOGLE_API_KEY or GEMINI_API_KEY not found in .env file")
        print("  Quality control requires Gemini API access")
        return 1

    # Determine which movies to process
    movie_ids = []

    if args.all:
        # Process all movies
        movie_ids = [f.stem for f in scripts_dir.glob("*.json")]
    elif args.pack:
        # Process all movies in a pack
        pack_file = repo_root / "public" / "data" / "packs" / f"{args.pack}.json"
        if not pack_file.exists():
            print(f"Error: Pack not found: {args.pack}")
            return 1

        pack_data = load_json(pack_file)
        movie_ids = pack_data.get('movies', [])
    elif args.movie_ids:
        movie_ids = args.movie_ids
    else:
        parser.print_help()
        return 1

    if not movie_ids:
        print("Error: No movies to process")
        return 1

    # Run QC on each movie
    print(f"\n{'='*60}")
    print(f"Quality Control")
    print(f"{'='*60}")
    print(f"  Movies: {len(movie_ids)}")
    if args.dry_run:
        print(f"  Mode: DRY RUN (no changes will be made)")
    print()

    success_count = 0
    failure_count = 0

    for movie_id in movie_ids:
        success = run_quality_control(
            movie_id,
            scripts_dir,
            api_key,
            dry_run=args.dry_run,
            verbose=args.verbose
        )

        if success:
            success_count += 1
        else:
            failure_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"Quality Control Complete")
    print(f"{'='*60}")
    print(f"  ✅ Success: {success_count}/{len(movie_ids)}")
    if failure_count > 0:
        print(f"  ❌ Failed: {failure_count}/{len(movie_ids)}")
    print()

    return 0 if failure_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
