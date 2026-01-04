#!/usr/bin/env python3
"""
Complete Workflow Demo - Shows the full pipeline for adding a new movie

This script demonstrates:
1. Fetching a script from IMSDB
2. Parsing dialogue with the improved parser
3. Analyzing character distribution
4. Showing how TMDB integration would filter characters
5. Outputting game-ready JSON

Run with: python3 demo_workflow.py
"""

import json
import os
from improved_parser import (
    fetch_raw_html,
    parse_screenplay_from_html,
    analyze_characters,
    save_script
)


def print_section(title: str):
    """Print a section header."""
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def demo_full_pipeline(imsdb_slug: str, movie_id: str, title: str, year: int):
    """
    Demonstrate the full parsing pipeline for a single movie.
    """
    print_section(f"DEMO: {title} ({year})")

    # Step 1: Fetch
    print("\n[STEP 1] Fetching script from IMSDB...")
    try:
        html = fetch_raw_html(imsdb_slug)
        print(f"  ✓ Fetched {len(html):,} bytes of HTML")
    except Exception as e:
        print(f"  ✗ Failed to fetch: {e}")
        return None

    # Step 2: Parse
    print("\n[STEP 2] Parsing screenplay...")
    dialogues = parse_screenplay_from_html(html)
    print(f"  ✓ Extracted {len(dialogues)} dialogue lines")

    if not dialogues:
        print("  ✗ No dialogues found - script may not be available")
        return None

    # Step 3: Analyze characters
    print("\n[STEP 3] Analyzing characters...")
    char_counts = analyze_characters(dialogues)
    total_chars = len(char_counts)
    print(f"  Total unique characters: {total_chars}")

    print("\n  Top 10 characters by line count:")
    for i, (char, count) in enumerate(list(char_counts.items())[:10], 1):
        print(f"    {i:2}. {char}: {count} lines")

    # Step 4: Identify main vs minor characters
    print("\n[STEP 4] Character classification...")

    # Characters with >20 lines are likely main characters
    main_chars = [c for c, n in char_counts.items() if n >= 20]
    supporting = [c for c, n in char_counts.items() if 5 <= n < 20]
    minor = [c for c, n in char_counts.items() if n < 5]

    print(f"  Main characters (20+ lines): {len(main_chars)}")
    print(f"    {main_chars[:8]}{'...' if len(main_chars) > 8 else ''}")
    print(f"  Supporting (5-19 lines): {len(supporting)}")
    print(f"  Minor (<5 lines): {len(minor)}")

    # Step 5: Sample dialogues
    print("\n[STEP 5] Sample dialogues (first 5):")
    for i, d in enumerate(dialogues[:5], 1):
        text = d.text[:60] + "..." if len(d.text) > 60 else d.text
        print(f"  {i}. {d.character}: \"{text}\"")

    # Step 6: Quality checks
    print("\n[STEP 6] Quality checks...")

    # Check for problematic entries
    issues = []

    # Check for title/credit cruft
    for d in dialogues[:10]:
        if any(x in d.character for x in ['WRITTEN', 'BY', 'TITLE', 'EPISODE']):
            issues.append(f"Title cruft detected: {d.character}")

    # Check for multi-character parsing errors
    for d in dialogues:
        if len(d.character) > 30:
            issues.append(f"Possible parsing error: {d.character[:40]}...")
            break

    # Check for very short dialogues
    short_count = sum(1 for d in dialogues if len(d.text) < 3)
    if short_count > 50:
        issues.append(f"Many very short dialogues: {short_count}")

    if issues:
        print("  ⚠ Issues found:")
        for issue in issues[:5]:
            print(f"    - {issue}")
    else:
        print("  ✓ No major issues detected")

    # Step 7: Save output
    print("\n[STEP 7] Saving to JSON...")
    data = save_script(movie_id, title, year, dialogues, output_dir="output")
    print(f"  ✓ Saved to output/{movie_id}.json")

    # Step 8: TMDB recommendation
    print("\n[STEP 8] TMDB integration recommendation...")
    print("""
  To filter for important characters only:

  1. Get a free TMDB API key at:
     https://www.themoviedb.org/settings/api

  2. Search for the movie to get TMDB ID:
     GET /3/search/movie?query={title}

  3. Fetch cast with billing order:
     GET /3/movie/{id}/credits

  4. Keep only characters with order <= 15

  This would reduce characters from """ + str(total_chars) + """ to ~10-15
  and remove extras like "MAN 1", "OFFICER", etc.
""")

    return data


def compare_scripts():
    """Compare parsing results across multiple scripts."""
    print_section("COMPARISON: Multiple Scripts")

    movies = [
        ("Breakfast-Club,-The", "breakfast-club", "The Breakfast Club", 1985),
        ("Princess-Bride,-The", "princess-bride", "The Princess Bride", 1987),
        ("Pulp-Fiction", "pulp-fiction", "Pulp Fiction", 1994),
    ]

    results = []
    for imsdb_slug, movie_id, title, year in movies:
        print(f"\nProcessing: {title}...")
        try:
            html = fetch_raw_html(imsdb_slug)
            dialogues = parse_screenplay_from_html(html)
            char_counts = analyze_characters(dialogues)

            results.append({
                "title": title,
                "lines": len(dialogues),
                "chars": len(char_counts),
                "main": len([c for c, n in char_counts.items() if n >= 20]),
                "top_char": list(char_counts.items())[0] if char_counts else None
            })
        except Exception as e:
            print(f"  Error: {e}")

    print("\n" + "-" * 70)
    print(f"{'Movie':<30} {'Lines':>8} {'Chars':>8} {'Main':>6} {'Top Character':>20}")
    print("-" * 70)

    for r in results:
        top = f"{r['top_char'][0]} ({r['top_char'][1]})" if r['top_char'] else "N/A"
        print(f"{r['title']:<30} {r['lines']:>8} {r['chars']:>8} {r['main']:>6} {top:>20}")


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════════╗
║           SCRIPTDLE - Script Parsing Workflow Demo               ║
╚══════════════════════════════════════════════════════════════════╝

This demo shows the complete pipeline for adding movie scripts
to the Scriptdle game.
""")

    # Demo with The Breakfast Club (known good script)
    demo_full_pipeline(
        imsdb_slug="Breakfast-Club,-The",
        movie_id="breakfast-club",
        title="The Breakfast Club",
        year=1985
    )

    # Comparison across multiple scripts
    compare_scripts()

    print("\n" + "=" * 60)
    print("  DEMO COMPLETE")
    print("=" * 60)
    print("""
Output files saved to: output/

Next steps:
1. Review FINDINGS.md for detailed recommendations
2. Get TMDB API key for character filtering
3. Consider LLM validation for cleanest results

See llm_parser.py for LLM prompt templates.
""")
