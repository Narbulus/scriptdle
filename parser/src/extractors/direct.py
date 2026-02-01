"""
Direct PDF Text Extraction

Pure function: extracts embedded text from PDFs using PyMuPDF.
Preserves layout/indentation for screenplay structure.

No fallbacks - returns None if extraction fails or produces garbage.
"""

import logging
from pathlib import Path
from typing import Optional, Union

import fitz

logger = logging.getLogger(__name__)

MIN_TEXT_CHARS_PER_PAGE = 100
MAX_GARBAGE_RATIO = 0.20


def extract_direct(source: Union[str, Path, bytes]) -> Optional[str]:
    """
    Extract embedded text from a PDF using PyMuPDF.
    
    Preserves horizontal positioning (indentation) for screenplay parsing.
    Returns None if:
    - PDF has no embedded text
    - Text is too short
    - Text appears to be garbage/corrupted
    
    Args:
        source: PDF file path or bytes
        
    Returns:
        Extracted text with layout preserved, or None if extraction fails
    """
    return _extract_generic(source, preserve_layout=True)


def extract_simple(source: Union[str, Path, bytes]) -> Optional[str]:
    """
    Extract embedded text from a PDF without layout preservation.
    
    Simpler and faster than extract_direct, suitable for transcripts.
    
    Args:
        source: PDF file path or bytes
        
    Returns:
        Extracted text flow, or None if extraction fails
    """
    return _extract_generic(source, preserve_layout=False)


def _extract_generic(source: Union[str, Path, bytes], preserve_layout: bool = True) -> Optional[str]:
    """Generic PDF text extraction."""
    try:
        if isinstance(source, bytes):
            doc = fitz.open(stream=source, filetype="pdf")
        else:
            path = Path(source)
            if not path.exists():
                logger.debug(f"File not found: {path}")
                return None
            doc = fitz.open(str(path))
        
        all_text = []
        pages_with_text = 0
        
        for page in doc:
            if preserve_layout:
                page_text = _extract_page_with_layout(page)
            else:
                page_text = page.get_text("text")
                
            all_text.append(page_text)
            if len(page_text.strip()) >= MIN_TEXT_CHARS_PER_PAGE:
                pages_with_text += 1
        
        doc.close()
        
        if pages_with_text == 0:
            logger.debug("No pages with sufficient text")
            return None
        
        combined = "\n\n".join(all_text)
        
        if len(combined.strip()) < MIN_TEXT_CHARS_PER_PAGE * 2:
            logger.debug(f"Total text too short: {len(combined.strip())} chars")
            return None
        
        if preserve_layout and _has_garbage_text(combined):
            logger.debug("Text has garbage patterns")
            return None
        
        return combined
        
    except Exception as e:
        logger.debug(f"Extraction failed: {e}")
        return None


def _extract_page_with_layout(page) -> str:
    """
    Extract text from a single page preserving horizontal positioning.
    
    Groups text by Y position, then reconstructs lines with indentation
    based on X position.
    """
    blocks = page.get_text("dict")["blocks"]
    
    lines = {}
    
    for block in blocks:
        if block["type"] != 0:
            continue
        for line in block.get("lines", []):
            bbox = line["bbox"]
            y_pos = int(bbox[1])
            x_pos = int(bbox[0])
            
            text_parts = []
            for span in line.get("spans", []):
                text_parts.append(span["text"])
            line_text = "".join(text_parts)
            
            if not line_text.strip():
                continue
            
            if y_pos not in lines:
                lines[y_pos] = []
            lines[y_pos].append((x_pos, line_text))
    
    output_lines = []
    for y_pos in sorted(lines.keys()):
        line_parts = sorted(lines[y_pos], key=lambda x: x[0])
        first_x = line_parts[0][0]
        indent = int(first_x / 6)
        text = " ".join(part[1] for part in line_parts)
        output_lines.append(" " * indent + text)
    
    return "\n".join(output_lines)


def _has_garbage_text(text: str) -> bool:
    """
    Check if extracted text has signs of corruption/garbage.
    
    Looks at first 50 non-empty lines and checks for:
    - Low alphabetic character ratio
    - Lines of mostly symbols
    """
    import re
    
    lines = text[:3000].split('\n')
    garbage_lines = 0
    checked_lines = 0
    
    for line in lines[:50]:
        line = line.strip()
        if not line:
            continue
        checked_lines += 1
        
        alpha_count = sum(1 for c in line if c.isalpha())
        if len(line) > 3 and alpha_count / len(line) < 0.3:
            garbage_lines += 1
            continue
        
        if re.match(r'^[\W\d_\s]{3,}$', line):
            garbage_lines += 1
    
    if checked_lines == 0:
        return True
    
    ratio = garbage_lines / checked_lines
    return ratio > MAX_GARBAGE_RATIO
