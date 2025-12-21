"""Document data models."""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    """Document type enumeration."""
    POLICY = "policy"
    BENCHMARK = "benchmark"
    REGULATION = "regulation"
    GUIDELINE = "guideline"


class DocumentFormat(str, Enum):
    """Document format enumeration."""
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"
    HTML = "html"
    TXT = "txt"
    MD = "md"
    RTF = "rtf"
    XLSX = "xlsx"
    CSV = "csv"


@dataclass
class DocumentMetadata:
    """Metadata for a document."""
    filename: str
    format: DocumentFormat
    document_type: DocumentType
    file_size: int
    page_count: Optional[int] = None
    language: Optional[str] = None
    jurisdiction: Optional[str] = None
    domain: Optional[str] = None
    upload_date: datetime = field(default_factory=datetime.now)
    version: Optional[str] = None
    effective_date: Optional[datetime] = None
    custom_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Section:
    """A section within a document."""
    section_id: str
    title: Optional[str]
    content: str
    page: Optional[int] = None
    parent_section_id: Optional[str] = None
    subsection_ids: List[str] = field(default_factory=list)
    level: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        """String representation."""
        title_str = f" {self.title}" if self.title else ""
        return f"Section {self.section_id}{title_str}"


@dataclass
class Chunk:
    """A text chunk for vector embedding."""
    chunk_id: str
    section_id: str
    content: str
    translated_content: Optional[str] = None
    page: Optional[int] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Document:
    """A parsed document with structured content."""
    document_id: str
    metadata: DocumentMetadata
    sections: List[Section] = field(default_factory=list)
    raw_text: Optional[str] = None
    structure_tree: Optional[Dict[str, Any]] = None
    language: Optional[str] = None

    def get_section(self, section_id: str) -> Optional[Section]:
        """Get a section by ID."""
        for section in self.sections:
            if section.section_id == section_id:
                return section
        return None

    def get_sections_by_page(self, page: int) -> List[Section]:
        """Get all sections on a specific page."""
        return [s for s in self.sections if s.page == page]

    def get_all_text(self) -> str:
        """Get all text from all sections."""
        return "\n\n".join(s.content for s in self.sections)

    def __str__(self) -> str:
        """String representation."""
        return f"Document({self.metadata.filename}, {len(self.sections)} sections)"
