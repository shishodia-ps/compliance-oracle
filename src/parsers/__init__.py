"""Document parsers for Compliance Oracle."""

from .base import BaseParser
from .pdf import PDFParser
from .docx import DOCXParser
from .language import (
    detect_language,
    detect_mixed_languages,
    is_legal_document,
    get_language_name,
)
from .structure import (
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
