"""
Text Cleaning Utilities for Screenplay Parsing

Handles:
- OCR error correction
- Translation marker removal
- Script artifact removal (page numbers, revision markers)
- Character name detection in dialogue
"""

import re
from typing import Optional, Tuple, List


OCR_CORRECTIONS = [
    (r"\b([A-Z])'11\b", r"\1'll"),
    (r"\bI'11\b", "I'll"),
    (r"\bhe'11\b", "he'll"),
    (r"\bshe'11\b", "she'll"),
    (r"\bwe'11\b", "we'll"),
    (r"\bthey'11\b", "they'll"),
    (r"\byou'11\b", "you'll"),
    (r"\bit'11\b", "it'll"),
    (r"\bthat'11\b", "that'll"),
    (r"\bwho'11\b", "who'll"),
    (r"\bwhat'11\b", "what'll"),
    (r"\bwon'1\b", "won't"),
    (r"\bcan'1\b", "can't"),
    (r"\bdon'1\b", "don't"),
    (r"\bdoesn'1\b", "doesn't"),
    (r"\bdidn'1\b", "didn't"),
    (r"\bwouldn'1\b", "wouldn't"),
    (r"\bcouldn'1\b", "couldn't"),
    (r"\bshouldn'1\b", "shouldn't"),
    (r"\bhaven'1\b", "haven't"),
    (r"\bhasn'1\b", "hasn't"),
    (r"\bisn'1\b", "isn't"),
    (r"\baren'1\b", "aren't"),
    (r"\bwasn'1\b", "wasn't"),
    (r"\bweren'1\b", "weren't"),
    (r"\btbe\b", "the"),
    (r"\bwbat\b", "what"),
    (r"\bwben\b", "when"),
    (r"\bwbere\b", "where"),
    (r"\bwby\b", "why"),
    (r"\bwbo\b", "who"),
    (r"\btbat\b", "that"),
    (r"\btbis\b", "this"),
    (r"\btbey\b", "they"),
    (r"\btben\b", "then"),
    (r"\btbere\b", "there"),
    (r"\btbose\b", "those"),
    (r"\btbese\b", "these"),
    (r"\btbink\b", "think"),
    (r"\btbing\b", "thing"),
    (r"\btbings\b", "things"),
    (r"(?<=[a-z])1(?=[a-z])", "l"),
    (r"(?<=[A-Z])0(?=[A-Z])", "O"),
]

OCR_PATTERNS = [(re.compile(p, re.IGNORECASE if p[0] != '(' else 0), r) for p, r in OCR_CORRECTIONS]

SCRIPT_ARTIFACTS = [
    re.compile(r'\b(YELLOW|BLUE|PINK|GREEN|GOLDENROD|BUFF|SALMON|CHERRY|TAN|WHITE|REVISED?)\s+\d{1,2}/\d{1,2}/\d{2,4}\b', re.IGNORECASE),
    re.compile(r'^\s*\d+[A-Z]?\.?\s*$'),
    re.compile(r'\bPAGE\s+\d+\b', re.IGNORECASE),
    re.compile(r'\s+\d+\s*$'),
]

TRANSLATION_MARKER_PATTERN = re.compile(r'<<\s*|\s*>>')

CHARACTER_AT_END_PATTERN = re.compile(
    r'\s+([A-Z][A-Z\s\'\-]{1,25})\s*$'
)


def fix_ocr_errors(text: str) -> str:
    """
    Fix common OCR errors in text.

    Args:
        text: Input text with potential OCR errors

    Returns:
        Cleaned text with OCR errors corrected
    """
    for pattern, replacement in OCR_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def remove_script_artifacts(text: str) -> str:
    """
    Remove script artifacts like page numbers and revision markers.

    Args:
        text: Input text

    Returns:
        Text with artifacts removed
    """
    for pattern in SCRIPT_ARTIFACTS:
        text = pattern.sub('', text)
    return text.strip()


def remove_translation_markers(text: str) -> str:
    """
    Remove translation markers like <<...>>.

    Args:
        text: Input text with potential markers

    Returns:
        Text with markers removed
    """
    return TRANSLATION_MARKER_PATTERN.sub('', text).strip()


def detect_character_at_end(text: str) -> Tuple[str, Optional[str]]:
    """
    Detect if a character name appears at the end of dialogue.

    Args:
        text: Dialogue text to check

    Returns:
        Tuple of (cleaned_text, character_name or None)
    """
    match = CHARACTER_AT_END_PATTERN.search(text)
    if match:
        potential_name = match.group(1).strip()
        words = potential_name.split()
        if 1 <= len(words) <= 3:
            non_names = {
                'THE', 'AND', 'BUT', 'FOR', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD',
                'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'HAS', 'HIS', 'HOW', 'ITS',
                'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'DID', 'GET',
                'HIM', 'LET', 'PUT', 'SAY', 'TOO', 'USE', 'YES', 'NO', 'WHAT',
                'WITH', 'HAVE', 'THIS', 'YOUR', 'FROM', 'THEY', 'BEEN',
                'HAVE', 'MANY', 'SOME', 'THEM', 'THEN', 'WERE', 'SAID', 'EACH',
            }
            is_common_word = potential_name in non_names or any(w in non_names for w in words)

            before = text[:match.start()].strip()
            ends_with_punct = before and before[-1] in '.!?'

            if not is_common_word and before and len(before) > 5:
                if ends_with_punct:
                    return before, potential_name

    return text, None


def clean_dialogue(text: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Clean dialogue text, extracting any character names or action.

    Args:
        text: Raw dialogue text

    Returns:
        Tuple of (cleaned_dialogue, trailing_character_name, trailing_action)
    """
    text = remove_translation_markers(text)
    text = fix_ocr_errors(text)
    text = remove_script_artifacts(text)
    text, char_name = detect_character_at_end(text)
    return text.strip(), char_name, None


def clean_text(text: str) -> str:
    """
    General text cleaning without dialogue-specific processing.

    Args:
        text: Input text

    Returns:
        Cleaned text
    """
    text = remove_translation_markers(text)
    text = fix_ocr_errors(text)
    text = remove_script_artifacts(text)
    return text.strip()
