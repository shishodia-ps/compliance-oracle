"""Finding and gap data models."""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum


class ComplianceStatus(str, Enum):
    """Compliance status determination."""
    COMPLIANT = "compliant"
    PARTIAL_GAP = "partial_gap"
    GAP = "gap"
    CONTRADICTION = "contradiction"
    UNCERTAIN = "uncertain"


class Severity(str, Enum):
    """Gap severity level."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class ReasoningStep:
    """A single step in the reasoning chain."""
    step: int
    observation: str
    analysis: str

    def __str__(self) -> str:
        """String representation."""
        return f"{self.step}. {self.observation} → {self.analysis}"


@dataclass
class PolicySection:
    """A policy section found during retrieval."""
    section_id: str
    title: Optional[str]
    content: str
    relevance_score: float
    page: Optional[int] = None
    found_by_query: Optional[str] = None

    def __str__(self) -> str:
        """String representation."""
        return f"Section {self.section_id} (score: {self.relevance_score:.2f})"


@dataclass
class GapDetails:
    """Detailed information about a gap."""
    what_is_missing: str
    policy_has: Optional[str] = None
    policy_lacks: Optional[str] = None
    specific_deficiency: Optional[str] = None


@dataclass
class Finding:
    """A compliance finding (gap or confirmation)."""
    requirement_id: str
    requirement_citation: str
    requirement_text: str
    status: ComplianceStatus
    confidence: float
    reasoning_chain: List[ReasoningStep] = field(default_factory=list)
    sections_found: List[PolicySection] = field(default_factory=list)
    gap_details: Optional[GapDetails] = None
    recommendation: Optional[str] = None
    severity: Optional[Severity] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_gap(self) -> bool:
        """Check if this finding represents a gap."""
        return self.status in [
            ComplianceStatus.GAP,
            ComplianceStatus.PARTIAL_GAP,
            ComplianceStatus.CONTRADICTION
        ]

    def get_severity_score(self) -> int:
        """Get numeric severity score (higher = more severe)."""
        severity_map = {
            Severity.CRITICAL: 4,
            Severity.HIGH: 3,
            Severity.MEDIUM: 2,
            Severity.LOW: 1,
        }
        return severity_map.get(self.severity, 0)

    def __str__(self) -> str:
        """String representation."""
        return f"Finding({self.requirement_citation}, {self.status.value}, conf={self.confidence:.2f})"


@dataclass
class ValidationResult:
    """Result of finding validation."""
    is_valid: bool
    validation_checks: Dict[str, bool] = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)

    def __str__(self) -> str:
        """String representation."""
        status = "VALID" if self.is_valid else "INVALID"
        return f"ValidationResult({status}, {len(self.issues)} issues)"


@dataclass
class RetrievalResult:
    """Result of the retrieval process."""
    requirement_id: str
    retrieval_attempts: int
    queries_executed: List[str]
    sections_found: List[PolicySection]
    coverage_assessment: str  # "comprehensive", "partial", "insufficient", "none"
    confidence: float

    def __str__(self) -> str:
        """String representation."""
        return f"RetrievalResult({len(self.sections_found)} sections, {self.coverage_assessment})"
