"""
PDF JSON Extractor using pdfplumber

Extracts structured data from PDFs including:
- Text content with bounding boxes
- Font information
- Margin positions

This data can be used for margin-based element classification.
"""

import logging
from pathlib import Path
from typing import Optional, Union
from dataclasses import dataclass

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    pdfplumber = None
    PDFPLUMBER_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class TextElement:
    """Represents a text element extracted from PDF."""
    text: str
    x0: float
    x1: float
    top: float
    bottom: float
    page_num: int
    font_name: Optional[str] = None
    font_size: Optional[float] = None

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.bottom - self.top

    @property
    def center_x(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class PageData:
    """Represents extracted data from a single page."""
    page_num: int
    width: float
    height: float
    elements: list[TextElement]


@dataclass
class PDFData:
    """Represents extracted data from an entire PDF."""
    path: Path
    pages: list[PageData]
    total_pages: int

    @property
    def all_elements(self) -> list[TextElement]:
        """Get all elements across all pages."""
        elements = []
        for page in self.pages:
            elements.extend(page.elements)
        return elements


class PDFJsonExtractor:
    """Extracts structured JSON data from PDFs using pdfplumber."""

    def __init__(self):
        """Initialize the extractor."""
        pass

    def extract_page(self, page: "pdfplumber.page.Page", page_num: int) -> PageData:
        """
        Extract data from a single page.

        Args:
            page: pdfplumber page object
            page_num: Page number (0-indexed)

        Returns:
            PageData object with extracted elements
        """
        elements = []

        words = page.extract_words(
            x_tolerance=3,
            y_tolerance=3,
            keep_blank_chars=False,
            use_text_flow=True,
            extra_attrs=["fontname", "size"]
        )

        for word in words:
            elem = TextElement(
                text=word.get("text", ""),
                x0=word.get("x0", 0),
                x1=word.get("x1", 0),
                top=word.get("top", 0),
                bottom=word.get("bottom", 0),
                page_num=page_num,
                font_name=word.get("fontname"),
                font_size=word.get("size")
            )
            elements.append(elem)

        return PageData(
            page_num=page_num,
            width=page.width,
            height=page.height,
            elements=elements
        )

    def extract(self, path: Union[str, Path, bytes]) -> Optional[PDFData]:
        """
        Extract structured data from a PDF.

        Args:
            path: Path to PDF file or PDF bytes

        Returns:
            PDFData object, or None if extraction failed
        """
        if not PDFPLUMBER_AVAILABLE:
            logger.error("pdfplumber not available")
            return None
            
        try:
            if isinstance(path, bytes):
                import io
                pdf = pdfplumber.open(io.BytesIO(path))
                file_path = Path("bytes_input.pdf")
            else:
                path = Path(path)
                if not path.exists():
                    logger.error(f"File not found: {path}")
                    return None
                pdf = pdfplumber.open(path)
                file_path = path

            pages = []
            for i, page in enumerate(pdf.pages):
                page_data = self.extract_page(page, i)
                pages.append(page_data)

            pdf.close()

            return PDFData(
                path=file_path,
                pages=pages,
                total_pages=len(pages)
            )

        except Exception as e:
            logger.error(f"Error extracting PDF: {e}")
            return None

    def extract_lines(self, path: Union[str, Path, bytes]) -> list[dict]:
        """
        Extract lines of text with their positions.

        Groups words into lines based on vertical position.

        Args:
            path: Path to PDF file or PDF bytes

        Returns:
            List of line dicts with text and position info
        """
        pdf_data = self.extract(path)
        if not pdf_data:
            return []

        lines = []
        for page in pdf_data.pages:
            y_groups = {}
            for elem in page.elements:
                y_key = round(elem.top / 5) * 5
                if y_key not in y_groups:
                    y_groups[y_key] = []
                y_groups[y_key].append(elem)

            for y_key in sorted(y_groups.keys()):
                group = sorted(y_groups[y_key], key=lambda e: e.x0)
                text = " ".join(e.text for e in group)

                if text.strip():
                    lines.append({
                        "text": text,
                        "page": page.page_num,
                        "x0": min(e.x0 for e in group),
                        "x1": max(e.x1 for e in group),
                        "top": min(e.top for e in group),
                        "bottom": max(e.bottom for e in group),
                        "center_x": sum(e.center_x for e in group) / len(group),
                        "page_width": page.width
                    })

        return lines

    def to_dict(self, pdf_data: PDFData) -> dict:
        """
        Convert PDFData to a JSON-serializable dict.

        Args:
            pdf_data: PDFData object

        Returns:
            Dict representation
        """
        return {
            "path": str(pdf_data.path),
            "total_pages": pdf_data.total_pages,
            "pages": [
                {
                    "page_num": page.page_num,
                    "width": page.width,
                    "height": page.height,
                    "elements": [
                        {
                            "text": elem.text,
                            "x0": elem.x0,
                            "x1": elem.x1,
                            "top": elem.top,
                            "bottom": elem.bottom,
                            "font_name": elem.font_name,
                            "font_size": elem.font_size
                        }
                        for elem in page.elements
                    ]
                }
                for page in pdf_data.pages
            ]
        }
