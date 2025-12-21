"""Requirement Extractor Agent - Extracts discrete requirements from regulatory benchmarks."""

import re
import json
from typing import List, Dict, Any, Optional, Literal
import logging

from src.agents.base import BaseAgent
from src.models.documents import Document, DocumentSection
from src.models.requirements import (
    Requirement,
    RequirementExtractionResult,
)
from src.config.keywords import MULTILINGUAL_KEYWORDS

logger = logging.getLogger(__name__)


class RequirementExtractorAgent(BaseAgent):
    """
    Agent that transforms raw regulatory text into discrete, searchable requirements.

    This agent:
    1. Identifies document type (law, regulation, guideline)
    2. Detects structure (articles, sections, recitals)
    3. Extracts requirements (MUST/SHALL/REQUIRED) vs definitions vs guidance
    4. Categorizes requirements by compliance domain
    5. Generates search keywords and synonyms
    6. Identifies cross-references
    """

    # Requirement indicators (modal verbs)
    MANDATORY_INDICATORS = [
        r'\bshall\b', r'\bmust\b', r'\brequired to\b', r'\bobligation to\b',
        r'\bobligated to\b', r'\bmandatory\b', r'\bis required\b', r'\bare required\b',
    ]

    RECOMMENDED_INDICATORS = [
        r'\bshould\b', r'\bmay\b', r'\brecommended\b', r'\bencouraged\b',
        r'\badvisable\b', r'\bsuggested\b',
    ]

    DEFINITION_INDICATORS = [
        r'\bmeans\b', r'\brefers to\b', r'\bdefined as\b', r'\bshall mean\b',
        r'\bfor the purposes of\b', r'\bis understood as\b',
    ]

    EXEMPTION_INDICATORS = [
        r'\bexcept\b', r'\bunless\b', r'\bnot applicable\b', r'\bexempted\b',
        r'\bdoes not apply\b', r'\bexcluded\b',
    ]

    def __init__(self, llm_client: Any, config: Optional[Dict[str, Any]] = None):
        """Initialize Requirement Extractor Agent.

        Args:
            llm_client: LLM client for requirement extraction
            config: Agent configuration
        """
        super().__init__(llm_client, config)

        # Get max requirements from config
        self.max_requirements = self.config.get('max_requirements', 100)

        # Get domain context
        self.domain = self.config.get('domain', 'AML')
        self.jurisdiction = self.config.get('jurisdiction', 'EU')

    async def run(
        self,
        document: Document,
        source_name: str,
        domain: Optional[str] = None,
    ) -> RequirementExtractionResult:
        """Extract requirements from a regulatory benchmark document.

        Args:
            document: Parsed benchmark document
            source_name: Name of the regulatory source (e.g., "EU AMLD6")
            domain: Compliance domain (e.g., "AML", "GDPR")

        Returns:
            RequirementExtractionResult with extracted requirements
        """
        import time
        start_time = time.time()

        self.log(f"Starting requirement extraction from {source_name}")

        try:
            # Step 1: Document understanding
            doc_type = self._identify_document_type(document)
            self.log(f"Document type identified: {doc_type}")

            # Step 2: Extract requirements from sections
            requirements = []

            if document.sections:
                # Use structured sections
                for section in document.sections:
                    section_requirements = self._extract_from_section(
                        section, source_name, domain or self.domain
                    )
                    requirements.extend(section_requirements)
            else:
                # Fallback: extract from raw text
                self.log("No sections found, extracting from raw text")
                requirements = self._extract_from_text(
                    document.raw_text, source_name, domain or self.domain
                )

            # Step 3: Enrich requirements
            requirements = self._enrich_requirements(requirements, document)

            # Step 4: Filter and limit
            requirements = self._filter_requirements(requirements)

            # Limit to max requirements
            if len(requirements) > self.max_requirements:
                self.log(
                    f"Limiting requirements from {len(requirements)} to {self.max_requirements}",
                    level="warning"
                )
                requirements = requirements[:self.max_requirements]

            processing_time = time.time() - start_time

            self.log(f"Extracted {len(requirements)} requirements in {processing_time:.2f}s")

            return RequirementExtractionResult(
                success=True,
                requirements=requirements,
                total_requirements=len(requirements),
                error=None,
                warnings=[],
                processing_time=processing_time,
            )

        except Exception as e:
            self.log(f"Error extracting requirements: {str(e)}", level="error")
            return RequirementExtractionResult(
                success=False,
                requirements=[],
                total_requirements=0,
                error=str(e),
                warnings=[],
                processing_time=time.time() - start_time,
            )

    def _identify_document_type(self, document: Document) -> str:
        """Identify the type of regulatory document.

        Args:
            document: Document to analyze

        Returns:
            Document type (law, regulation, directive, guideline, etc.)
        """
        text_sample = document.raw_text[:5000].lower()

        # Check for directive
        if re.search(r'\bdirective\b.*\d{4}/\d+', text_sample):
            return "directive"

        # Check for regulation
        if re.search(r'\bregulation\b.*\d{4}/\d+', text_sample):
            return "regulation"

        # Check for law
        if re.search(r'\b(law|act|statute)\b', text_sample):
            return "law"

        # Check for guideline
        if re.search(r'\b(guideline|guidance|recommendation)\b', text_sample):
            return "guideline"

        return "unknown"

    def _extract_from_section(
        self,
        section: DocumentSection,
        source_name: str,
        domain: str,
    ) -> List[Requirement]:
        """Extract requirements from a document section.

        Args:
            section: Document section
            source_name: Regulatory source name
            domain: Compliance domain

        Returns:
            List of extracted requirements
        """
        requirements = []

        # Check if section contains requirements
        req_type = self._classify_text_type(section.content)

        if req_type in ["mandatory", "recommended"]:
            # Extract specific obligations
            obligations = self._extract_obligations(section.content)

            if obligations:
                # Create requirement
                requirement = Requirement(
                    requirement_id=self._generate_requirement_id(source_name, section.section_id),
                    source=source_name,
                    citation=self._format_citation(section.section_id, section.title),
                    text=section.content[:1000],  # Limit text length
                    requirement_type=req_type,
                    category=self._categorize_requirement(section.content, domain),
                    obligations=obligations,
                    keywords=[],  # Will be populated in enrichment
                    cross_references=self._extract_cross_references(section.content),
                    criticality=self._assess_criticality(section.content, req_type),
                    metadata={
                        "section_id": section.section_id,
                        "section_title": section.title,
                        "page": section.page,
                    }
                )

                requirements.append(requirement)

        return requirements

    def _extract_from_text(
        self,
        text: str,
        source_name: str,
        domain: str,
    ) -> List[Requirement]:
        """Extract requirements from unstructured text.

        Args:
            text: Raw text
            source_name: Regulatory source name
            domain: Compliance domain

        Returns:
            List of extracted requirements
        """
        requirements = []

        # Split text into paragraphs
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

        for i, paragraph in enumerate(paragraphs):
            req_type = self._classify_text_type(paragraph)

            if req_type in ["mandatory", "recommended"]:
                obligations = self._extract_obligations(paragraph)

                if obligations:
                    requirement = Requirement(
                        requirement_id=f"{source_name}-REQ-{i+1:03d}",
                        source=source_name,
                        citation=f"Paragraph {i+1}",
                        text=paragraph[:1000],
                        requirement_type=req_type,
                        category=self._categorize_requirement(paragraph, domain),
                        obligations=obligations,
                        keywords=[],
                        cross_references=self._extract_cross_references(paragraph),
                        criticality=self._assess_criticality(paragraph, req_type),
                    )

                    requirements.append(requirement)

        return requirements

    def _classify_text_type(
        self,
        text: str
    ) -> Literal["mandatory", "recommended", "definition", "guidance", "exemption"]:
        """Classify text as requirement, definition, guidance, or exemption.

        Args:
            text: Text to classify

        Returns:
            Text type
        """
        text_lower = text.lower()

        # Check for definitions first
        if any(re.search(pattern, text_lower) for pattern in self.DEFINITION_INDICATORS):
            return "definition"

        # Check for exemptions
        if any(re.search(pattern, text_lower) for pattern in self.EXEMPTION_INDICATORS):
            return "exemption"

        # Check for mandatory requirements
        if any(re.search(pattern, text_lower) for pattern in self.MANDATORY_INDICATORS):
            return "mandatory"

        # Check for recommendations
        if any(re.search(pattern, text_lower) for pattern in self.RECOMMENDED_INDICATORS):
            return "recommended"

        return "guidance"

    def _extract_obligations(self, text: str) -> List[str]:
        """Extract specific obligations from requirement text.

        Args:
            text: Requirement text

        Returns:
            List of obligations
        """
        obligations = []

        # Split by sentences
        sentences = re.split(r'[.;]', text)

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            # Check if sentence contains an obligation
            if any(re.search(pattern, sentence, re.IGNORECASE) for pattern in self.MANDATORY_INDICATORS):
                # Clean and add obligation
                obligation = re.sub(r'\s+', ' ', sentence).strip()
                if len(obligation) > 20:  # Filter out very short obligations
                    obligations.append(obligation)

        return obligations[:5]  # Limit to 5 obligations per requirement

    def _categorize_requirement(self, text: str, domain: str) -> str:
        """Categorize requirement by compliance domain.

        Args:
            text: Requirement text
            domain: Primary domain

        Returns:
            Category name
        """
        text_lower = text.lower()

        # Domain-specific categories
        categories = {
            "AML": {
                "Customer Due Diligence": ["cdd", "due diligence", "customer identification", "kyc"],
                "Enhanced Due Diligence": ["edd", "enhanced", "high risk", "high-risk"],
                "Beneficial Ownership": ["beneficial owner", "ubo", "ultimate beneficial", "ownership"],
                "PEP Screening": ["pep", "politically exposed", "public official"],
                "Sanctions Screening": ["sanctions", "embargo", "restricted", "blocked"],
                "Transaction Monitoring": ["monitoring", "suspicious", "unusual transaction"],
                "Record Keeping": ["record", "retention", "documentation", "evidence"],
                "Reporting": ["report", "disclosure", "notification", "str", "sar"],
            },
            "GDPR": {
                "Data Processing": ["processing", "personal data", "data subject"],
                "Consent": ["consent", "agreement", "authorization"],
                "Data Subject Rights": ["access", "rectification", "erasure", "portability"],
                "Security": ["security", "protection", "safeguards", "encryption"],
                "Breach Notification": ["breach", "incident", "notification"],
            }
        }

        domain_categories = categories.get(domain, {})

        for category, keywords in domain_categories.items():
            if any(keyword in text_lower for keyword in keywords):
                return category

        return "General"

    def _extract_cross_references(self, text: str) -> List[str]:
        """Extract cross-references to other articles/sections.

        Args:
            text: Text to analyze

        Returns:
            List of cross-references
        """
        references = []

        # Patterns for cross-references
        patterns = [
            r'Article\s+(\d+(?:\([a-z0-9]+\))?)',
            r'Art\.\s+(\d+(?:\([a-z0-9]+\))?)',
            r'Section\s+(\d+(?:\.\d+)*)',
            r'§\s*(\d+)',
            r'paragraph\s+(\d+)',
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                ref = f"Article {match}" if "Article" in pattern else match
                if ref not in references:
                    references.append(ref)

        return references[:10]  # Limit to 10 references

    def _assess_criticality(
        self,
        text: str,
        req_type: str
    ) -> Literal["critical", "high", "medium", "low"]:
        """Assess criticality of a requirement.

        Args:
            text: Requirement text
            req_type: Requirement type

        Returns:
            Criticality level
        """
        text_lower = text.lower()

        # Critical indicators
        critical_keywords = [
            "criminal", "penalty", "sanction", "enforcement", "prohibited",
            "violation", "must not", "shall not"
        ]

        # High priority indicators
        high_keywords = [
            "shall", "must", "required", "obligation", "mandatory"
        ]

        if any(keyword in text_lower for keyword in critical_keywords):
            return "critical"

        if req_type == "mandatory":
            if any(keyword in text_lower for keyword in high_keywords):
                return "high"
            return "medium"

        if req_type == "recommended":
            return "low"

        return "medium"

    def _generate_requirement_id(self, source_name: str, section_id: str) -> str:
        """Generate unique requirement ID.

        Args:
            source_name: Regulatory source name
            section_id: Section identifier

        Returns:
            Requirement ID
        """
        # Clean source name
        source_short = re.sub(r'[^A-Z0-9]', '', source_name.upper())[:10]

        # Clean section ID
        section_clean = re.sub(r'[^A-Z0-9]', '-', section_id.upper())

        return f"{source_short}-{section_clean}"

    def _format_citation(self, section_id: str, section_title: str) -> str:
        """Format citation string.

        Args:
            section_id: Section identifier
            section_title: Section title

        Returns:
            Formatted citation
        """
        # Try to detect if it's an article
        if re.match(r'^\d+', section_id):
            return f"Article {section_id}"

        return section_id

    def _enrich_requirements(
        self,
        requirements: List[Requirement],
        document: Document
    ) -> List[Requirement]:
        """Enrich requirements with keywords and additional metadata.

        Args:
            requirements: List of requirements
            document: Source document

        Returns:
            Enriched requirements
        """
        for req in requirements:
            # Generate keywords
            req.keywords = self._generate_keywords(req, document.language)

        return requirements

    def _generate_keywords(self, requirement: Requirement, language: str) -> List[str]:
        """Generate search keywords for a requirement.

        Args:
            requirement: Requirement object
            language: Document language

        Returns:
            List of keywords
        """
        keywords = set()

        # Add keywords from category
        category_key = requirement.category.upper().replace(" ", "_")

        # Get multilingual keywords for the domain
        for domain_key, domain_data in MULTILINGUAL_KEYWORDS.items():
            domain_keywords = domain_data.get("keywords", {}).get(language, [])

            # Check if requirement text contains any of these keywords
            text_lower = requirement.text.lower()
            for keyword in domain_keywords:
                if keyword.lower() in text_lower:
                    keywords.add(keyword)

        # Extract important terms from text
        text_terms = self._extract_key_terms(requirement.text)
        keywords.update(text_terms[:10])  # Add top 10 terms

        # Add from obligations
        for obligation in requirement.obligations:
            terms = self._extract_key_terms(obligation)
            keywords.update(terms[:5])

        return list(keywords)[:30]  # Limit to 30 keywords

    def _extract_key_terms(self, text: str) -> List[str]:
        """Extract key terms from text.

        Args:
            text: Text to analyze

        Returns:
            List of key terms
        """
        # Remove common words
        stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
            "have", "has", "had", "do", "does", "did", "will", "would", "should",
            "could", "may", "might", "must", "shall", "can",
        }

        # Extract words
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())

        # Filter stop words
        terms = [w for w in words if w not in stop_words]

        # Count frequency
        from collections import Counter
        term_counts = Counter(terms)

        # Return most common terms
        return [term for term, _ in term_counts.most_common(20)]

    def _filter_requirements(self, requirements: List[Requirement]) -> List[Requirement]:
        """Filter out duplicate or low-quality requirements.

        Args:
            requirements: List of requirements

        Returns:
            Filtered requirements
        """
        # Remove duplicates based on text similarity
        filtered = []
        seen_texts = set()

        for req in requirements:
            # Use first 100 chars as fingerprint
            fingerprint = req.text[:100].lower().strip()

            if fingerprint not in seen_texts:
                filtered.append(req)
                seen_texts.add(fingerprint)

        return filtered
