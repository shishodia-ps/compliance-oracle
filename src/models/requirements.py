"""Requirement data models."""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum


class RequirementType(str, Enum):
    """Type of requirement."""
    MANDATORY = "mandatory"
    RECOMMENDED = "recommended"
    OPTIONAL = "optional"
    DEFINITION = "definition"
    EXEMPTION = "exemption"


class RequirementCategory(str, Enum):
    """Requirement category."""
    CDD = "CDD"
    EDD = "EDD"
    KYC = "KYC"
    UBO = "UBO"
    PEP = "PEP"
    SANCTIONS = "SANCTIONS"
    STR = "STR"
    RISK = "RISK"
    GOVERNANCE = "GOVERNANCE"
    TRAINING = "TRAINING"
    RECORD_KEEPING = "RECORD_KEEPING"
    OTHER = "OTHER"


class Criticality(str, Enum):
    """Requirement criticality level."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Requirement:
    """A regulatory requirement extracted from a benchmark document."""
    requirement_id: str
    source: str
    citation: str
    type: RequirementType
    category: RequirementCategory
    text: str
    obligations: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    cross_references: List[str] = field(default_factory=list)
    criticality: Criticality = Criticality.MEDIUM
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        """String representation."""
        return f"Requirement({self.citation}: {self.text[:50]}...)"


@dataclass
class SearchStrategy:
    """Search strategy for finding policy coverage of a requirement."""
    requirement_id: str
    primary_queries: List[str] = field(default_factory=list)
    secondary_queries: List[str] = field(default_factory=list)
    category_queries: List[str] = field(default_factory=list)
    concepts_to_find: List[str] = field(default_factory=list)
    negation_queries: List[str] = field(default_factory=list)

    def get_all_queries(self) -> List[str]:
        """Get all queries in order of priority."""
        return (
            self.primary_queries +
            self.secondary_queries +
            self.category_queries
        )
