#!/usr/bin/env python3
"""
Improved IMSDB Parser - Uses HTML structure to better identify dialogue

Key insight: IMSDB wraps character names in <b> tags within <pre> blocks.
The structure is:
  <b>                  CHARACTER NAME</b>
                       Dialogue line 1
                       Dialogue line 2
  <b>                                      (parenthetical)</b>
                       More dialogue

Scene headers are also in <b> but follow patterns like:
  <b>INT. LOCATION - TIME</b>
  <b>EXT. LOCATION - TIME</b>

This parser directly extracts from the HTML to get cleaner results.
"""

import re
import urllib.request
from dataclasses import dataclass
from typing import Optional
import json
import os


@dataclass
class DialogueLine:
    character: str
    text: str
    parenthetical: Optional[str] = None


def fetch_raw_html(script_name: str) -> str:
    """Fetch raw HTML from IMSDB."""
    url = f"https://imsdb.com/scripts/{script_name}.html"
    print(f"Fetching: {url}")

    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })

    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode('iso-8859-1')


def extract_pre_content(html: str) -> str:
    """Extract the script content from <pre> tags, preserving <b> tags."""
    # Find the main script pre block (usually contains class="scrtext")
    # The script is in the pre tag after class="scrtext"
    match = re.search(r'class="scrtext"[^>]*>.*?<pre>(.*?)</pre>', html, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1)

    # Fallback: find the longest pre block
    pre_blocks = re.findall(r'<pre[^>]*>(.*?)</pre>', html, re.DOTALL | re.IGNORECASE)
    if pre_blocks:
        return max(pre_blocks, key=len)

    return ""


def parse_screenplay_from_html(html: str) -> list[DialogueLine]:
    """
    Parse screenplay from HTML, using <b> tags to identify structure.

    Strategy:
    1. Extract content from <pre> block
    2. Use <b> tags to identify character names and scene headers
    3. Character names: <b> tag content that is centered and doesn't look like a scene header
    4. Scene headers: <b> content matching INT./EXT. patterns
    """
    pre_content = extract_pre_content(html)
    if not pre_content:
        print("WARNING: Could not find pre content")
        return []

    dialogues = []
    current_character = None
    current_dialogue = []
    current_parenthetical = None

    # Scene header patterns
    scene_patterns = [
        r'^(INT\.|EXT\.|INT/EXT|INTERIOR|EXTERIOR)',
        r'^(FADE IN|FADE OUT|FADE TO|CUT TO|DISSOLVE|THE END)',
        r'^(CONTINUED|CONT\'D|MORE)',
        r'^\d+\.\s+(INT\.|EXT\.)',  # Numbered scenes
    ]
    scene_regex = re.compile('|'.join(scene_patterns), re.IGNORECASE)

    # Split by <b> tags to find structure
    # Pattern: text before <b>, content in <b>, repeat
    parts = re.split(r'<b>(.*?)</b>', pre_content, flags=re.DOTALL)

    i = 0
    while i < len(parts):
        if i % 2 == 0:
            # This is text content (dialogue or action)
            text = parts[i]
            lines = text.split('\n')

            for line in lines:
                stripped = line.strip()
                if not stripped:
                    # Save dialogue on blank line
                    if current_character and current_dialogue:
                        full_text = ' '.join(current_dialogue).strip()
                        if full_text and len(full_text) > 1:
                            dialogues.append(DialogueLine(
                                character=current_character,
                                text=full_text,
                                parenthetical=current_parenthetical
                            ))
                        current_dialogue = []
                        current_parenthetical = None
                    continue

                # Check if this looks like dialogue (indented)
                leading_spaces = len(line) - len(line.lstrip())

                if current_character and leading_spaces >= 5:
                    # Skip parentheticals
                    if stripped.startswith('(') and stripped.endswith(')'):
                        current_parenthetical = stripped[1:-1]
                        continue

                    # Skip if it looks like stage direction (all caps, short)
                    if stripped.isupper() and len(stripped.split()) <= 3:
                        continue

                    # This is dialogue
                    current_dialogue.append(stripped)

        else:
            # This is bold content - could be character name or scene header
            bold_content = parts[i].strip()

            # Skip if it's a scene header
            if scene_regex.search(bold_content):
                current_character = None
                current_dialogue = []
                i += 1
                continue

            # Skip if it's clearly not a character name
            if not bold_content or len(bold_content) > 60:
                i += 1
                continue

            # Check if it looks like a character name:
            # - Mostly uppercase letters
            # - Possibly with (V.O.) or (O.S.) annotations
            # - Centered (has leading whitespace in original)
            clean_name = re.sub(r'\s*\([^)]*\)\s*', '', bold_content).strip()

            # Skip common non-character patterns
            skip_patterns = [
                r'^[\s\-]+$',  # Just whitespace/dashes
                r'^\d+$',  # Just numbers
                r'^(TITLE|CARD|SCREEN|CREDIT)',
                r'^(MONTAGE|SEQUENCE|SERIES)',
                r'^\#',  # Comments
                r'^(ANGLE|SHOT|VIEW|POV|CLOSE|WIDE|MEDIUM)',
                r'^(LATER|SAME|BACK|RESUME)',
                r'^(THE END|FINIS)',
                r'LUCASFILM',
                r'JOURNAL',
                r'EPISODE',
                r'NEW HOPE',
            ]
            if any(re.search(p, clean_name, re.IGNORECASE) for p in skip_patterns):
                i += 1
                continue

            # Check if it's uppercase and reasonable length
            if clean_name and clean_name.isupper() and 2 <= len(clean_name) <= 40:
                # Save previous dialogue
                if current_character and current_dialogue:
                    full_text = ' '.join(current_dialogue).strip()
                    if full_text and len(full_text) > 1:
                        dialogues.append(DialogueLine(
                            character=current_character,
                            text=full_text,
                            parenthetical=current_parenthetical
                        ))

                current_character = clean_name
                current_dialogue = []
                current_parenthetical = None

        i += 1

    # Don't forget the last dialogue
    if current_character and current_dialogue:
        full_text = ' '.join(current_dialogue).strip()
        if full_text and len(full_text) > 1:
            dialogues.append(DialogueLine(
                character=current_character,
                text=full_text,
                parenthetical=current_parenthetical
            ))

    return dialogues


def analyze_characters(dialogues: list[DialogueLine]) -> dict:
    """Analyze character distribution in dialogues."""
    char_counts = {}
    for d in dialogues:
        char_counts[d.character] = char_counts.get(d.character, 0) + 1

    return dict(sorted(char_counts.items(), key=lambda x: -x[1]))


def save_script(movie_id: str, title: str, year: int, dialogues: list[DialogueLine], output_dir: str = "output"):
    """Save parsed dialogue to JSON format compatible with the game."""
    os.makedirs(output_dir, exist_ok=True)

    # Get unique characters sorted alphabetically
    characters = sorted(set(d.character for d in dialogues))

    # Convert to game format
    lines = [{"character": d.character, "text": d.text} for d in dialogues]

    data = {
        "id": movie_id,
        "title": title,
        "year": year,
        "characters": characters,
        "lines": lines
    }

    output_path = os.path.join(output_dir, f"{movie_id}.json")
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(lines)} dialogue lines from {len(characters)} characters to {output_path}")
    return data


def test_parse_movie(imsdb_slug: str, movie_id: str, title: str, year: int):
    """Test parsing a single movie."""
    print(f"\n{'='*60}")
    print(f"Testing: {title} ({year})")
    print(f"{'='*60}")

    html = fetch_raw_html(imsdb_slug)
    dialogues = parse_screenplay_from_html(html)

    print(f"\nExtracted {len(dialogues)} dialogue lines")

    # Analyze characters
    char_counts = analyze_characters(dialogues)
    print(f"\nTop 15 characters by line count:")
    for char, count in list(char_counts.items())[:15]:
        print(f"  {char}: {count} lines")

    # Show sample dialogues
    print(f"\nSample dialogues:")
    for d in dialogues[:5]:
        print(f"  {d.character}: {d.text[:70]}...")

    # Save
    save_script(movie_id, title, year, dialogues)

    return dialogues


if __name__ == "__main__":
    # Test multiple movies
    test_movies = [
        ("Star-Wars-A-New-Hope", "star-wars-a-new-hope", "Star Wars: Episode IV - A New Hope", 1977),
        ("Breakfast-Club,-The", "breakfast-club", "The Breakfast Club", 1985),
        ("Ferris-Buellers-Day-Off", "ferris-buellers-day-off", "Ferris Bueller's Day Off", 1986),
        ("Princess-Bride,-The", "princess-bride", "The Princess Bride", 1987),
    ]

    for imsdb_slug, movie_id, title, year in test_movies:
        try:
            test_parse_movie(imsdb_slug, movie_id, title, year)
        except Exception as e:
            print(f"ERROR parsing {title}: {e}")
