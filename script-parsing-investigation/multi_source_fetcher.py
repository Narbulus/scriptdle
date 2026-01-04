#!/usr/bin/env python3
"""
Multi-Source Script Fetcher

Fetches movie scripts from multiple sources and verifies their availability.
This tool is designed for validation purposes - it fetches scripts on-demand
and stores metadata about their availability.

Sources supported:
- IMSDB (HTML)
- Daily Script (HTML)
- Awesome Film (TXT)
- Script Slug (PDF)

For PDF parsing, requires: pip install pymupdf
"""

import urllib.request
import urllib.error
import re
import json
import os
import time
from dataclasses import dataclass
from typing import Optional, List, Tuple
from datetime import datetime

# Try to import PDF library
try:
    import fitz  # pymupdf
    HAS_PDF = True
except ImportError:
    HAS_PDF = False
    print("Note: pymupdf not installed. PDF parsing disabled.")
    print("Install with: pip install pymupdf")


@dataclass
class FetchResult:
    """Result of fetching a script from a source."""
    source: str
    url: str
    success: bool
    content_type: str  # html, txt, pdf
    content_length: int
    dialogue_count: int = 0
    character_count: int = 0
    sample_characters: List[str] = None
    error: Optional[str] = None

    def __post_init__(self):
        if self.sample_characters is None:
            self.sample_characters = []


def fetch_url(url: str, timeout: int = 30) -> Tuple[bool, bytes, str]:
    """
    Fetch content from a URL.

    Returns: (success, content_bytes, error_message)
    """
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

        with urllib.request.urlopen(req, timeout=timeout) as response:
            content = response.read()
            return True, content, ""

    except urllib.error.HTTPError as e:
        return False, b"", f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return False, b"", f"URL Error: {e.reason}"
    except Exception as e:
        return False, b"", str(e)


def parse_imsdb_html(html: str) -> Tuple[List[dict], List[str]]:
    """
    Parse IMSDB HTML format to extract dialogues.

    Returns: (dialogues, characters)
    """
    # Extract pre content
    pre_match = re.search(r'class="scrtext".*?<pre>(.*?)</pre>', html, re.DOTALL | re.IGNORECASE)
    if not pre_match:
        # Try fallback
        pre_blocks = re.findall(r'<pre[^>]*>(.*?)</pre>', html, re.DOTALL | re.IGNORECASE)
        if pre_blocks:
            pre_content = max(pre_blocks, key=len)
        else:
            return [], []
    else:
        pre_content = pre_match.group(1)

    dialogues = []
    characters = set()
    current_char = None
    current_text = []

    # Scene header patterns to skip
    scene_pattern = re.compile(r'^(INT\.|EXT\.|INT/EXT|FADE|CUT TO|DISSOLVE)', re.IGNORECASE)

    # Split by bold tags
    parts = re.split(r'<b>(.*?)</b>', pre_content, flags=re.DOTALL)

    for i, part in enumerate(parts):
        if i % 2 == 1:  # Bold content
            clean = part.strip()
            # Skip scene headers
            if scene_pattern.match(clean):
                if current_char and current_text:
                    text = ' '.join(current_text).strip()
                    if text:
                        dialogues.append({"character": current_char, "text": text})
                current_char = None
                current_text = []
                continue

            # Check if character name
            name = re.sub(r'\s*\([^)]*\)\s*', '', clean).strip()
            if name and name.isupper() and 2 <= len(name) <= 40:
                # Save previous dialogue
                if current_char and current_text:
                    text = ' '.join(current_text).strip()
                    if text:
                        dialogues.append({"character": current_char, "text": text})
                        characters.add(current_char)

                current_char = name
                current_text = []
        else:  # Regular content (dialogue)
            if current_char:
                lines = part.split('\n')
                for line in lines:
                    stripped = line.strip()
                    if stripped and not stripped.startswith('('):
                        # Skip stage directions
                        if not (stripped.isupper() and len(stripped.split()) <= 3):
                            current_text.append(stripped)

    # Don't forget last dialogue
    if current_char and current_text:
        text = ' '.join(current_text).strip()
        if text:
            dialogues.append({"character": current_char, "text": text})
            characters.add(current_char)

    return dialogues, sorted(list(characters))


def parse_dailyscript_html(html: str) -> Tuple[List[dict], List[str]]:
    """
    Parse Daily Script HTML format.
    Similar to IMSDB but may have different structure.
    """
    # Try to extract from pre or body
    pre_match = re.search(r'<pre[^>]*>(.*?)</pre>', html, re.DOTALL | re.IGNORECASE)
    if pre_match:
        content = pre_match.group(1)
    else:
        # Extract body content
        body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
        if body_match:
            # Strip HTML tags
            content = re.sub(r'<[^>]+>', '\n', body_match.group(1))
        else:
            return [], []

    return parse_plain_text_script(content)


def parse_plain_text_script(text: str) -> Tuple[List[dict], List[str]]:
    """
    Parse plain text screenplay format.

    Looks for patterns like:
    CHARACTER NAME
        Dialogue text here

    Or:
    CHARACTER NAME: Dialogue text
    """
    dialogues = []
    characters = set()

    lines = text.split('\n')
    current_char = None
    current_text = []

    # Character name pattern (all caps, centered or at line start)
    char_pattern = re.compile(r'^[\s]{10,}([A-Z][A-Z\s\'\-\.]+)(?:\s*\(.*?\))?\s*$')
    # Alternative: CHARACTER: dialogue
    inline_pattern = re.compile(r'^([A-Z][A-Z\s\']+):\s*(.+)$')
    # Scene headers
    scene_pattern = re.compile(r'^[\s]*(INT\.|EXT\.|FADE|CUT TO|DISSOLVE)', re.IGNORECASE)

    skip_names = {'CUT TO', 'FADE IN', 'FADE OUT', 'THE END', 'CONTINUED'}

    for line in lines:
        stripped = line.strip()

        # Skip empty lines - save current dialogue
        if not stripped:
            if current_char and current_text:
                text = ' '.join(current_text).strip()
                if text and len(text) > 1:
                    dialogues.append({"character": current_char, "text": text})
                    characters.add(current_char)
                current_text = []
            continue

        # Skip scene headers
        if scene_pattern.match(line):
            current_char = None
            current_text = []
            continue

        # Check for inline pattern (CHARACTER: dialogue)
        inline_match = inline_pattern.match(stripped)
        if inline_match:
            char_name = inline_match.group(1).strip()
            dialogue = inline_match.group(2).strip()
            if char_name not in skip_names:
                dialogues.append({"character": char_name, "text": dialogue})
                characters.add(char_name)
            continue

        # Check for character name
        char_match = char_pattern.match(line)
        if char_match:
            name = char_match.group(1).strip()
            if name not in skip_names and len(name) >= 2:
                # Save previous
                if current_char and current_text:
                    text = ' '.join(current_text).strip()
                    if text and len(text) > 1:
                        dialogues.append({"character": current_char, "text": text})
                        characters.add(current_char)
                current_char = name
                current_text = []
                continue

        # Collect dialogue
        if current_char:
            leading = len(line) - len(line.lstrip())
            if 5 <= leading <= 50:
                if not (stripped.startswith('(') and stripped.endswith(')')):
                    current_text.append(stripped)

    # Final dialogue
    if current_char and current_text:
        text = ' '.join(current_text).strip()
        if text and len(text) > 1:
            dialogues.append({"character": current_char, "text": text})
            characters.add(current_char)

    return dialogues, sorted(list(characters))


def parse_pdf_script(pdf_bytes: bytes) -> Tuple[List[dict], List[str]]:
    """
    Parse PDF screenplay format using pymupdf.
    """
    if not HAS_PDF:
        return [], []

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text = ""

        for page in doc:
            full_text += page.get_text() + "\n"

        doc.close()

        return parse_plain_text_script(full_text)

    except Exception as e:
        print(f"PDF parsing error: {e}")
        return [], []


def fetch_and_parse_script(source_type: str, url: str) -> FetchResult:
    """
    Fetch a script from a source and parse it.
    """
    result = FetchResult(
        source=source_type,
        url=url,
        success=False,
        content_type="unknown",
        content_length=0
    )

    # Fetch content
    success, content, error = fetch_url(url)

    if not success:
        result.error = error
        return result

    result.content_length = len(content)

    # Determine content type and parse
    dialogues = []
    characters = []

    if url.endswith('.pdf') or source_type in ['scriptslug', 'screenplaydb']:
        result.content_type = "pdf"
        if HAS_PDF:
            dialogues, characters = parse_pdf_script(content)
        else:
            result.error = "PDF parsing not available (install pymupdf)"
            return result

    elif url.endswith('.txt') or source_type == 'awesomefilm':
        result.content_type = "txt"
        try:
            text = content.decode('utf-8', errors='replace')
            dialogues, characters = parse_plain_text_script(text)
        except Exception as e:
            result.error = f"Text parsing error: {e}"
            return result

    else:  # HTML
        result.content_type = "html"
        try:
            text = content.decode('iso-8859-1', errors='replace')
            if source_type == 'imsdb':
                dialogues, characters = parse_imsdb_html(text)
            else:
                dialogues, characters = parse_dailyscript_html(text)
        except Exception as e:
            result.error = f"HTML parsing error: {e}"
            return result

    if dialogues:
        result.success = True
        result.dialogue_count = len(dialogues)
        result.character_count = len(characters)
        result.sample_characters = characters[:10]
    else:
        result.error = "No dialogues extracted"

    return result


def test_all_sources(movie_sources: List[Tuple], delay: float = 0.3) -> List[dict]:
    """
    Test fetching from all sources for all movies.
    """
    results = []

    for movie_data in movie_sources:
        title, year, tmdb_id, imsdb_slug, alt_sources = movie_data

        movie_result = {
            "title": title,
            "year": year,
            "tmdb_id": tmdb_id,
            "sources_tested": [],
            "best_source": None,
            "best_dialogues": 0
        }

        print(f"\n{title} ({year}):")

        # Test IMSDB if available
        if imsdb_slug:
            url = f"https://imsdb.com/scripts/{imsdb_slug}.html"
            print(f"  Testing IMSDB...", end=" ", flush=True)

            result = fetch_and_parse_script("imsdb", url)
            movie_result["sources_tested"].append({
                "source": "imsdb",
                "url": url,
                "success": result.success,
                "dialogues": result.dialogue_count,
                "characters": result.character_count,
                "sample_chars": result.sample_characters,
                "error": result.error
            })

            if result.success:
                print(f"OK ({result.dialogue_count} lines, {result.character_count} chars)")
                if result.dialogue_count > movie_result["best_dialogues"]:
                    movie_result["best_source"] = "imsdb"
                    movie_result["best_dialogues"] = result.dialogue_count
            else:
                print(f"FAILED: {result.error}")

            time.sleep(delay)

        # Test alternative sources
        for source_type, url, fmt in alt_sources:
            print(f"  Testing {source_type}...", end=" ", flush=True)

            result = fetch_and_parse_script(source_type, url)
            movie_result["sources_tested"].append({
                "source": source_type,
                "url": url,
                "success": result.success,
                "dialogues": result.dialogue_count,
                "characters": result.character_count,
                "sample_chars": result.sample_characters,
                "error": result.error
            })

            if result.success:
                print(f"OK ({result.dialogue_count} lines, {result.character_count} chars)")
                if result.dialogue_count > movie_result["best_dialogues"]:
                    movie_result["best_source"] = source_type
                    movie_result["best_dialogues"] = result.dialogue_count
            else:
                print(f"FAILED: {result.error}")

            time.sleep(delay)

        results.append(movie_result)

    return results


def generate_validation_report(results: List[dict], output_path: str = "output/validation_report.json"):
    """Generate a validation report from test results."""

    # Summary stats
    total = len(results)
    with_source = len([r for r in results if r["best_source"]])
    no_source = total - with_source

    by_source = {}
    for r in results:
        if r["best_source"]:
            src = r["best_source"]
            by_source[src] = by_source.get(src, 0) + 1

    report = {
        "generated": datetime.now().isoformat(),
        "summary": {
            "total_movies": total,
            "movies_with_valid_source": with_source,
            "movies_without_source": no_source,
            "coverage_percent": round(with_source / total * 100, 1),
            "best_source_distribution": by_source
        },
        "movies": results
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\nReport saved to {output_path}")

    # Print summary
    print(f"\n{'='*60}")
    print("VALIDATION SUMMARY")
    print(f"{'='*60}")
    print(f"Total movies: {total}")
    print(f"With valid source: {with_source} ({with_source/total*100:.1f}%)")
    print(f"Without source: {no_source}")
    print(f"\nBest source distribution:")
    for src, count in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  {src}: {count}")

    return report


if __name__ == "__main__":
    from script_sources import MOVIE_SOURCE_INDEX

    print("Multi-Source Script Fetcher")
    print("=" * 60)
    print(f"Testing {len(MOVIE_SOURCE_INDEX)} movies from multiple sources...")

    results = test_all_sources(MOVIE_SOURCE_INDEX, delay=0.3)
    generate_validation_report(results)
