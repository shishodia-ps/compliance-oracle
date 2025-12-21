"""Pydantic models for regulatory requirements."""

from typing import List, Optional, Dict, Literal
from pydantic import BaseModel, Field


class Requirement(BaseModel):
    """A discrete regulatory requirement extracted from a benchmark document."""

    requirement_id: str = Field(..., description="Unique requirement identifier (e.g., 'AMLD6-Art-14-5')")
    source: str = Field(..., description="Regulatory source name (e.g., 'EU AMLD6')")
    citation: str = Field(..., description="Article/section reference (e.g., 'Article 14(5)')")
    text: str = Field(..., description="Full requirement text")
    requirement_type: Literal["mandatory", "recommended", "definition", "guidance", "exemption"] = Field(
        default="mandatory",
        description="Type of requirement"
    )
    category: str = Field(..., description="Compliance category (e.g., 'Enhanced Due Diligence')")
    obligations: List[str] = Field(
        default_factory=list,
        description="Specific obligations extracted from requirement"
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Search keywords and synonyms"
    )
    cross_references: List[str] = Field(
        default_factory=list,
        description="References to other articles/sections"
    )
    criticality: Literal["critical", "high", "medium", "low"] = Field(
        default="high",
        description="Criticality level"
    )
    metadata: Dict = Field(default_factory=dict, description="Additional metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "requirement_id": "AMLD6-Art-14-5",
                "source": "EU AMLD6",
                "citation": "Article 14(5)",
                "text": "Member States shall require that enhanced CDD measures are applied...",
                "requirement_type": "mandatory",
                "category": "Enhanced Due Diligence",
                "obligations": ["Apply enhanced CDD for high-risk situations"],
                "keywords": ["enhanced due diligence", "EDD", "high risk"],
                "cross_references": ["Article 18", "Article 18a"],
                "criticality": "high",
                "metadata": {}
            }
        }


class SearchStrategy(BaseModel):
    """Search strategy for a requirement."""

    requirement_id: str = Field(..., description="Associated requirement ID")
    primary_queries: List[str] = Field(
        default_factory=list,
        description="Primary search queries"
    )
    secondary_queries: List[str] = Field(
        default_factory=list,
        description="Secondary/fallback queries"
    )
    category_queries: List[str] = Field(
        default_factory=list,
        description="Category-level queries"
    )
    concepts_to_find: List[str] = Field(
        default_factory=list,
        description="Concepts that should be present"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "requirement_id": "AMLD6-Art-3-6-a",
                "primary_queries": ["beneficial owner", "ultimate beneficial owner", "UBO"],
                "secondary_queries": ["ownership threshold", "25 percent ownership"],
                "category_queries": ["customer due diligence ownership"],
                "concepts_to_find": ["ownership identification process"]
            }
        }


class RequirementExtractionResult(BaseModel):
    """Result of requirement extraction from a benchmark document."""

    success: bool = Field(..., description="Whether extraction succeeded")
    requirements: List[Requirement] = Field(
        default_factory=list,
        description="Extracted requirements"
    )
    total_requirements: int = Field(default=0, description="Total number of requirements extracted")
    error: Optional[str] = Field(None, description="Error message if failed")
    warnings: List[str] = Field(default_factory=list, description="Warning messages")
    processing_time: Optional[float] = Field(None, description="Processing time in seconds")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "requirements": [],
                "total_requirements": 35,
                "error": None,
                "warnings": [],
                "processing_time": 45.2
            }
        }
