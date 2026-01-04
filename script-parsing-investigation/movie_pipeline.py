#!/usr/bin/env python3
"""
Movie Dialogue Pipeline

A complete pipeline for extracting movie dialogue with character attribution:
1. Subtitle sourcing - Download/use subtitles from subtitle DB
2. Script sourcing - Search and download scripts via Claude Code headless
3. Script validation - Overlap detection to find best matching script
4. Script fusion - Use Gemini to fuse script + subtitles

Usage:
    # Run full pipeline for a movie
    python movie_pipeline.py --movie "The Breakfast Club" --year 1985

    # Run individual steps
    python movie_pipeline.py --movie "Pulp Fiction" --year 1994 --step subtitles
    python movie_pipeline.py --movie "Pulp Fiction" --year 1994 --step scripts
    python movie_pipeline.py --movie "Pulp Fiction" --year 1994 --step validate
    python movie_pipeline.py --movie "Pulp Fiction" --year 1994 --step fuse
"""

import subprocess
import json
import os
import sys
import time
import argparse
import re
import hashlib
from pathlib import Path
from difflib import SequenceMatcher
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ============================================================================
# Configuration
# ============================================================================

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"  # Gitignored directory for downloaded content
SUBTITLES_DIR = DATA_DIR / "subtitles"
SCRIPTS_DIR = DATA_DIR / "scripts"
FUSED_DIR = DATA_DIR / "fused"

MAX_SEARCH_RESULTS = 10  # Number of script sources to try
MIN_OVERLAP_THRESHOLD = 0.1  # Minimum 10% overlap to consider valid

# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class SubtitleInfo:
    """Information about a downloaded subtitle."""
    movie: str
    year: int
    source: str
    path: str
    line_count: int
    language: str = "en"


@dataclass
class ScriptArtifact:
    """A downloaded script artifact."""
    movie: str
    year: int
    source_url: str
    source_name: str
    path: str
    format: str  # html, txt, pdf
    size_bytes: int


@dataclass
class ValidationResult:
    """Result of script validation against subtitles."""
    script_path: str
    overlap_score: float  # 0.0 to 1.0
    matched_lines: int
    total_subtitle_lines: int
    sample_matches: List[Tuple[str, str]]  # (subtitle_line, script_match)


@dataclass
class FusedDialogue:
    """Final fused dialogue output."""
    movie: str
    year: int
    subtitle_source: str
    script_source: str
    script_overlap_score: float
    lines: List[Dict[str, str]]  # [{character, dialogue}, ...]
    extraction_time: float
    total_subtitle_lines: int = 0
    fusion_coverage: float = 0.0  # fused_lines / total_subtitle_lines


# ============================================================================
# Step 1: Subtitle Sourcing
# ============================================================================

def normalize_movie_name(movie: str) -> str:
    """Normalize movie name for file paths."""
    # Remove special characters, lowercase, replace spaces with hyphens
    name = re.sub(r'[^\w\s-]', '', movie.lower())
    name = re.sub(r'\s+', '-', name)
    return name


def get_movie_dir(movie: str, year: int) -> str:
    """Get standardized movie directory name."""
    return f"{normalize_movie_name(movie)}-{year}"


def check_existing_subtitles(movie: str, year: int) -> Optional[SubtitleInfo]:
    """Check if we already have subtitles for this movie."""
    movie_dir = get_movie_dir(movie, year)

    sub_dir = SUBTITLES_DIR / movie_dir
    if sub_dir.exists():
        for f in sub_dir.iterdir():
            if f.suffix == '.srt':
                lines = len(f.read_text(encoding='utf-8', errors='ignore').splitlines())
                return SubtitleInfo(
                    movie=movie, year=year, source="local",
                    path=str(f), line_count=lines
                )

    return None


def download_subtitles_via_claude(movie: str, year: int) -> Optional[SubtitleInfo]:
    """
    Use Claude Code headless mode to search and download subtitles.
    """
    movie_dir = get_movie_dir(movie, year)
    sub_dir = SUBTITLES_DIR / movie_dir
    sub_dir.mkdir(parents=True, exist_ok=True)

    prompt = f"""Search for English subtitles for the movie "{movie}" ({year}).

Your task:
1. Search for "{movie} {year} english subtitles srt"
2. Find a reputable subtitle source (opensubtitles, subscene, yifysubtitles, etc.)
3. Download the .srt subtitle file
4. Save it to: {sub_dir}/subtitles.srt

Important:
- Only download .srt format subtitles
- Prefer highly-rated or most-downloaded subtitles
- Make sure the subtitles match the correct movie and year
- If you can't download directly, try to find and save the subtitle text content

Return a JSON object with:
{{"success": true/false, "source": "url or source name", "path": "path to saved file", "error": "error message if failed"}}
"""

    print(f"  Searching for subtitles via Claude...")

    result = run_claude_headless(
        prompt=prompt,
        allowed_tools="WebSearch,WebFetch,Write,Read,Bash",
        model="sonnet",
        timeout=300
    )

    if "error" in result:
        print(f"  Error: {result['error']}")
        return None

    # Check if subtitle was saved
    srt_file = sub_dir / "subtitles.srt"
    if srt_file.exists():
        lines = len(srt_file.read_text(encoding='utf-8', errors='ignore').splitlines())
        return SubtitleInfo(
            movie=movie, year=year,
            source=result.get("structured_output", {}).get("source", "claude"),
            path=str(srt_file), line_count=lines
        )

    return None


def source_subtitles(movie: str, year: int, force_download: bool = False) -> Optional[SubtitleInfo]:
    """
    Step 1: Source subtitles for a movie.
    First checks for existing subtitles, then downloads if needed.
    """
    print(f"\n{'='*60}")
    print(f"STEP 1: Subtitle Sourcing - {movie} ({year})")
    print(f"{'='*60}")

    # Check for existing subtitles
    if not force_download:
        existing = check_existing_subtitles(movie, year)
        if existing:
            print(f"  Found existing subtitles: {existing.path}")
            print(f"  Lines: {existing.line_count}")
            return existing

    # Download new subtitles
    subtitle = download_subtitles_via_claude(movie, year)
    if subtitle:
        print(f"  Downloaded subtitles to: {subtitle.path}")
        print(f"  Lines: {subtitle.line_count}")
    else:
        print(f"  Failed to download subtitles")

    return subtitle


# ============================================================================
# Step 2: Script Sourcing
# ============================================================================

def run_claude_headless(prompt: str, allowed_tools: str, model: str = "sonnet",
                        json_schema: str = None, timeout: int = 300) -> dict:
    """Run Claude Code in headless mode and return result."""

    cmd = [
        "claude",
        "-p", prompt,
        "--output-format", "json",
        "--allowedTools", allowed_tools,
        "--model", model,
    ]

    if json_schema:
        cmd.extend(["--json-schema", json_schema])

    start_time = time.time()

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        elapsed = time.time() - start_time

        if result.returncode != 0:
            return {
                "error": f"Claude returned non-zero exit code: {result.returncode}",
                "stderr": result.stderr[:500] if result.stderr else "",
                "elapsed": elapsed
            }

        try:
            output = json.loads(result.stdout)
            output["elapsed"] = elapsed
            return output
        except json.JSONDecodeError as e:
            return {
                "error": f"Failed to parse JSON output: {e}",
                "stdout": result.stdout[:1000],
                "elapsed": elapsed
            }

    except subprocess.TimeoutExpired:
        return {"error": f"Timeout after {timeout} seconds"}
    except Exception as e:
        return {"error": str(e)}


def search_and_download_scripts(movie: str, year: int, max_results: int = MAX_SEARCH_RESULTS) -> List[ScriptArtifact]:
    """
    Use Claude Code headless mode to search for and download movie scripts.
    """
    movie_dir = get_movie_dir(movie, year)
    scripts_dir = SCRIPTS_DIR / movie_dir
    scripts_dir.mkdir(parents=True, exist_ok=True)

    prompt = f"""Search for the screenplay/script for the movie "{movie}" ({year}).

Your task:
1. Search for "{movie} {year} screenplay script pdf" and "{movie} {year} movie script"
2. Find up to {max_results} different script sources (imsdb, scriptslug, screenplays-online, dailyscript, etc.)
3. For each source found, download the script content

For each script source:
- If it's a webpage with script text, save it as script_N.html (preserving the HTML)
- If it's a plain text file, save it as script_N.txt
- If it's a PDF, download and save as script_N.pdf

Save files to: {scripts_dir}/

After downloading, return a JSON array of objects:
[
  {{"source_url": "url", "source_name": "imsdb", "filename": "script_1.html", "format": "html"}},
  ...
]

Important:
- Focus on finding SCREENPLAY/SCRIPT content (with dialogue and character names), not plot summaries
- Reputable script sites: imsdb.com, scriptslug.com, screenplays-online.de, dailyscript.com, scripts.com
- Save the raw content without modification
- Number files sequentially (script_1, script_2, etc.)
"""

    print(f"  Searching for scripts via Claude...")

    result = run_claude_headless(
        prompt=prompt,
        allowed_tools="WebSearch,WebFetch,Write,Read,Bash",
        model="sonnet",
        timeout=600  # 10 minutes for thorough search
    )

    if "error" in result:
        print(f"  Error: {result['error']}")
        return []

    # Scan the scripts directory for downloaded files
    artifacts = []
    for f in scripts_dir.iterdir():
        if f.suffix in ['.html', '.txt', '.pdf']:
            artifacts.append(ScriptArtifact(
                movie=movie, year=year,
                source_url="",  # We'll try to extract from content
                source_name=f.stem,
                path=str(f),
                format=f.suffix[1:],  # Remove the dot
                size_bytes=f.stat().st_size
            ))

    return artifacts


def source_scripts(movie: str, year: int, max_results: int = MAX_SEARCH_RESULTS) -> List[ScriptArtifact]:
    """
    Step 2: Source scripts for a movie.
    """
    print(f"\n{'='*60}")
    print(f"STEP 2: Script Sourcing - {movie} ({year})")
    print(f"{'='*60}")

    # Check for existing scripts
    movie_dir = get_movie_dir(movie, year)
    scripts_dir = SCRIPTS_DIR / movie_dir

    existing_scripts = []
    if scripts_dir.exists():
        for f in scripts_dir.iterdir():
            if f.suffix in ['.html', '.txt', '.pdf']:
                existing_scripts.append(ScriptArtifact(
                    movie=movie, year=year,
                    source_url="", source_name=f.stem,
                    path=str(f), format=f.suffix[1:],
                    size_bytes=f.stat().st_size
                ))

    if existing_scripts:
        print(f"  Found {len(existing_scripts)} existing script artifacts")
        for s in existing_scripts:
            print(f"    - {s.source_name}.{s.format} ({s.size_bytes:,} bytes)")
        return existing_scripts

    # Download new scripts
    artifacts = search_and_download_scripts(movie, year, max_results)

    print(f"  Downloaded {len(artifacts)} script artifacts")
    for s in artifacts:
        print(f"    - {s.source_name}.{s.format} ({s.size_bytes:,} bytes)")

    return artifacts


# ============================================================================
# Step 3: Script Validation (Overlap Detection)
# ============================================================================

def extract_subtitle_lines(subtitle_path: str) -> List[str]:
    """
    Extract speaking lines from an SRT subtitle file.
    Filters out timestamps, numbers, and non-dialogue content.
    """
    content = Path(subtitle_path).read_text(encoding='utf-8', errors='ignore')
    lines = []

    # SRT format: number, timestamp, text, blank line
    blocks = re.split(r'\n\n+', content)

    for block in blocks:
        block_lines = block.strip().split('\n')
        if len(block_lines) >= 3:
            # Skip first line (number) and second line (timestamp)
            # Get the actual dialogue text
            dialogue_lines = block_lines[2:]
            for line in dialogue_lines:
                # Clean the line
                line = line.strip()
                # Skip music indicators, sound effects, etc.
                if not line:
                    continue
                if line.startswith(('♪', '[', '(', '<')):
                    continue
                if re.match(r'^\d+$', line):  # Just a number
                    continue
                if '-->' in line:  # Timestamp
                    continue
                # Remove HTML tags
                line = re.sub(r'<[^>]+>', '', line)
                # Remove speaker indicators like "JOHN:"
                line = re.sub(r'^[A-Z][A-Z\s]+:\s*', '', line)
                if line and len(line) > 2:
                    lines.append(line)

    return lines


def extract_script_text(script_path: str) -> str:
    """
    Extract text content from a script file (HTML, TXT, or PDF).
    """
    path = Path(script_path)

    if path.suffix == '.txt':
        return path.read_text(encoding='utf-8', errors='ignore')

    elif path.suffix == '.html':
        content = path.read_text(encoding='utf-8', errors='ignore')
        # Remove HTML tags but preserve text
        text = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        # Decode HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&#39;', "'")
        return text

    elif path.suffix == '.pdf':
        # Try to extract text from PDF using pdftotext if available
        try:
            result = subprocess.run(
                ['pdftotext', '-layout', str(path), '-'],
                capture_output=True, text=True, timeout=60
            )
            if result.returncode == 0:
                return result.stdout
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Fallback: try with Python library
        try:
            import PyPDF2
            with open(path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except ImportError:
            return ""

    return ""


def normalize_for_comparison(text: str) -> str:
    """Normalize text for fuzzy comparison."""
    # Lowercase
    text = text.lower()
    # Remove punctuation except apostrophes
    text = re.sub(r"[^\w\s']", ' ', text)
    # Normalize whitespace
    text = ' '.join(text.split())
    return text


def calculate_overlap(subtitle_lines: List[str], script_text: str,
                     sample_size: int = 100) -> ValidationResult:
    """
    Calculate how much of the subtitle content appears in the script.
    Uses fuzzy matching to handle slight differences.
    """
    # Normalize script text for searching
    script_normalized = normalize_for_comparison(script_text)

    # Sample subtitle lines if there are too many
    if len(subtitle_lines) > sample_size * 3:
        # Sample from beginning, middle, and end
        step = len(subtitle_lines) // sample_size
        sample_lines = subtitle_lines[::step][:sample_size]
    else:
        sample_lines = subtitle_lines

    matched_count = 0
    sample_matches = []

    for line in sample_lines:
        line_normalized = normalize_for_comparison(line)

        # Skip very short lines
        if len(line_normalized) < 10:
            continue

        # Check if line (or significant portion) appears in script
        # Use a sliding window approach for fuzzy matching
        words = line_normalized.split()
        if len(words) < 3:
            continue

        # Try to find a sequence of words from the subtitle in the script
        # Look for at least 60% of the words appearing in sequence
        min_match_words = max(3, int(len(words) * 0.6))

        found = False
        for i in range(len(words) - min_match_words + 1):
            search_phrase = ' '.join(words[i:i + min_match_words])
            if search_phrase in script_normalized:
                found = True
                if len(sample_matches) < 10:
                    # Find the matching context in script
                    idx = script_normalized.find(search_phrase)
                    context_start = max(0, idx - 20)
                    context_end = min(len(script_normalized), idx + len(search_phrase) + 20)
                    script_context = script_normalized[context_start:context_end]
                    sample_matches.append((line[:80], f"...{script_context}..."))
                break

        if found:
            matched_count += 1

    total_checked = len([l for l in sample_lines if len(normalize_for_comparison(l)) >= 10])
    overlap_score = matched_count / total_checked if total_checked > 0 else 0

    return ValidationResult(
        script_path="",  # Will be set by caller
        overlap_score=overlap_score,
        matched_lines=matched_count,
        total_subtitle_lines=total_checked,
        sample_matches=sample_matches
    )


def validate_scripts(subtitle_info: SubtitleInfo,
                    script_artifacts: List[ScriptArtifact]) -> List[ValidationResult]:
    """
    Step 3: Validate scripts against subtitles using overlap detection.
    Returns results sorted by overlap score (best first).
    """
    print(f"\n{'='*60}")
    print(f"STEP 3: Script Validation")
    print(f"{'='*60}")

    if not script_artifacts:
        print("  No script artifacts to validate")
        return []

    # Extract subtitle lines
    print(f"  Extracting subtitle lines from {subtitle_info.path}...")
    subtitle_lines = extract_subtitle_lines(subtitle_info.path)
    print(f"  Found {len(subtitle_lines)} dialogue lines in subtitles")

    results = []

    for artifact in script_artifacts:
        print(f"\n  Validating: {artifact.source_name}.{artifact.format}")

        # Extract script text
        script_text = extract_script_text(artifact.path)
        if not script_text or len(script_text) < 1000:
            print(f"    Skipped: insufficient text content ({len(script_text)} chars)")
            continue

        # Calculate overlap
        result = calculate_overlap(subtitle_lines, script_text)
        result.script_path = artifact.path
        results.append(result)

        print(f"    Overlap: {result.overlap_score*100:.1f}% ({result.matched_lines}/{result.total_subtitle_lines} lines)")

    # Sort by overlap score
    results.sort(key=lambda x: x.overlap_score, reverse=True)

    if results:
        print(f"\n  Best match: {Path(results[0].script_path).name} ({results[0].overlap_score*100:.1f}% overlap)")
        if results[0].sample_matches:
            print(f"  Sample matches:")
            for sub, script in results[0].sample_matches[:3]:
                print(f"    SUB: \"{sub[:60]}...\"")
                print(f"    SCR: \"{script[:60]}...\"")

    return results


# ============================================================================
# Step 4: Script Fusion with Gemini
# ============================================================================

def run_gemini_fusion(script_path: str, subtitle_path: str) -> dict:
    """
    Run fusion using Gemini 2.5 Flash API with structured output.
    Uses full documents - Gemini 2.5 Flash has 1M token context window.
    """
    try:
        from google import genai
        from google.genai import types
        from pydantic import BaseModel
        from typing import List
    except ImportError:
        return {"error": "google-genai not installed. Run: pip install google-genai pydantic"}

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY not set in environment"}

    # Define Pydantic models for structured output
    class DialogueLine(BaseModel):
        character: str
        dialogue: str

    class FusedDialogueOutput(BaseModel):
        lines: List[DialogueLine]

    client = genai.Client(api_key=api_key)

    start_time = time.time()

    # Read full files - Gemini 2.5 Flash has 1M token context
    try:
        script_text = extract_script_text(script_path)
        subtitle_content = Path(subtitle_path).read_text(encoding='utf-8', errors='ignore')
        print(f"  Script size: {len(script_text):,} chars")
        print(f"  Subtitle size: {len(subtitle_content):,} chars")
    except Exception as e:
        return {"error": f"Failed to read files: {e}"}

    prompt = f"""Analyze these two files and create a fused dialogue dataset.

SCRIPT/SCREENPLAY CONTENT:
{script_text}

SUBTITLE CONTENT:
{subtitle_content}

TASK:
Match script dialogue to subtitle dialogue and create a fused output.

SCRIPT PARSING:
- Character names are typically UPPERCASE before their dialogue
- Extract dialogue that follows character names
- SKIP: Scene headers (INT./EXT.), stage directions, camera directions, credits

SUBTITLE PARSING:
- Extract spoken dialogue lines
- SKIP: timestamps, music, sound effects, actions

MATCHING:
- For each script dialogue, find the best matching subtitle line
- Use CHARACTER name from script + DIALOGUE text from subtitle

CHARACTER NAME FORMAT:
- Use human-readable names: "John Smith" not "JOHN SMITH" or "JOHN"
- For single names, capitalize properly: "Ripley" not "RIPLEY"
- Remove parentheticals: "John" not "John (V.O.)" or "John (CONT'D)"

Include ALL matched lines you can find."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=FusedDialogueOutput,
                max_output_tokens=65536,  # Max for Gemini 2.5 Flash
                thinking_config=types.ThinkingConfig(
                    thinking_budget=0  # Disable thinking to maximize output tokens
                ),
            ),
        )
        elapsed = time.time() - start_time

        # Debug: Check why response might be truncated
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason'):
                print(f"  Finish reason: {candidate.finish_reason}")
            if hasattr(response, 'usage_metadata'):
                meta = response.usage_metadata
                print(f"  Tokens - input: {getattr(meta, 'prompt_token_count', '?')}, output: {getattr(meta, 'candidates_token_count', '?')}")

        # Parse the response
        try:
            result = FusedDialogueOutput.model_validate_json(response.text)
            return {
                "lines": [line.model_dump() for line in result.lines],
                "elapsed": elapsed
            }
        except Exception as e:
            # Try direct JSON parse
            try:
                result_json = json.loads(response.text)
                return {"lines": result_json.get("lines", []), "elapsed": elapsed}
            except json.JSONDecodeError:
                # Try to salvage truncated JSON by finding complete objects
                text = response.text
                try:
                    # Find the last complete object in the array
                    last_complete = text.rfind('},')
                    if last_complete > 0:
                        fixed_json = text[:last_complete+1] + ']}'
                        result_json = json.loads(fixed_json)
                        lines = result_json.get("lines", [])
                        print(f"  Warning: Salvaged {len(lines)} lines from truncated response")
                        return {"lines": lines, "elapsed": elapsed, "truncated": True}
                except:
                    pass
                return {"error": f"Failed to parse response: {e}", "elapsed": elapsed}

    except Exception as e:
        return {"error": f"Gemini API error: {e}"}


def fuse_script_subtitles(movie: str, year: int,
                          subtitle_info: SubtitleInfo,
                          best_script: ValidationResult) -> Optional[FusedDialogue]:
    """
    Step 4: Fuse the best script with subtitles using Gemini.
    """
    print(f"\n{'='*60}")
    print(f"STEP 4: Script Fusion")
    print(f"{'='*60}")

    if best_script.overlap_score < MIN_OVERLAP_THRESHOLD:
        print(f"  Warning: Best script has low overlap ({best_script.overlap_score*100:.1f}%)")
        print(f"  Proceeding anyway, but results may be poor quality")

    print(f"  Script: {Path(best_script.script_path).name}")
    print(f"  Subtitle: {Path(subtitle_info.path).name}")

    # Count total subtitle dialogue lines for coverage calculation
    total_subtitle_lines = len(extract_subtitle_lines(subtitle_info.path))
    print(f"  Total subtitle lines: {total_subtitle_lines}")
    print(f"  Running Gemini fusion...")

    result = run_gemini_fusion(best_script.script_path, subtitle_info.path)

    if "error" in result:
        print(f"  Error: {result['error']}")
        return None

    lines = result.get("lines", [])
    elapsed = result.get("elapsed", 0)

    # Calculate fusion coverage
    fusion_coverage = len(lines) / total_subtitle_lines if total_subtitle_lines > 0 else 0

    print(f"  Extracted {len(lines)} dialogue lines in {elapsed:.1f}s")
    print(f"  Fusion coverage: {fusion_coverage*100:.1f}% ({len(lines)}/{total_subtitle_lines})")

    if lines:
        # Show character distribution
        chars = {}
        for line in lines:
            c = line.get("character", "Unknown")
            chars[c] = chars.get(c, 0) + 1

        print(f"\n  Top characters:")
        for c, count in sorted(chars.items(), key=lambda x: -x[1])[:5]:
            print(f"    {c}: {count} lines")

        print(f"\n  Sample lines:")
        for line in lines[:3]:
            print(f"    [{line['character']}]: \"{line['dialogue'][:60]}...\"")

    return FusedDialogue(
        movie=movie,
        year=year,
        subtitle_source=subtitle_info.path,
        script_source=best_script.script_path,
        script_overlap_score=best_script.overlap_score,
        lines=lines,
        extraction_time=elapsed,
        total_subtitle_lines=total_subtitle_lines,
        fusion_coverage=fusion_coverage
    )


# ============================================================================
# Main Pipeline
# ============================================================================

def run_pipeline(movie: str, year: int, steps: List[str] = None) -> Optional[FusedDialogue]:
    """
    Run the full pipeline or specific steps.
    """
    all_steps = ["subtitles", "scripts", "validate", "fuse"]
    if steps is None:
        steps = all_steps

    print(f"\n{'#'*60}")
    print(f"# Movie Pipeline: {movie} ({year})")
    print(f"# Steps: {', '.join(steps)}")
    print(f"{'#'*60}")

    movie_dir = get_movie_dir(movie, year)

    # State variables
    subtitle_info = None
    script_artifacts = []
    validation_results = []

    # Step 1: Subtitles
    if "subtitles" in steps:
        subtitle_info = source_subtitles(movie, year)
        if not subtitle_info:
            print("\nPipeline failed: Could not source subtitles")
            return None
    else:
        # Try to load existing
        subtitle_info = check_existing_subtitles(movie, year)
        if not subtitle_info:
            print("\nError: No existing subtitles found. Run with --step subtitles first")
            return None

    # Step 2: Scripts
    if "scripts" in steps:
        script_artifacts = source_scripts(movie, year)
        if not script_artifacts:
            print("\nPipeline failed: Could not source any scripts")
            return None
    else:
        # Load existing
        scripts_dir = SCRIPTS_DIR / movie_dir
        if scripts_dir.exists():
            for f in scripts_dir.iterdir():
                if f.suffix in ['.html', '.txt', '.pdf']:
                    script_artifacts.append(ScriptArtifact(
                        movie=movie, year=year,
                        source_url="", source_name=f.stem,
                        path=str(f), format=f.suffix[1:],
                        size_bytes=f.stat().st_size
                    ))

        if not script_artifacts:
            print("\nError: No existing scripts found. Run with --step scripts first")
            return None

    # Step 3: Validation
    if "validate" in steps:
        validation_results = validate_scripts(subtitle_info, script_artifacts)
        if not validation_results:
            print("\nPipeline failed: No scripts passed validation")
            return None
    else:
        # Skip validation, use first script
        if script_artifacts:
            validation_results = [ValidationResult(
                script_path=script_artifacts[0].path,
                overlap_score=1.0,  # Assume good
                matched_lines=0,
                total_subtitle_lines=0,
                sample_matches=[]
            )]

    # Step 4: Fusion
    if "fuse" in steps:
        best_script = validation_results[0]
        fused = fuse_script_subtitles(movie, year, subtitle_info, best_script)

        if fused:
            # Save output
            FUSED_DIR.mkdir(parents=True, exist_ok=True)
            output_file = FUSED_DIR / f"{movie_dir}_fused.json"

            with open(output_file, 'w') as f:
                json.dump(asdict(fused), f, indent=2)

            print(f"\n{'='*60}")
            print(f"Pipeline Complete!")
            print(f"{'='*60}")
            print(f"  Output: {output_file}")
            print(f"  Fused lines: {len(fused.lines)}")
            print(f"  Total subtitle lines: {fused.total_subtitle_lines}")
            print(f"  Script overlap: {fused.script_overlap_score*100:.1f}%")
            print(f"  Fusion coverage: {fused.fusion_coverage*100:.1f}%")

            return fused

    return None


def main():
    parser = argparse.ArgumentParser(description="Movie Dialogue Pipeline")
    parser.add_argument("--movie", type=str, required=True,
                        help="Movie name (e.g., 'The Breakfast Club')")
    parser.add_argument("--year", type=int, required=True,
                        help="Movie release year")
    parser.add_argument("--step", type=str, choices=["subtitles", "scripts", "validate", "fuse"],
                        help="Run only a specific step")
    parser.add_argument("--max-search", type=int, default=MAX_SEARCH_RESULTS,
                        help=f"Max script sources to try (default: {MAX_SEARCH_RESULTS})")

    args = parser.parse_args()

    steps = [args.step] if args.step else None

    result = run_pipeline(args.movie, args.year, steps)

    if not result and not args.step:
        sys.exit(1)


if __name__ == "__main__":
    main()
