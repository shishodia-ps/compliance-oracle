"""PDF document parser using PyMuPDF."""

import fitz  # PyMuPDF
from typing import Optional, List, Dict
import re

from .base import BaseParser
from .language import detect_language


class PDFParser(BaseParser):
    """Parser for PDF documents using PyMuPDF."""

    def __init__(self, file_path: str, enable_ocr: bool = False):
        """Initialize PDF parser.

        Args:
            file_path: Path to PDF file
            enable_ocr: Enable OCR for scanned PDFs (requires pytesseract)
        """
        super().__init__(file_path)
        self.enable_ocr = enable_ocr
        self._doc: Optional[fitz.Document] = None

    def _extract_text(self) -> str:
        """Extract text from PDF.

        Returns:
            Extracted text
        """
        self._doc = fitz.open(self.file_path)

        text_parts = []
        page_texts = []

        for page_num in range(len(self._doc)):
            page = self._doc[page_num]
            page_text = page.get_text()

            # Check if page appears to be scanned (very little text)
            if len(page_text.strip()) < 50 and self.enable_ocr:
                page_text = self._ocr_page(page)

            if page_text.strip():
                # Add page marker for structure extraction
                page_texts.append(f"[PAGE {page_num + 1}]\n{page_text}")

        # Join all pages
        text = "\n\n".join(page_texts)

        # Clean up common PDF artifacts
        text = self._clean_pdf_text(text)

        return text

    def _ocr_page(self, page: fitz.Page) -> str:
        """Perform OCR on a page.

        Args:
            page: PyMuPDF page object

        Returns:
            OCR extracted text
        """
        try:
            import pytesseract
            from PIL import Image
            import io

            # Convert page to image
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))

            # Perform OCR
            text = pytesseract.image_to_string(img)
            return text

        except ImportError:
            # OCR not available
            return ""
        except Exception:
            # OCR failed
            return ""

    def _clean_pdf_text(self, text: str) -> str:
        """Clean up common PDF extraction artifacts.

        Args:
            text: Raw extracted text

        Returns:
            Cleaned text
        """
        # Remove excessive whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Remove page headers/footers (simple pattern matching)
        # This is a basic approach; more sophisticated methods can be added
        lines = text.split('\n')
        cleaned_lines = []

        for i, line in enumerate(lines):
            # Skip lines that look like headers/footers
            if self._is_header_footer(line, i, len(lines)):
                continue
            cleaned_lines.append(line)

        text = '\n'.join(cleaned_lines)

        # Fix common hyphenation issues
        text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)

        return text

    def _is_header_footer(self, line: str, line_num: int, total_lines: int) -> bool:
        """Detect if a line is likely a header or footer.

        Args:
            line: Text line
            line_num: Line number
            total_lines: Total number of lines

        Returns:
            True if likely header/footer
        """
        line = line.strip()

        # Empty lines
        if not line:
            return False

        # Very short lines at top or bottom
        if len(line) < 50 and (line_num < 3 or line_num > total_lines - 3):
            # Check if it's just a page number
            if re.match(r'^\d+$', line):
                return True

            # Check if it looks like a header/footer pattern
            if re.match(r'^(page|p\.|pg\.)\s*\d+', line, re.IGNORECASE):
                return True

        return False

    def _get_page_count(self) -> Optional[int]:
        """Get number of pages in PDF.

        Returns:
            Number of pages
        """
        if self._doc is None:
            self._doc = fitz.open(self.file_path)

        return len(self._doc)

    def _extract_metadata(self) -> dict:
        """Extract PDF metadata.

        Returns:
            Dictionary of metadata
        """
        if self._doc is None:
            self._doc = fitz.open(self.file_path)

        metadata = super()._extract_metadata()

        # Add PDF-specific metadata
        pdf_metadata = self._doc.metadata
        metadata.update({
            "pdf_title": pdf_metadata.get("title", ""),
            "pdf_author": pdf_metadata.get("author", ""),
            "pdf_subject": pdf_metadata.get("subject", ""),
            "pdf_creator": pdf_metadata.get("creator", ""),
            "pdf_producer": pdf_metadata.get("producer", ""),
            "pdf_creation_date": pdf_metadata.get("creationDate", ""),
            "pdf_mod_date": pdf_metadata.get("modDate", ""),
            "is_encrypted": self._doc.is_encrypted,
            "is_pdf": True,
        })

        return metadata

    def _extract_title(self, text: str) -> Optional[str]:
        """Extract title from PDF.

        Args:
            text: PDF text

        Returns:
            Title
        """
        # First try to get title from metadata
        if self._doc:
            metadata_title = self._doc.metadata.get("title", "").strip()
            if metadata_title and len(metadata_title) > 3:
                return metadata_title

        # Fallback to text-based extraction
        return super()._extract_title(text)

    def _detect_language(self, text: str) -> str:
        """Detect document language.

        Args:
            text: Document text

        Returns:
            Language code
        """
        return detect_language(text)

    def extract_table_of_contents(self) -> List[Dict[str, any]]:
        """Extract table of contents from PDF.

        Returns:
            List of TOC entries
        """
        if self._doc is None:
            self._doc = fitz.open(self.file_path)

        toc = self._doc.get_toc()
        toc_entries = []

        for level, title, page in toc:
            toc_entries.append({
                "level": level,
                "title": title,
                "page": page,
            })

        return toc_entries

    def is_scanned_pdf(self) -> bool:
        """Detect if PDF is scanned (image-based).

        Returns:
            True if PDF appears to be scanned
        """
        if self._doc is None:
            self._doc = fitz.open(self.file_path)

        # Sample first 3 pages
        sample_pages = min(3, len(self._doc))
        total_text_length = 0

        for page_num in range(sample_pages):
            page = self._doc[page_num]
            text = page.get_text()
            total_text_length += len(text.strip())

        # If average text per page is very low, likely scanned
        avg_text_per_page = total_text_length / sample_pages
        return avg_text_per_page < 100

    def __del__(self):
        """Clean up PDF document."""
        if self._doc:
            self._doc.close()
