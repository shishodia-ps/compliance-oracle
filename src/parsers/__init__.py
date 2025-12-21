"""Document parsers for Compliance Oracle."""

from src.parsers.base import BaseParser
from src.parsers.pdf import PDFParser
from src.parsers.docx import DOCXParser
from src.parsers.language import (
    detect_language,
    detect_mixed_languages,
    is_legal_document,
    get_language_name,
)
from src.parsers.structure import (
    StructureExtractor,
    extract_structure,
)

__all__ = [
    "BaseParser",
    "PDFParser",
    "DOCXParser",
    "detect_language",
    "detect_mixed_languages",
    "is_legal_document",
    "get_language_name",
    "StructureExtractor",
    "extract_structure",
]
