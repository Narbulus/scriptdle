"""
LLM Text Parser (Pure Parsing)

Pure function: parses screenplay text using Gemini LLM.
No extraction logic - takes text as input, returns Scriptdle format.
"""

import json
import re
import time
import logging
from pathlib import Path
from typing import Optional, List, Tuple

from ..schema import Scriptdle, DialogueLine
from .gemini_client import GeminiClient, SCRIPTDLE_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def parse_text_llm(
    text: str,
    source_file: str = "",
    movie_id: str = "",
    title: Optional[str] = None,
    year: Optional[int] = None,
    chunk_size: int = 12000,
    overlap: int = 500,
    max_chunks: int = 0,
    verbose: bool = False,
    model_name: str = "gemini-2.0-flash",
) -> Scriptdle:
    """
    Parse screenplay text using Gemini LLM into scriptdle format.

    This is a pure function: takes text, returns parsed scriptdle.
    No extraction logic - text must be pre-extracted.

    Args:
        text: Plain text screenplay content
        source_file: Source file path for metadata
        movie_id: Movie identifier slug
        title: Optional title
        year: Optional release year
        chunk_size: Maximum characters per LLM call
        overlap: Character overlap between chunks
        max_chunks: Maximum chunks to process (0 = all)
        verbose: Print progress output
        model_name: Name of Gemini model to use

    Returns:
        Scriptdle object
    """
    start_time = time.time()
    client = GeminiClient(model_name=model_name)

    if verbose:
        print(f"[llm_text] Starting with {len(text)} chars...", flush=True)

    chunks = _chunk_text(text, chunk_size, overlap)
    if verbose:
        print(f"[llm_text] Split into {len(chunks)} chunks", flush=True)

    if max_chunks > 0:
        chunks = chunks[:max_chunks]
        if verbose:
            print(f"[llm_text] Limited to {max_chunks} chunks", flush=True)

    all_lines: List[DialogueLine] = []
    all_characters: set[str] = set()
    detected_title = ""

    for i, chunk in enumerate(chunks):
        if verbose:
            print(f"[llm_text] Chunk {i+1}/{len(chunks)} ({len(chunk)} chars)...", flush=True)

        prompt = _build_prompt(chunk, i, len(chunks))

        try:
            call_start = time.time()
            response = client.generate(
                prompt=prompt,
                system_instruction=SCRIPTDLE_SYSTEM_PROMPT,
                max_tokens=8192,
                temperature=0.1
            )
            call_time = time.time() - call_start

            if verbose:
                print(f"[llm_text] Chunk {i+1} took {call_time:.2f}s", flush=True)

            data = _parse_json_response(response)
            if data:
                lines, chars = _convert_scriptdle_data(data)
                if verbose:
                    print(f"[llm_text] Chunk {i+1}: {len(lines)} lines, {len(chars)} chars", flush=True)

                all_lines.extend(lines)
                all_characters.update(chars)

                if not detected_title and data.get("title"):
                    detected_title = data["title"]
            else:
                if verbose:
                    print(f"[llm_text] Chunk {i+1} failed to parse JSON", flush=True)

        except Exception as e:
            if verbose:
                print(f"[llm_text] Chunk {i+1} ERROR: {e}", flush=True)
            logger.error(f"Error processing chunk {i+1}: {e}")
            continue

    elapsed = time.time() - start_time
    if verbose:
        print(f"[llm_text] Done in {elapsed:.2f}s - {len(all_lines)} lines", flush=True)

    if not movie_id and (title or detected_title):
        movie_id = _slugify(title or detected_title)

    return Scriptdle(
        id=movie_id,
        title=title or detected_title or (Path(source_file).stem if source_file else ""),
        year=year,
        characters=sorted(all_characters),
        lines=all_lines
    )


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Split text into overlapping chunks, breaking at natural boundaries."""
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    current_pos = 0
    min_chunk = chunk_size // 2

    while current_pos < len(text):
        end_pos = min(current_pos + chunk_size, len(text))

        if end_pos < len(text):
            search_window = min(500, chunk_size // 4)
            search_start = max(end_pos - search_window, current_pos + min_chunk)
            search_text = text[search_start:end_pos]

            scene_match = None
            for match in re.finditer(r'\n\s*(INT\.|EXT\.)', search_text):
                scene_match = match

            if scene_match:
                end_pos = search_start + scene_match.start()
            elif (last_para := search_text.rfind("\n\n")) > 0:
                end_pos = search_start + last_para

        chunk = text[current_pos:end_pos].strip()
        if chunk:
            chunks.append(chunk)

        if end_pos >= len(text):
            break
        current_pos = max(end_pos - overlap, current_pos + min_chunk)

    return chunks


def _build_prompt(chunk: str, chunk_idx: int, total_chunks: int) -> str:
    """Build the LLM prompt for a chunk."""
    if chunk_idx == 0:
        return f"""Parse this screenplay text and extract all dialogue lines.
Output valid JSON following the schema provided.

Text:
{chunk}

JSON output:"""
    else:
        return f"""Continue parsing this screenplay. This is chunk {chunk_idx + 1} of {total_chunks}.

Text:
{chunk}

JSON output:"""


def _parse_json_response(response: str) -> Optional[dict]:
    """Parse JSON from LLM response, handling various formats."""
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)(?:\s*```|$)', response)
    if json_match:
        json_text = json_match.group(1).strip()
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            repaired = _repair_json(json_text)
            if repaired:
                return repaired

    start = response.find('{')
    if start >= 0:
        json_text = response[start:]
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            repaired = _repair_json(json_text)
            if repaired:
                return repaired

    logger.error(f"Failed to parse JSON: {response[:200]}...")
    return None


def _repair_json(json_text: str) -> Optional[dict]:
    """Try to repair truncated JSON by adding missing brackets."""
    open_braces = json_text.count('{')
    close_braces = json_text.count('}')
    open_brackets = json_text.count('[')
    close_brackets = json_text.count(']')

    if open_braces > close_braces or open_brackets > close_brackets:
        last_comma = json_text.rfind(',')
        if last_comma > 0:
            json_text = json_text[:last_comma]

        needed_brackets = ']' * (open_brackets - close_brackets)
        needed_braces = '}' * (open_braces - close_braces)
        repaired = json_text + needed_brackets + needed_braces

        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

    return None


def _convert_scriptdle_data(data: dict) -> Tuple[List[DialogueLine], set[str]]:
    """Convert LLM JSON response to DialogueLine objects."""
    lines: List[DialogueLine] = []
    characters: set[str] = set()

    line_data = data.get("lines", [])

    if not line_data:
        for scene in data.get("scenes", []):
            for dial in scene.get("dialogue", []):
                char = dial.get("character")
                text = dial.get("text") or dial.get("content")
                if char and text:
                    line_data.append({"character": char, "text": text})

    for item in line_data:
        char = (item.get("character") or "").strip().upper()
        text = (item.get("text") or item.get("content") or "").strip()

        if char and text:
            characters.add(char)
            lines.append(DialogueLine(character=char, text=text))

    for char in data.get("characters", []):
        if char:
            characters.add(char.strip().upper())

    return lines, characters


def _slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'[^a-z0-9-]', '', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text
