#!/usr/bin/env python3
"""
Script Fetcher - Downloads movie scripts from IMSDB

IMSDB Format Analysis:
- Scripts are in HTML files with <pre> tags containing the screenplay text
- Character names are wrapped in <b> tags and appear centered/uppercase
- Dialogue follows character names with consistent indentation
- Scene headers (INT./EXT.) are also in <b> tags but ALL CAPS with location

Example URL patterns:
- https://imsdb.com/scripts/Star-Wars-A-New-Hope.html
- https://imsdb.com/scripts/Breakfast-Club,-The.html
- https://imsdb.com/scripts/Ferris-Buellers-Day-Off.html
"""

import re
import urllib.request
from html.parser import HTMLParser
from dataclasses import dataclass
from typing import Optional
import json
import os


@dataclass
class DialogueLine:
    character: str
    text: str
    parenthetical: Optional[str] = None


class IMSDBParser(HTMLParser):
    """Parse IMSDB HTML to extract script text from <pre> tags."""

    def __init__(self):
        super().__init__()
        self.in_pre = False
        self.in_script_pre = False
        self.script_text = []
        self.pre_count = 0

    def handle_starttag(self, tag, attrs):
        if tag == 'pre':
            self.pre_count += 1
            if self.pre_count >= 1:  # Script content is in the pre tag
                self.in_pre = True

    def handle_endtag(self, tag):
        if tag == 'pre' and self.in_pre:
            self.in_pre = False

    def handle_data(self, data):
        if self.in_pre:
            self.script_text.append(data)

    def get_script(self) -> str:
        return ''.join(self.script_text)


def fetch_imsdb_script(script_name: str) -> str:
    """
    Fetch a script from IMSDB.

    Args:
        script_name: The URL-friendly script name (e.g., "Star-Wars-A-New-Hope")

    Returns:
        Raw script text extracted from HTML
    """
    url = f"https://imsdb.com/scripts/{script_name}.html"

    print(f"Fetching: {url}")

    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })

    with urllib.request.urlopen(req, timeout=30) as response:
        html = response.read().decode('iso-8859-1')

    # Parse HTML to extract script from <pre> tags
    parser = IMSDBParser()
    parser.feed(html)

    return parser.get_script()


def parse_screenplay_dialogue(script_text: str) -> list[DialogueLine]:
    """
    Parse screenplay format to extract dialogue.

    IMSDB screenplay format characteristics:
    1. Character names: Centered, UPPERCASE, often in bold
    2. Dialogue: Indented below character name
    3. Parentheticals: (in parentheses) between character and dialogue
    4. Scene headers: INT./EXT. followed by location
    5. Action lines: Full-width, describe what happens

    This uses heuristics - for production use, consider LLM-based parsing.
    """
    lines = script_text.split('\n')
    dialogues = []

    current_character = None
    current_dialogue = []
    current_parenthetical = None

    # Patterns for screenplay elements
    scene_pattern = re.compile(r'^\s*(INT\.|EXT\.|INT/EXT\.)', re.IGNORECASE)
    # Character names: centered text that's uppercase, no numbers in weird places
    character_pattern = re.compile(r'^[\s]{15,}([A-Z][A-Z\s\'\-\.]+?)(?:\s*\(.*?\))?\s*$')
    # Parenthetical direction
    parenthetical_pattern = re.compile(r'^[\s]{15,}\(([^)]+)\)\s*$')
    # Dialogue line - indented but not as much as character name
    dialogue_pattern = re.compile(r'^[\s]{10,40}(.+)$')
    # Transition (CUT TO:, FADE, etc.)
    transition_pattern = re.compile(r'^[\s]*(CUT TO:|FADE|DISSOLVE|SMASH CUT)', re.IGNORECASE)

    # Skip these as character names
    skip_names = {
        'CUT TO', 'FADE IN', 'FADE OUT', 'DISSOLVE', 'THE END',
        'CONTINUED', 'CONT\'D', 'MORE', 'BACK TO',
    }

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            # If we have a character and dialogue, save it
            if current_character and current_dialogue:
                full_text = ' '.join(current_dialogue).strip()
                if full_text:
                    dialogues.append(DialogueLine(
                        character=current_character,
                        text=full_text,
                        parenthetical=current_parenthetical
                    ))
                current_dialogue = []
                current_parenthetical = None
            continue

        # Skip scene headers
        if scene_pattern.match(line):
            current_character = None
            current_dialogue = []
            continue

        # Skip transitions
        if transition_pattern.match(line):
            continue

        # Check for character name
        char_match = character_pattern.match(line)
        if char_match:
            # Save previous dialogue if exists
            if current_character and current_dialogue:
                full_text = ' '.join(current_dialogue).strip()
                if full_text:
                    dialogues.append(DialogueLine(
                        character=current_character,
                        text=full_text,
                        parenthetical=current_parenthetical
                    ))

            potential_char = char_match.group(1).strip()

            # Validate character name
            if (potential_char not in skip_names and
                len(potential_char) > 1 and
                len(potential_char) < 50 and
                not scene_pattern.match(potential_char) and
                potential_char.isupper()):

                current_character = potential_char
                current_dialogue = []
                current_parenthetical = None
            continue

        # Check for parenthetical
        paren_match = parenthetical_pattern.match(line)
        if paren_match and current_character:
            current_parenthetical = paren_match.group(1).strip()
            continue

        # Check for dialogue line
        if current_character:
            dial_match = dialogue_pattern.match(line)
            if dial_match:
                text = dial_match.group(1).strip()
                # Skip if it looks like stage direction (in parens)
                if not (text.startswith('(') and text.endswith(')')):
                    # Also skip single-word scene elements
                    if not (text.isupper() and len(text.split()) <= 3):
                        current_dialogue.append(text)

    # Don't forget the last dialogue
    if current_character and current_dialogue:
        full_text = ' '.join(current_dialogue).strip()
        if full_text:
            dialogues.append(DialogueLine(
                character=current_character,
                text=full_text,
                parenthetical=current_parenthetical
            ))

    return dialogues


def save_script(script_name: str, dialogues: list[DialogueLine], output_dir: str = "output"):
    """Save parsed dialogue to JSON format compatible with the game."""
    os.makedirs(output_dir, exist_ok=True)

    # Get unique characters
    characters = sorted(set(d.character for d in dialogues))

    # Convert to game format
    lines = [{"character": d.character, "text": d.text} for d in dialogues]

    data = {
        "id": script_name.lower().replace(' ', '-'),
        "title": script_name.replace('-', ' '),
        "characters": characters,
        "lines": lines
    }

    output_path = os.path.join(output_dir, f"{data['id']}.json")
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(lines)} dialogue lines from {len(characters)} characters to {output_path}")
    return data


if __name__ == "__main__":
    # Test with Star Wars
    script_text = fetch_imsdb_script("Star-Wars-A-New-Hope")
    dialogues = parse_screenplay_dialogue(script_text)

    print(f"\nExtracted {len(dialogues)} dialogue lines")
    print("\nFirst 10 dialogues:")
    for d in dialogues[:10]:
        print(f"  {d.character}: {d.text[:60]}...")

    save_script("star-wars-a-new-hope", dialogues)
