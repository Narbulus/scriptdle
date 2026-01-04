#!/usr/bin/env python3
"""
Script Availability Checker

Tests script availability across multiple sources and assesses parsing quality
for all 100 movies in the catalog.

Sources checked:
1. IMSDB (imsdb.com) - HTML format
2. SimplyScripts - PDF links (would need PDF parsing)
3. Script Slug - PDF format
"""

import urllib.request
import urllib.error
import re
import json
import time
import os
from dataclasses import dataclass, asdict
from typing import Optional, List
from datetime import datetime

from movie_catalog import MOVIE_CATALOG
from improved_parser import parse_screenplay_from_html, analyze_characters


@dataclass
class ScriptAssessment:
    """Assessment result for a single movie script."""
    title: str
    year: int
    imsdb_slug: str
    tmdb_id: int

    # Availability
    imsdb_available: bool = False
    imsdb_content_length: int = 0

    # Parsing results
    dialogue_count: int = 0
    character_count: int = 0
    main_characters: int = 0  # Characters with 20+ lines

    # Quality metrics
    has_title_cruft: bool = False
    has_parsing_errors: bool = False
    avg_dialogue_length: float = 0.0
    quality_score: str = "unknown"  # excellent, good, fair, poor, unavailable

    # Top characters
    top_characters: List[str] = None

    # Error info
    error: Optional[str] = None

    def __post_init__(self):
        if self.top_characters is None:
            self.top_characters = []


def check_imsdb_availability(slug: str) -> tuple[bool, int, str]:
    """
    Check if a script is available on IMSDB and has content.

    Returns:
        (available, content_length, raw_html)
    """
    url = f"https://imsdb.com/scripts/{slug}.html"

    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        with urllib.request.urlopen(req, timeout=15) as response:
            html = response.read().decode('iso-8859-1')

        # Check if the pre tag has content
        pre_match = re.search(r'class="scrtext".*?<pre>(.*?)</pre>', html, re.DOTALL | re.IGNORECASE)

        if pre_match:
            content = pre_match.group(1).strip()
            # Check if it has substantial content (not just empty or minimal)
            if len(content) > 1000:  # At least 1KB of script content
                return True, len(content), html
            else:
                return False, len(content), html

        return False, 0, html

    except urllib.error.HTTPError as e:
        return False, 0, f"HTTP Error: {e.code}"
    except urllib.error.URLError as e:
        return False, 0, f"URL Error: {e.reason}"
    except Exception as e:
        return False, 0, f"Error: {str(e)}"


def assess_parsing_quality(dialogues: list, title: str) -> dict:
    """
    Assess the quality of parsed dialogues.

    Returns dict with quality metrics.
    """
    if not dialogues:
        return {
            "quality_score": "unavailable",
            "has_title_cruft": False,
            "has_parsing_errors": False,
            "avg_dialogue_length": 0,
        }

    # Check for title/credit cruft in first 10 dialogues
    title_words = set(title.upper().split())
    cruft_patterns = ['WRITTEN', 'BY', 'SCREENPLAY', 'DIRECTED', 'PRODUCED',
                      'TITLE', 'CARD', 'SCREEN', 'FADE IN', 'LUCASFILM']

    has_cruft = False
    for d in dialogues[:10]:
        char_upper = d.character.upper()
        # Check if character name contains title words or cruft patterns
        if any(w in char_upper for w in title_words) or \
           any(p in char_upper for p in cruft_patterns):
            has_cruft = True
            break

    # Check for parsing errors (very long character names, etc.)
    has_errors = any(len(d.character) > 35 for d in dialogues)

    # Calculate average dialogue length
    avg_length = sum(len(d.text) for d in dialogues) / len(dialogues) if dialogues else 0

    # Character analysis
    char_counts = {}
    for d in dialogues:
        char_counts[d.character] = char_counts.get(d.character, 0) + 1

    main_chars = len([c for c, n in char_counts.items() if n >= 20])
    total_chars = len(char_counts)

    # Quality score
    if not dialogues:
        score = "unavailable"
    elif has_errors and has_cruft:
        score = "poor"
    elif has_errors or has_cruft:
        score = "fair"
    elif main_chars >= 3 and avg_length > 30:
        score = "excellent"
    elif main_chars >= 2:
        score = "good"
    else:
        score = "fair"

    return {
        "quality_score": score,
        "has_title_cruft": has_cruft,
        "has_parsing_errors": has_errors,
        "avg_dialogue_length": round(avg_length, 1),
        "main_characters": main_chars,
        "character_count": total_chars,
    }


def assess_movie(title: str, year: int, imsdb_slug: str, tmdb_id: int,
                 verbose: bool = False) -> ScriptAssessment:
    """
    Fully assess a movie's script availability and parsing quality.
    """
    assessment = ScriptAssessment(
        title=title,
        year=year,
        imsdb_slug=imsdb_slug,
        tmdb_id=tmdb_id,
    )

    if verbose:
        print(f"  Checking: {title} ({year})...", end=" ", flush=True)

    # Check IMSDB
    available, content_len, html = check_imsdb_availability(imsdb_slug)

    assessment.imsdb_available = available
    assessment.imsdb_content_length = content_len

    if not available:
        assessment.quality_score = "unavailable"
        if verbose:
            print("NOT AVAILABLE")
        return assessment

    # Try parsing
    try:
        dialogues = parse_screenplay_from_html(html)
        assessment.dialogue_count = len(dialogues)

        if dialogues:
            # Analyze characters
            char_counts = analyze_characters(dialogues)
            assessment.character_count = len(char_counts)
            assessment.top_characters = list(char_counts.keys())[:10]

            # Quality assessment
            quality = assess_parsing_quality(dialogues, title)
            assessment.quality_score = quality["quality_score"]
            assessment.has_title_cruft = quality["has_title_cruft"]
            assessment.has_parsing_errors = quality["has_parsing_errors"]
            assessment.avg_dialogue_length = quality["avg_dialogue_length"]
            assessment.main_characters = quality["main_characters"]

        if verbose:
            print(f"{assessment.dialogue_count} lines, {assessment.quality_score}")

    except Exception as e:
        assessment.error = str(e)
        assessment.quality_score = "error"
        if verbose:
            print(f"ERROR: {e}")

    return assessment


def run_full_assessment(verbose: bool = True, delay: float = 0.5) -> List[ScriptAssessment]:
    """
    Run assessment on all 100 movies in the catalog.

    Args:
        verbose: Print progress
        delay: Delay between requests (be nice to servers)

    Returns:
        List of ScriptAssessment objects
    """
    results = []

    print(f"\n{'='*70}")
    print(f"  SCRIPT AVAILABILITY ASSESSMENT - {len(MOVIE_CATALOG)} Movies")
    print(f"{'='*70}\n")

    for i, (title, year, slug, tmdb_id) in enumerate(MOVIE_CATALOG, 1):
        print(f"[{i:3}/{len(MOVIE_CATALOG)}]", end=" ")

        assessment = assess_movie(title, year, slug, tmdb_id, verbose=True)
        results.append(assessment)

        # Be nice to the server
        if delay > 0:
            time.sleep(delay)

    return results


def generate_report(results: List[ScriptAssessment], output_dir: str = "output"):
    """
    Generate comprehensive report from assessment results.
    """
    os.makedirs(output_dir, exist_ok=True)

    # Summary stats
    available = [r for r in results if r.imsdb_available]
    excellent = [r for r in results if r.quality_score == "excellent"]
    good = [r for r in results if r.quality_score == "good"]
    fair = [r for r in results if r.quality_score == "fair"]
    poor = [r for r in results if r.quality_score == "poor"]
    unavailable = [r for r in results if r.quality_score == "unavailable"]
    errors = [r for r in results if r.quality_score == "error"]

    report = []
    report.append("# Script Availability Assessment Report")
    report.append(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"\n## Summary\n")
    report.append(f"- **Total Movies Assessed:** {len(results)}")
    report.append(f"- **Scripts Available:** {len(available)} ({len(available)*100//len(results)}%)")
    report.append(f"- **Excellent Quality:** {len(excellent)}")
    report.append(f"- **Good Quality:** {len(good)}")
    report.append(f"- **Fair Quality:** {len(fair)}")
    report.append(f"- **Poor Quality:** {len(poor)}")
    report.append(f"- **Unavailable:** {len(unavailable)}")
    report.append(f"- **Errors:** {len(errors)}")

    # Quality breakdown
    report.append(f"\n## Quality Breakdown\n")

    for quality, movies in [("Excellent", excellent), ("Good", good),
                            ("Fair", fair), ("Poor", poor)]:
        if movies:
            report.append(f"\n### {quality} Quality ({len(movies)} movies)\n")
            report.append("| Movie | Year | Lines | Characters | Main Chars | Top Characters |")
            report.append("|-------|------|-------|------------|------------|----------------|")
            for r in sorted(movies, key=lambda x: -x.dialogue_count):
                top_chars = ", ".join(r.top_characters[:5]) if r.top_characters else "N/A"
                report.append(f"| {r.title} | {r.year} | {r.dialogue_count} | {r.character_count} | {r.main_characters} | {top_chars} |")

    # Unavailable scripts
    report.append(f"\n## Unavailable Scripts ({len(unavailable)} movies)\n")
    report.append("These scripts are not available on IMSDB and need alternative sources:\n")
    for r in sorted(unavailable, key=lambda x: x.title):
        report.append(f"- {r.title} ({r.year})")

    # Save report
    report_path = os.path.join(output_dir, "ASSESSMENT_REPORT.md")
    with open(report_path, 'w') as f:
        f.write('\n'.join(report))
    print(f"\nReport saved to: {report_path}")

    # Save JSON data
    json_path = os.path.join(output_dir, "assessment_results.json")
    with open(json_path, 'w') as f:
        json.dump([asdict(r) for r in results], f, indent=2)
    print(f"JSON data saved to: {json_path}")

    return report_path


def print_summary(results: List[ScriptAssessment]):
    """Print a quick summary to console."""
    print(f"\n{'='*70}")
    print("  SUMMARY")
    print(f"{'='*70}")

    available = len([r for r in results if r.imsdb_available])
    excellent = len([r for r in results if r.quality_score == "excellent"])
    good = len([r for r in results if r.quality_score == "good"])
    fair = len([r for r in results if r.quality_score == "fair"])
    poor = len([r for r in results if r.quality_score == "poor"])
    unavailable = len([r for r in results if r.quality_score == "unavailable"])

    print(f"\n  Total Movies: {len(results)}")
    print(f"  Available on IMSDB: {available} ({available*100//len(results)}%)")
    print(f"\n  Quality Distribution:")
    print(f"    Excellent: {excellent}")
    print(f"    Good:      {good}")
    print(f"    Fair:      {fair}")
    print(f"    Poor:      {poor}")
    print(f"    Unavailable: {unavailable}")

    # Top available scripts by dialogue count
    available_scripts = [r for r in results if r.dialogue_count > 0]
    available_scripts.sort(key=lambda x: -x.dialogue_count)

    print(f"\n  Top 10 Available Scripts by Dialogue Count:")
    for i, r in enumerate(available_scripts[:10], 1):
        print(f"    {i:2}. {r.title} ({r.year}): {r.dialogue_count} lines, {r.main_characters} main chars")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Assess script availability for all movies")
    parser.add_argument("--quick", action="store_true", help="Quick mode - first 10 movies only")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between requests")
    args = parser.parse_args()

    if args.quick:
        # Quick test with first 10 movies
        from movie_catalog import MOVIE_CATALOG
        test_catalog = MOVIE_CATALOG[:10]
        results = []
        for title, year, slug, tmdb_id in test_catalog:
            print(f"Testing: {title}...", end=" ", flush=True)
            assessment = assess_movie(title, year, slug, tmdb_id, verbose=False)
            print(f"{assessment.quality_score}")
            results.append(assessment)
            time.sleep(args.delay)
    else:
        # Full assessment
        results = run_full_assessment(verbose=True, delay=args.delay)

    print_summary(results)
    generate_report(results)
