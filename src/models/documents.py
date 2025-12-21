"""Pydantic models for document structures."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class DocumentSection(BaseModel):
    """A section within a document."""

    section_id: str = Field(..., description="Section identifier (e.g., '3.2.1')")
    title: str = Field(..., description="Section title")
    content: str = Field(..., description="Section content/text")
    page: Optional[int] = Field(None, description="Page number where section appears")
    parent: Optional[str] = Field(None, description="Parent section ID")
    subsections: List[str] = Field(default_factory=list, description="List of subsection IDs")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "section_id": "3.2",
                "title": "Customer Due Diligence",
                "content": "The bank shall perform CDD on all customers...",
                "page": 12,
                "parent": "3",
                "subsections": ["3.2.1", "3.2.2"],
                "metadata": {}
            }
        }


class DocumentChunk(BaseModel):
    """A chunk of text from a document for embedding."""

    chunk_id: str = Field(..., description="Unique chunk identifier")
    content: str = Field(..., description="Chunk content")
    section_id: Optional[str] = Field(None, description="Associated section ID")
    page: Optional[int] = Field(None, description="Page number")
    chunk_index: int = Field(..., description="Index of chunk in document")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class Document(BaseModel):
    """A parsed document with structure."""

    document_id: str = Field(..., description="Unique document identifier")
    filename: str = Field(..., description="Original filename")
    file_type: str = Field(..., description="File type (pdf, docx, etc.)")
    title: Optional[str] = Field(None, description="Document title")
    language: str = Field(default="en", description="Detected language code")
    raw_text: str = Field(..., description="Raw extracted text")
    sections: List[DocumentSection] = Field(default_factory=list, description="Structured sections")
    chunks: List[DocumentChunk] = Field(default_factory=list, description="Text chunks for embedding")
    total_pages: Optional[int] = Field(None, description="Total number of pages")
    parsed_at: datetime = Field(default_factory=datetime.utcnow, description="When document was parsed")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "doc_123",
                "filename": "aml_policy.pdf",
                "file_type": "pdf",
                "title": "Anti-Money Laundering Policy",
                "language": "en",
                "raw_text": "Full document text...",
                "sections": [],
                "chunks": [],
                "total_pages": 50,
                "metadata": {}
            }
        }


class ParseResult(BaseModel):
    """Result of document parsing operation."""

    success: bool = Field(..., description="Whether parsing succeeded")
    document: Optional[Document] = Field(None, description="Parsed document if successful")
    error: Optional[str] = Field(None, description="Error message if failed")
    warnings: List[str] = Field(default_factory=list, description="Warning messages")
    processing_time: Optional[float] = Field(None, description="Processing time in seconds")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "document": None,
                "error": None,
                "warnings": ["Document may be incomplete"],
                "processing_time": 2.5
            }
        }
