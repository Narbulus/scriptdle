"""
LLM Vision Parser (Pure Parsing)

Pure function: parses PDF pages directly using Gemini's multimodal capabilities.
Outputs scriptdle format with flat dialogue lines.
"""

import json
import re
import time
import logging
from typing import Optional, List, Tuple

import fitz

from ..schema import Scriptdle, DialogueLine
from .gemini_client import GeminiClient, SCRIPTDLE_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def parse_pdf_vision(
    pdf_bytes: bytes,
    source_file: str = "",
    movie_id: str = "",
    title: Optional[str] = None,
    year: Optional[int] = None,
    pages_per_chunk: int = 10,
    max_chunks: int = 0,
    verbose: bool = False,
    model_name: str = "gemini-2.0-flash",
) -> Scriptdle:
    """
    Parse PDF directly using Gemini's vision capabilities into scriptdle format.

    Sends PDF pages as images to the LLM for direct visual parsing.
    This is expensive but works for image-based PDFs where OCR fails.

    Args:
        pdf_bytes: Raw PDF bytes
        source_file: Source file path for metadata
        movie_id: Movie identifier slug
        title: Optional title
        year: Optional release year
        pages_per_chunk: Pages to send per LLM call
        max_chunks: Maximum chunks to process (0 = all)
        verbose: Print progress output
        model_name: Name of Gemini model to use

    Returns:
        Scriptdle object
    """
    start_time = time.time()
    client = GeminiClient(model_name=model_name)

    if verbose:
        print(f"[llm_vision] Starting PDF vision parsing...", flush=True)

    chunks = _split_pdf_pages(pdf_bytes, pages_per_chunk)
    if verbose:
        print(f"[llm_vision] Split into {len(chunks)} chunks ({pages_per_chunk} pages each)", flush=True)

    if max_chunks > 0:
        chunks = chunks[:max_chunks]
        if verbose:
            print(f"[llm_vision] Limited to {max_chunks} chunks", flush=True)

    all_lines: List[DialogueLine] = []
    all_characters: set[str] = set()
    detected_title = ""

    for i, chunk_bytes in enumerate(chunks):
        if verbose:
            print(f"[llm_vision] Chunk {i+1}/{len(chunks)}...", flush=True)

        prompt = _build_vision_prompt(i, len(chunks), pages_per_chunk)

        try:
            call_start = time.time()
            response = client.generate_with_image(
                prompt=prompt,
                image_data=chunk_bytes,
                mime_type="application/pdf",
                system_instruction=SCRIPTDLE_SYSTEM_PROMPT,
                max_tokens=8192,
                temperature=0.1
            )
            call_time = time.time() - call_start

            if verbose:
                print(f"[llm_vision] Chunk {i+1} took {call_time:.2f}s", flush=True)

            data = _parse_json_response(response)
            if data:
                lines, chars = _convert_scriptdle_data(data)
                if verbose:
                    print(f"[llm_vision] Chunk {i+1}: {len(lines)} lines, {len(chars)} chars", flush=True)

                all_lines.extend(lines)
                all_characters.update(chars)

                if not detected_title and data.get("title"):
                    detected_title = data["title"]
            else:
                if verbose:
                    print(f"[llm_vision] Chunk {i+1} failed to parse JSON", flush=True)

        except Exception as e:
            if verbose:
                print(f"[llm_vision] Chunk {i+1} ERROR: {e}", flush=True)
            logger.error(f"Error processing chunk {i+1}: {e}")
            continue

    elapsed = time.time() - start_time
    if verbose:
        print(f"[llm_vision] Done in {elapsed:.2f}s - {len(all_lines)} lines", flush=True)

    if not movie_id and (title or detected_title):
        movie_id = _slugify(title or detected_title)

    return Scriptdle(
        id=movie_id,
        title=title or detected_title or source_file,
        year=year,
        characters=sorted(all_characters),
        lines=all_lines
    )


def _split_pdf_pages(pdf_bytes: bytes, pages_per_chunk: int) -> list[bytes]:
    """Split PDF into chunks of N pages each."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)

    if total_pages <= pages_per_chunk:
        doc.close()
        return [pdf_bytes]

    chunks = []
    for start in range(0, total_pages, pages_per_chunk):
        end = min(start + pages_per_chunk, total_pages)

        chunk_doc = fitz.open()
        chunk_doc.insert_pdf(doc, from_page=start, to_page=end - 1)

        chunk_bytes = chunk_doc.tobytes()
        chunks.append(chunk_bytes)
        chunk_doc.close()

    doc.close()
    return chunks


def _build_vision_prompt(chunk_idx: int, total_chunks: int, pages_per_chunk: int) -> str:
    """Build the LLM prompt for PDF vision parsing."""
    if chunk_idx == 0:
        return """Analyze this screenplay/transcript PDF and extract all dialogue lines.
Output valid JSON following the schema provided."""
    else:
        return f"""Continue parsing this screenplay/transcript PDF. This is pages {chunk_idx * pages_per_chunk + 1} onwards.
Output valid JSON with the dialogue lines from these pages:"""


def _parse_json_response(response: str) -> Optional[dict]:
    """Parse JSON from LLM response."""
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)(?:\s*```|$)', response)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    start = response.find('{')
    if start >= 0:
        try:
            return json.loads(response[start:])
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
