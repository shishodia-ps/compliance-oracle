"""Pydantic models for compliance findings."""

from typing import List, Optional, Dict, Literal
from enum import Enum
from pydantic import BaseModel, Field


class ComplianceStatus(str, Enum):
    """Compliance status enum."""
    COMPLIANT = "compliant"
    PARTIAL_GAP = "partial_gap"
    GAP = "gap"
    CONTRADICTION = "contradiction"
    UNCERTAIN = "uncertain"


class Severity(str, Enum):
    """Severity level enum."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class PolicySection(BaseModel):
    """A section from the policy document."""
    section_id: str = Field(..., description="Section identifier")
    title: str = Field(..., description="Section title")
    content: str = Field(..., description="Section content")
    page_number: Optional[int] = Field(None, description="Page number")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Relevance score")


class RetrievalResult(BaseModel):
    """Result from retrieving relevant policy sections."""
    requirement_id: str = Field(..., description="Requirement ID")
    policy_sections: List[PolicySection] = Field(default_factory=list, description="Retrieved sections")
    total_sections_found: int = Field(default=0, description="Total sections found")
    retrieval_strategy: str = Field(..., description="Strategy used for retrieval")
    metadata: Dict = Field(default_factory=dict, description="Additional metadata")


class ValidationResult(BaseModel):
    """Result from validating a finding."""
    finding_id: str = Field(..., description="Finding ID")
    is_valid: bool = Field(..., description="Whether the finding is valid")
    validation_notes: List[str] = Field(default_factory=list, description="Validation notes")
    updated_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Updated confidence score")
    updated_status: Optional[str] = Field(None, description="Updated status")
    metadata: Dict = Field(default_factory=dict, description="Additional metadata")


class ReasoningStep(BaseModel):
    """A single step in the reasoning chain."""

    step: int = Field(..., description="Step number")
    observation: str = Field(..., description="What was observed")
    analysis: str = Field(..., description="Analysis of the observation")


class GapDetails(BaseModel):
    """Details about a compliance gap."""

    what_is_missing: str = Field(..., description="What is missing from the policy")
    policy_has: Optional[str] = Field(None, description="What the policy currently has")
    policy_lacks: str = Field(..., description="What the policy lacks")


class Finding(BaseModel):
    """A compliance finding (gap, partial compliance, or compliance confirmation)."""

    finding_id: str = Field(..., description="Unique finding identifier")
    requirement_id: str = Field(..., description="Associated requirement ID")
    requirement_citation: str = Field(..., description="Requirement citation")
    requirement_text: str = Field(..., description="Requirement text")
    status: Literal["compliant", "partial_gap", "gap", "contradiction", "uncertain"] = Field(
        ...,
        description="Compliance status"
    )
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    severity: Literal["critical", "high", "medium", "low"] = Field(
        ...,
        description="Severity level"
    )
    reasoning_chain: List[ReasoningStep] = Field(
        default_factory=list,
        description="Chain of reasoning steps"
    )
    gap_details: Optional[GapDetails] = Field(None, description="Details about the gap")
    policy_sections_reviewed: List[str] = Field(
        default_factory=list,
        description="Policy sections that were reviewed"
    )
    recommendation: str = Field(..., description="Actionable recommendation")
    metadata: Dict = Field(default_factory=dict, description="Additional metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "finding_id": "FIND-001",
                "requirement_id": "AMLD6-Art-3-6-a",
                "requirement_citation": "Article 3(6)(a)",
                "requirement_text": "...",
                "status": "partial_gap",
                "confidence": 0.85,
                "severity": "high",
                "reasoning_chain": [],
                "gap_details": None,
                "policy_sections_reviewed": ["2.3", "2.3.1"],
                "recommendation": "Add to Section 2.3: 'Beneficial owner means...'",
                "metadata": {}
            }
        }


class AnalysisReport(BaseModel):
    """Complete analysis report."""

    report_id: str = Field(..., description="Unique report identifier")
    policy_document_name: str = Field(..., description="Policy document name")
    benchmark_name: str = Field(..., description="Benchmark name")
    jurisdiction: str = Field(..., description="Jurisdiction")
    domain: str = Field(..., description="Domain (e.g., AML)")
    findings: List[Finding] = Field(default_factory=list, description="All findings")
    total_requirements_checked: int = Field(default=0, description="Total requirements checked")
    total_gaps_found: int = Field(default=0, description="Total gaps found")
    compliant_count: int = Field(default=0, description="Number of compliant requirements")
    gap_count: int = Field(default=0, description="Number of gaps")
    partial_count: int = Field(default=0, description="Number of partial gaps")
    summary: str = Field(..., description="Executive summary")
    metadata: Dict = Field(default_factory=dict, description="Additional metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "report_id": "RPT-001",
                "policy_document_name": "AML Policy v2.3",
                "benchmark_name": "EU AMLD6",
                "jurisdiction": "Luxembourg",
                "domain": "AML",
                "findings": [],
                "total_requirements_checked": 35,
                "total_gaps_found": 8,
                "compliant_count": 25,
                "gap_count": 8,
                "partial_count": 2,
                "summary": "The policy is largely compliant with...",
                "metadata": {}
            }
        }
