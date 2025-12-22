"""Data models for Compliance Oracle."""

from .documents import (
    Document,
    DocumentSection,
    DocumentChunk,
    ParseResult,
)
from .requirements import (
    Requirement,
    SearchStrategy,
    RequirementExtractionResult,
)
from .findings import (
    Finding,
    ReasoningStep,
    GapDetails,
    AnalysisReport,
    ComplianceStatus,
    Severity,
    PolicySection,
    RetrievalResult,
    ValidationResult,
)

__all__ = [
    # Documents
    "Document",
    "DocumentSection",
    "DocumentChunk",
    "ParseResult",
    # Requirements
    "Requirement",
    "SearchStrategy",
    "RequirementExtractionResult",
    # Findings
    "Finding",
    "ReasoningStep",
    "GapDetails",
    "AnalysisReport",
    "ComplianceStatus",
    "Severity",
    "PolicySection",
    "RetrievalResult",
    "ValidationResult",
]
