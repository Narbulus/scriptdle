#!/usr/bin/env python3
"""
LLM-Based Script Parser

This module provides an alternative parsing approach using Claude/LLM to extract
clean dialogue from screenplay text. This is more reliable than regex-based parsing
because:

1. LLMs understand context - they can distinguish between:
   - Actual dialogue: "LUKE: Where are you going?"
   - Narrative with quotes: 'Lucy says "where have you been" and continues cooking'

2. LLMs handle format variations - screenplays vary in formatting:
   - Some use TAB indentation, others use spaces
   - Character names may have (V.O.), (O.S.), (CONT'D) annotations
   - Parenthetical directions appear differently

3. LLMs can normalize character names:
   - "THREEPIO" and "C-3PO" -> consistent name
   - "BEN" and "OBI-WAN" -> appropriate name

USAGE:
    This module is designed to be used with Claude Code or the Anthropic API.
    See the prompt templates below for extraction instructions.

WORKFLOW:
    1. Fetch raw script HTML from IMSDB
    2. Extract pre-formatted text
    3. Split into chunks (LLMs have context limits)
    4. Send each chunk to LLM with extraction prompt
    5. Parse LLM JSON output
    6. Combine and deduplicate
"""

import json
import re
from typing import Optional


# Prompt for extracting dialogue from screenplay text
DIALOGUE_EXTRACTION_PROMPT = """You are a screenplay parser. Extract ONLY the spoken dialogue from this screenplay excerpt.

RULES:
1. Extract ONLY actual spoken dialogue - words characters say out loud
2. DO NOT include:
   - Stage directions or action descriptions
   - Parenthetical acting directions like "(sighing)" or "(angrily)"
   - Scene headers (INT./EXT.)
   - Narrative descriptions
   - Title cards or text shown on screen

3. Character names should be:
   - UPPERCASE
   - Normalized (e.g., "THREEPIO" not "C-3PO" unless that's more recognizable)
   - Without annotations like (V.O.), (O.S.), (CONT'D)

4. If a line contains both dialogue and stage direction, extract ONLY the dialogue part
   Example: 'Luke smiles. "I'll be fine."' -> Extract only: "I'll be fine."

5. Combine multi-line dialogue into single entries

Output JSON array format:
[
  {"character": "CHARACTER NAME", "text": "The actual dialogue text"},
  ...
]

Only output valid JSON. No explanations.

SCREENPLAY EXCERPT:
---
{screenplay_text}
---

JSON OUTPUT:"""


# Prompt for identifying main characters
CHARACTER_IDENTIFICATION_PROMPT = """Analyze this list of character names from a screenplay and identify:

1. MAIN CHARACTERS: Characters essential to the story (typically 5-15)
2. SUPPORTING CHARACTERS: Named characters with multiple scenes (typically 5-10)
3. MINOR/EXTRAS: Background characters, unnamed people, groups

Also normalize character names where appropriate:
- "THREEPIO" and "C-THREEPIO" should be unified
- "BEN" might be better as "OBI-WAN KENOBI" for Star Wars
- Remove suffixes like "'S VOICE" unless distinct character

CHARACTER NAMES AND LINE COUNTS:
{character_data}

Output JSON:
{{
  "main_characters": ["NAME1", "NAME2", ...],
  "supporting_characters": ["NAME1", "NAME2", ...],
  "character_mappings": {{"OLD_NAME": "CANONICAL_NAME", ...}},
  "exclude": ["MINOR1", "EXTRA2", ...]
}}

JSON OUTPUT:"""


def chunk_screenplay(text: str, chunk_size: int = 4000, overlap: int = 200) -> list[str]:
    """
    Split screenplay into chunks for LLM processing.

    Args:
        text: Raw screenplay text
        chunk_size: Target chunk size in characters
        overlap: Overlap between chunks to avoid cutting dialogue

    Returns:
        List of text chunks
    """
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        # Try to break at a scene boundary or blank line
        if end < len(text):
            # Look for scene header or double newline
            search_start = max(start + chunk_size - overlap, start)
            search_text = text[search_start:end + overlap]

            # Find best break point
            scene_match = re.search(r'\n\s*(INT\.|EXT\.)', search_text)
            blank_match = re.search(r'\n\s*\n', search_text)

            if scene_match:
                end = search_start + scene_match.start()
            elif blank_match:
                end = search_start + blank_match.start()

        chunks.append(text[start:end].strip())
        start = end - overlap if end < len(text) else end

    return chunks


def parse_llm_response(response: str) -> list[dict]:
    """
    Parse LLM response to extract dialogue list.

    Handles cases where LLM adds explanation text around JSON.
    """
    # Try to find JSON array in response
    json_match = re.search(r'\[[\s\S]*\]', response)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Try parsing entire response as JSON
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        print(f"WARNING: Could not parse LLM response as JSON")
        return []


def create_extraction_prompt(screenplay_chunk: str) -> str:
    """Create the full prompt for dialogue extraction."""
    return DIALOGUE_EXTRACTION_PROMPT.format(screenplay_text=screenplay_chunk)


def create_character_prompt(character_counts: dict) -> str:
    """Create prompt for character identification."""
    char_data = "\n".join(f"- {name}: {count} lines" for name, count in
                          sorted(character_counts.items(), key=lambda x: -x[1]))
    return CHARACTER_IDENTIFICATION_PROMPT.format(character_data=char_data)


# Example workflow for manual testing with Claude Code
MANUAL_WORKFLOW = """
# LLM-Based Screenplay Parsing Workflow

## Step 1: Fetch and prepare the script
```python
from improved_parser import fetch_raw_html, extract_pre_content
html = fetch_raw_html("Star-Wars-A-New-Hope")
raw_text = extract_pre_content(html)
```

## Step 2: Create chunks
```python
from llm_parser import chunk_screenplay
chunks = chunk_screenplay(raw_text, chunk_size=3000)
print(f"Created {len(chunks)} chunks")
```

## Step 3: For each chunk, use Claude to extract dialogue
Send this to Claude:

---
{extraction_prompt}
---

## Step 4: Combine all results
```python
all_dialogues = []
for response in llm_responses:
    dialogues = parse_llm_response(response)
    all_dialogues.extend(dialogues)
```

## Step 5: Identify main characters
Send the character counts to Claude with CHARACTER_IDENTIFICATION_PROMPT

## Step 6: Filter and save
Keep only main/supporting characters, normalize names, save to JSON
"""


def demo_chunk_script():
    """Demo: show how to chunk a script for LLM processing."""
    try:
        from improved_parser import fetch_raw_html, extract_pre_content

        html = fetch_raw_html("Star-Wars-A-New-Hope")
        raw_text = extract_pre_content(html)

        chunks = chunk_screenplay(raw_text, chunk_size=3000)

        print(f"Script length: {len(raw_text)} characters")
        print(f"Created {len(chunks)} chunks for LLM processing")
        print(f"\nChunk sizes: {[len(c) for c in chunks]}")

        print("\n" + "="*60)
        print("EXAMPLE: First chunk (truncated)")
        print("="*60)
        print(chunks[0][:500] + "...")

        print("\n" + "="*60)
        print("EXTRACTION PROMPT EXAMPLE")
        print("="*60)
        example_prompt = create_extraction_prompt(chunks[0][:1000])
        print(example_prompt[:1500] + "...")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    print("LLM-Based Screenplay Parser")
    print("="*60)
    print()
    print("This module provides prompts and utilities for using LLMs")
    print("to extract clean dialogue from screenplays.")
    print()
    print("Key features:")
    print("- Handles format variations in screenplays")
    print("- Distinguishes spoken dialogue from narrative")
    print("- Normalizes character names")
    print()

    demo_chunk_script()
