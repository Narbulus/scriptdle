#!/usr/bin/env python3
"""
TMDB Character Resolver - Cross-references script character names with TMDB API

This module fetches the cast list from The Movie Database (TMDB) and helps resolve:
1. Important vs minor characters (based on billing order)
2. Character name normalization (e.g., "VADER" -> "Darth Vader")
3. Filter out extras and minor characters that would make the game impossible

TMDB API:
- Free API key available at: https://www.themoviedb.org/settings/api
- Credits endpoint: GET /3/movie/{movie_id}/credits
- Response includes: cast (with character names, order), crew

Key fields in cast response:
- id: actor's TMDB ID
- name: actor's real name
- character: character name in the film
- order: billing order (0 = top billing)
"""

import urllib.request
import json
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class TMDBCharacter:
    actor_name: str
    character_name: str
    order: int  # Billing order, lower = more important
    id: int


def get_tmdb_movie_id(movie_title: str, year: Optional[int], api_key: str) -> Optional[int]:
    """Search TMDB for a movie and return its ID."""
    query = urllib.parse.quote(movie_title)
    url = f"https://api.themoviedb.org/3/search/movie?api_key={api_key}&query={query}"

    if year:
        url += f"&year={year}"

    req = urllib.request.Request(url, headers={
        'Accept': 'application/json'
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

        if data.get('results'):
            return data['results'][0]['id']
        return None
    except Exception as e:
        print(f"Error searching TMDB: {e}")
        return None


def get_movie_characters(movie_id: int, api_key: str) -> list[TMDBCharacter]:
    """
    Fetch cast list from TMDB for a specific movie.

    Returns characters sorted by billing order.
    """
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/credits?api_key={api_key}"

    req = urllib.request.Request(url, headers={
        'Accept': 'application/json'
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

        characters = []
        for cast in data.get('cast', []):
            characters.append(TMDBCharacter(
                actor_name=cast.get('name', ''),
                character_name=cast.get('character', ''),
                order=cast.get('order', 999),
                id=cast.get('id', 0)
            ))

        return sorted(characters, key=lambda c: c.order)
    except Exception as e:
        print(f"Error fetching TMDB credits: {e}")
        return []


def get_important_characters(movie_id: int, api_key: str, max_order: int = 20) -> list[str]:
    """
    Get list of "important" character names (top-billed cast).

    Args:
        movie_id: TMDB movie ID
        api_key: TMDB API key
        max_order: Maximum billing order to consider "important" (default: top 20)

    Returns:
        List of character names that are important enough for the game
    """
    characters = get_movie_characters(movie_id, api_key)

    # Filter to top-billed characters
    important = [c for c in characters if c.order <= max_order]

    # Return character names, excluding non-specific ones
    exclude_patterns = ['Man', 'Woman', 'Girl', 'Boy', 'Soldier', 'Guard',
                       'Officer', 'Patron', 'Customer', 'Driver', 'Extra',
                       'Unnamed', 'uncredited', 'voice']

    result = []
    for c in important:
        char_name = c.character_name
        # Skip if character name contains excluded patterns
        if not any(pattern.lower() in char_name.lower() for pattern in exclude_patterns):
            if char_name and len(char_name) > 1:
                result.append(char_name)

    return result


def create_character_mapping(tmdb_characters: list[str], script_characters: list[str]) -> dict:
    """
    Create a mapping from script character names to canonical TMDB names.

    This handles cases like:
    - "VADER" -> "Darth Vader"
    - "LUKE" -> "Luke Skywalker"
    - "OBI-WAN" -> "Obi-Wan Kenobi"
    - "THREEPIO" -> "C-3PO"

    Returns a dict: {script_name: canonical_name}
    """
    mapping = {}

    for script_char in script_characters:
        script_lower = script_char.lower()
        best_match = None
        best_score = 0

        for tmdb_char in tmdb_characters:
            tmdb_lower = tmdb_char.lower()

            # Exact match
            if script_lower == tmdb_lower:
                best_match = tmdb_char
                best_score = 100
                break

            # Script name is part of TMDB name (e.g., "Luke" in "Luke Skywalker")
            if script_lower in tmdb_lower:
                score = len(script_lower) / len(tmdb_lower) * 80
                if score > best_score:
                    best_match = tmdb_char
                    best_score = score

            # TMDB name contains script name as a word
            tmdb_words = tmdb_lower.split()
            if script_lower in tmdb_words:
                score = 90
                if score > best_score:
                    best_match = tmdb_char
                    best_score = score

            # First name match
            if tmdb_words and tmdb_words[0] == script_lower:
                score = 85
                if score > best_score:
                    best_match = tmdb_char
                    best_score = score

        if best_match and best_score >= 50:
            mapping[script_char] = best_match
        else:
            # No match found, keep original (might be a minor character)
            mapping[script_char] = script_char

    return mapping


def filter_and_normalize_dialogues(dialogues: list, tmdb_characters: list[str]) -> list:
    """
    Filter dialogues to only include important characters and normalize names.

    Args:
        dialogues: List of dialogue dicts with 'character' and 'text' keys
        tmdb_characters: List of important character names from TMDB

    Returns:
        Filtered list of dialogues with normalized character names
    """
    # Get script characters
    script_characters = list(set(d['character'] for d in dialogues))

    # Create mapping
    mapping = create_character_mapping(tmdb_characters, script_characters)

    # Filter and normalize
    filtered = []
    important_chars = set(tmdb_characters)

    for d in dialogues:
        canonical_name = mapping.get(d['character'], d['character'])

        # Check if this character is important (or maps to an important one)
        if canonical_name in important_chars or any(
            canonical_name.lower() in tmdb.lower() or tmdb.lower() in canonical_name.lower()
            for tmdb in important_chars
        ):
            filtered.append({
                'character': canonical_name.upper(),  # Keep uppercase for game
                'text': d['text']
            })

    return filtered


# Example: Movie configurations for easy testing
MOVIE_CONFIGS = {
    "star-wars-a-new-hope": {
        "tmdb_id": 11,  # Star Wars (A New Hope)
        "title": "Star Wars: Episode IV - A New Hope",
        "year": 1977,
        "imsdb_slug": "Star-Wars-A-New-Hope"
    },
    "breakfast-club": {
        "tmdb_id": 2108,
        "title": "The Breakfast Club",
        "year": 1985,
        "imsdb_slug": "Breakfast-Club,-The"
    },
    "ferris-buellers-day-off": {
        "tmdb_id": 9377,
        "title": "Ferris Bueller's Day Off",
        "year": 1986,
        "imsdb_slug": "Ferris-Buellers-Day-Off"
    },
    "princess-bride": {
        "tmdb_id": 2493,
        "title": "The Princess Bride",
        "year": 1987,
        "imsdb_slug": "Princess-Bride,-The"
    },
    "pulp-fiction": {
        "tmdb_id": 680,
        "title": "Pulp Fiction",
        "year": 1994,
        "imsdb_slug": "Pulp-Fiction"
    },
    "back-to-the-future": {
        "tmdb_id": 105,
        "title": "Back to the Future",
        "year": 1985,
        "imsdb_slug": "Back-to-the-Future"
    }
}


if __name__ == "__main__":
    # Demo without API key
    print("TMDB Character Resolver")
    print("=" * 50)
    print()
    print("To use this module, you need a TMDB API key.")
    print("Get one free at: https://www.themoviedb.org/settings/api")
    print()
    print("Available movie configurations:")
    for movie_id, config in MOVIE_CONFIGS.items():
        print(f"  {movie_id}: {config['title']} ({config['year']})")
    print()
    print("Usage example:")
    print("""
    from tmdb_character_resolver import get_movie_characters, get_important_characters, MOVIE_CONFIGS

    api_key = "your_tmdb_api_key"
    config = MOVIE_CONFIGS["star-wars-a-new-hope"]

    # Get all cast
    characters = get_movie_characters(config["tmdb_id"], api_key)
    for c in characters[:10]:
        print(f"{c.order}: {c.character_name} ({c.actor_name})")

    # Get only important characters for the game
    important = get_important_characters(config["tmdb_id"], api_key, max_order=15)
    print("Important characters:", important)
    """)
