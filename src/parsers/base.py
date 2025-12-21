"""Base parser class for document processing."""

import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
import hashlib

from src.models.documents import Document, ParseResult


class BaseParser(ABC):
    """Abstract base class for all document parsers."""

    def __init__(self, file_path: str):
        """Initialize parser with file path.

        Args:
            file_path: Path to the document to parse
        """
        self.file_path = Path(file_path)
        self.filename = self.file_path.name
        self.file_type = self.file_path.suffix.lstrip('.')

        if not self.file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

    def parse(self) -> ParseResult:
        """Parse the document and return result.

        Returns:
            ParseResult containing the parsed document or error
        """
        start_time = time.time()
        warnings = []

        try:
            # Check file size
            file_size_mb = self.file_path.stat().st_size / (1024 * 1024)
            if file_size_mb > 50:  # 50MB limit
                warnings.append(f"Large file ({file_size_mb:.1f} MB) - processing may be slow")

            # Extract text
            raw_text = self._extract_text()

            if not raw_text or len(raw_text.strip()) < 50:
                return ParseResult(
                    success=False,
                    document=None,
                    error="Document appears empty or has insufficient text",
                    warnings=warnings,
                    processing_time=time.time() - start_time
                )

            # Detect language
            language = self._detect_language(raw_text)

            # Create document ID
            document_id = self._generate_document_id()

            # Create document object
            document = Document(
                document_id=document_id,
                filename=self.filename,
                file_type=self.file_type,
                title=self._extract_title(raw_text),
                language=language,
                raw_text=raw_text,
                sections=[],  # Will be populated by structure extractor
                chunks=[],     # Will be populated later
                total_pages=self._get_page_count(),
                metadata=self._extract_metadata()
            )

            return ParseResult(
                success=True,
                document=document,
                error=None,
                warnings=warnings,
                processing_time=time.time() - start_time
            )

        except Exception as e:
            return ParseResult(
                success=False,
                document=None,
                error=f"Error parsing document: {str(e)}",
                warnings=warnings,
                processing_time=time.time() - start_time
            )

    @abstractmethod
    def _extract_text(self) -> str:
        """Extract raw text from the document.

        Returns:
            Extracted text as string
        """
        pass

    @abstractmethod
    def _get_page_count(self) -> Optional[int]:
        """Get the total number of pages in the document.

        Returns:
            Number of pages or None if not applicable
        """
        pass

    def _extract_title(self, text: str) -> Optional[str]:
        """Extract document title from text.

        Args:
            text: Document text

        Returns:
            Extracted title or None
        """
        # Default implementation: take first non-empty line
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if lines:
            # Take first line, limit to 200 chars
            return lines[0][:200]
        return None

    def _detect_language(self, text: str) -> str:
        """Detect document language.

        Args:
            text: Document text

        Returns:
            Language code (default: 'en')
        """
        # Will be implemented in language.py module
        # For now, default to English
        return "en"

    def _extract_metadata(self) -> dict:
        """Extract document metadata.

        Returns:
            Dictionary of metadata
        """
        return {
            "file_size": self.file_path.stat().st_size,
            "file_extension": self.file_type,
        }

    def _generate_document_id(self) -> str:
        """Generate unique document ID.

        Returns:
            Unique document identifier
        """
        # Use hash of file path and size
        hash_input = f"{self.file_path}{self.file_path.stat().st_size}"
        hash_value = hashlib.md5(hash_input.encode()).hexdigest()[:12]
        return f"doc_{hash_value}"

    def validate_file(self) -> tuple[bool, Optional[str]]:
        """Validate the file before parsing.

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.file_path.exists():
            return False, "File does not exist"

        if not self.file_path.is_file():
            return False, "Path is not a file"

        if self.file_path.stat().st_size == 0:
            return False, "File is empty"

        return True, None
