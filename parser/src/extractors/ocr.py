"""
OCR PDF Text Extraction

Pure function: extracts text from PDFs using Tesseract OCR.
Preserves layout/indentation for screenplay structure.

Use when direct extraction fails (image-based PDFs).
"""

import logging
from pathlib import Path
from typing import Optional, Union

try:
    from pdf2image import convert_from_path, convert_from_bytes
    import pytesseract
    from pytesseract import Output
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

logger = logging.getLogger(__name__)


def extract_ocr(
    source: Union[str, Path, bytes],
    dpi: int = 200,
    max_pages: Optional[int] = None,
) -> Optional[str]:
    """
    Extract text from a PDF using Tesseract OCR.
    
    Preserves horizontal positioning (indentation) for screenplay parsing.
    
    Args:
        source: PDF file path or bytes
        dpi: Resolution for rendering PDF pages (higher = better quality, slower)
        max_pages: Maximum pages to process (None = all)
        
    Returns:
        Extracted text with layout preserved, or None if extraction fails
    """
    if not OCR_AVAILABLE:
        logger.error("OCR dependencies not available. Install pdf2image and pytesseract.")
        return None
        
    try:
        if isinstance(source, bytes):
            images = convert_from_bytes(source, dpi=dpi)
        else:
            path = Path(source)
            if not path.exists():
                logger.debug(f"File not found: {path}")
                return None
            images = convert_from_path(str(path), dpi=dpi)
        
        if max_pages:
            images = images[:max_pages]
        
        all_text = []
        for page_num, img in enumerate(images):
            page_text = _ocr_page_with_layout(img)
            all_text.append(page_text)
            logger.debug(f"OCR page {page_num + 1}: {len(page_text)} chars")
        
        return "\n\n".join(all_text)
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return None


def _ocr_page_with_layout(img) -> str:
    """
    OCR a single page image preserving horizontal positioning.
    
    Uses Tesseract's word-level bounding boxes to reconstruct
    lines with proper indentation.
    """
    data = pytesseract.image_to_data(img, config='--psm 4', output_type=Output.DICT)
    
    lines = {}
    for i, text in enumerate(data['text']):
        if text.strip():
            block_num = data['block_num'][i]
            line_num = data['line_num'][i]
            key = (block_num, line_num)
            x = data['left'][i]
            if key not in lines:
                lines[key] = []
            lines[key].append((x, text))
    
    output_lines = []
    for key in sorted(lines.keys()):
        words = sorted(lines[key], key=lambda w: w[0])
        first_x = words[0][0]
        indent = int(first_x / 12)
        line_text = ' ' * indent + ' '.join(w[1] for w in words)
        output_lines.append(line_text)
    
    return '\n'.join(output_lines)


def extract_ocr_pages(
    source: Union[str, Path, bytes],
    dpi: int = 200,
) -> list[str]:
    """
    Extract text from each PDF page separately using OCR.
    
    Args:
        source: PDF file path or bytes
        dpi: Resolution for rendering PDF pages
        
    Returns:
        List of extracted text, one per page
    """
    if not OCR_AVAILABLE:
        logger.error("OCR dependencies not available.")
        return []
        
    try:
        if isinstance(source, bytes):
            images = convert_from_bytes(source, dpi=dpi)
        else:
            path = Path(source)
            if not path.exists():
                return []
            images = convert_from_path(str(path), dpi=dpi)
        
        pages = []
        for img in images:
            page_text = _ocr_page_with_layout(img)
            pages.append(page_text)
        
        return pages
        
    except Exception as e:
        logger.error(f"OCR page extraction failed: {e}")
        return []
