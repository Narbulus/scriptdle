"""
LLM Transcript Parser

Parses transcript text into scriptdle format using Gemini.
"""

import json
import logging
import time
import re
from typing import Optional, Any, List, Tuple
from pathlib import Path

from .gemini_client import GeminiClient, SCRIPTDLE_SYSTEM_PROMPT
from ..extractors import extract_simple, extract_wiki, fetch_url
from ..schema import Scriptdle, DialogueLine

logger = logging.getLogger(__name__)

def parse_transcript_url(
    url: str,
    movie_id: str = "",
    title: Optional[str] = None,
    year: Optional[int] = None,
    model_name: str = "gemini-2.0-flash",
    verbose: bool = False,
) -> Optional[Scriptdle]:
    """
    Fetch URL, extract wiki content, and parse as scriptdle format.

    Args:
        url: URL to fetch (e.g., wiki transcript page)
        movie_id: Movie identifier slug
        title: Movie title
        year: Release year
        model_name: Gemini model to use
        verbose: Enable verbose output

    Returns:
        Scriptdle object or None if parsing fails
    """
    if verbose:
        print(f"[llm_transcript] Fetching URL: {url}", flush=True)

    try:
        html = fetch_url(url)
    except Exception as e:
        logger.error(f"Failed to fetch URL {url}: {e}")
        return None

    if verbose:
        print(f"[llm_transcript] Extracting wiki content...", flush=True)

    text = extract_wiki(html)
    if not text:
        logger.error("Failed to extract text from wiki page")
        return None

    return parse_transcript_llm(
        text=text,
        source_file=url,
        movie_id=movie_id,
        title=title,
        year=year,
        verbose=verbose,
        model_name=model_name
    )


def parse_transcript_pdf(
    source: Any,
    movie_id: str = "",
    title: Optional[str] = None,
    year: Optional[int] = None,
    model_name: str = "gemini-2.0-flash",
    verbose: bool = False,
) -> Optional[Scriptdle]:
    """
    Extract text from PDF and parse it as a scriptdle format.
    """
    if verbose:
        print(f"[llm_transcript] Extracting text from PDF...", flush=True)

    text = extract_simple(source)
    if not text:
        logger.error("Failed to extract text from PDF")
        return None

    source_file = str(source) if isinstance(source, (str, Path)) else "bytes"
    return parse_transcript_llm(
        text=text,
        source_file=source_file,
        movie_id=movie_id,
        title=title,
        year=year,
        verbose=verbose,
        model_name=model_name
    )

def parse_transcript_llm(
    text: str,
    source_file: str = "",
    movie_id: str = "",
    title: Optional[str] = None,
    year: Optional[int] = None,
    chunk_size: int = 15000,
    overlap: int = 500,
    verbose: bool = False,
    model_name: str = "gemini-2.0-flash",
) -> Scriptdle:
    """
    Parse transcript text into scriptdle format using Gemini.

    Returns:
        Scriptdle object with flat dialogue lines
    """
    start_time = time.time()
    client = GeminiClient(model_name=model_name)

    if verbose:
        print(f"[llm_transcript] Starting with {len(text)} chars...", flush=True)

    chunks: List[str] = []
    for i in range(0, len(text), chunk_size - overlap):
        chunks.append(text[i:i + chunk_size])

    all_lines: List[DialogueLine] = []
    all_characters: set[str] = set()
    detected_title: str = ""

    for i, chunk in enumerate(chunks):
        if verbose:
            print(f"[llm_transcript] Chunk {i+1}/{len(chunks)}...", flush=True)

        prompt = f"Parse this transcript chunk. Extract all dialogue lines.\n\nText:\n{chunk}\n\nJSON output:"

        try:
            response = client.generate(
                prompt=prompt,
                system_instruction=SCRIPTDLE_SYSTEM_PROMPT,
                max_tokens=8192,
                temperature=0.1
            )

            data = _parse_json_response(response)
            if data:
                chunk_lines, chunk_chars = _convert_scriptdle_data(data)
                all_lines.extend(chunk_lines)
                all_characters.update(chunk_chars)
                if not detected_title and data.get("title"):
                    detected_title = data["title"]

        except Exception as e:
            logger.error(f"Error parsing transcript chunk {i+1}: {e}")

    elapsed = time.time() - start_time

    if verbose:
        print(f"[llm_transcript] Parsed {len(all_lines)} lines in {elapsed:.2f}s", flush=True)

    if not movie_id and (title or detected_title):
        movie_id = _slugify(title or detected_title)

    return Scriptdle(
        id=movie_id,
        title=title or detected_title or "Transcript",
        year=year,
        characters=sorted(list(all_characters)),
        lines=all_lines
    )

def _parse_json_response(response: str) -> Optional[dict[str, Any]]:
    """Helper to extract JSON from LLM response."""
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)(?:\s*```|$)', response)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip())
        except:
            pass
            
    start = response.find('{')
    if start >= 0:
        try:
            return json.loads(response[start:])
        except Exception:
            pass
    return None

def _convert_scriptdle_data(data: dict) -> Tuple[List[DialogueLine], set[str]]:
    """Convert JSON response to DialogueLine objects."""
    lines: List[DialogueLine] = []
    characters: set[str] = set()

    line_data = data.get("lines", data.get("dialogue", []))

    for item in line_data:
        char = (item.get("character") or "").strip().upper()
        text = (item.get("text") or item.get("content") or "").strip()

        text = re.sub(r'\s+', ' ', text).strip()

        if char and text:
            characters.add(char)
            lines.append(DialogueLine(character=char, text=text))

    return lines, characters


def _slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    import re
    text = text.lower()
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'[^a-z0-9-]', '', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text
