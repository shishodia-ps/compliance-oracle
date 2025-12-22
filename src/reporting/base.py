"""
Base Report Generator
====================

Base class for report generation with common utilities.

Provides:
- Common report structure
- Finding formatting methods
- Citation formatting
- Severity categorization
"""

from typing import List, Dict, Optional
from datetime import datetime
from abc import ABC, abstractmethod


class BaseReportGenerator(ABC):
    """
    Abstract base class for report generators.
    """

    def __init__(self):
        """Initialize the report generator."""
        self.report_date = datetime.now()

    @abstractmethod
    def generate(self, findings: List[Dict], config: Dict) -> bytes:
        """
        Generate report and return as bytes.

        Args:
            findings: List of finding dictionaries
            config: Configuration dictionary

        Returns:
            bytes: Generated report as bytes
        """
        pass

    def format_finding_summary(self, findings: List[Dict]) -> Dict:
        """
        Generate summary statistics for findings.

        Args:
            findings: List of findings

        Returns:
            Dict: Summary statistics
        """
        total = len(findings)

        # Count by severity
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0
        }

        for finding in findings:
            severity = finding.get("severity", "medium").lower()
            if severity in severity_counts:
                severity_counts[severity] += 1

        # Count by domain
        domain_counts = {}
        for finding in findings:
            domain = finding.get("domain", "Unknown")
            domain_counts[domain] = domain_counts.get(domain, 0) + 1

        # Calculate compliance score (percentage of requirements that are compliant)
        # Assuming total requirements = findings + assumed compliant requirements
        # This is simplified - real implementation would track total requirements
        compliance_rate = 0.0
        if total > 0:
            # Rough estimate: assume we checked ~2x the findings we found
            estimated_total_reqs = total * 2
            compliance_rate = ((estimated_total_reqs - total) / estimated_total_reqs) * 100

        return {
            "total_findings": total,
            "by_severity": severity_counts,
            "by_domain": domain_counts,
            "compliance_rate": compliance_rate,
            "critical_high_count": severity_counts["critical"] + severity_counts["high"]
        }

    def categorize_by_severity(self, findings: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Categorize findings by severity level.

        Args:
            findings: List of findings

        Returns:
            Dict[str, List[Dict]]: Findings grouped by severity
        """
        categorized = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": []
        }

        for finding in findings:
            severity = finding.get("severity", "medium").lower()
            if severity in categorized:
                categorized[severity].append(finding)

        return categorized

    def categorize_by_domain(self, findings: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Categorize findings by compliance domain.

        Args:
            findings: List of findings

        Returns:
            Dict[str, List[Dict]]: Findings grouped by domain
        """
        categorized = {}

        for finding in findings:
            domain = finding.get("domain", "Unknown")
            if domain not in categorized:
                categorized[domain] = []
            categorized[domain].append(finding)

        return categorized

    def format_citation(self, citation: str) -> str:
        """
        Format a citation string.

        Args:
            citation: Raw citation string

        Returns:
            str: Formatted citation
        """
        if not citation:
            return "N/A"

        # Clean up citation
        citation = citation.strip()

        return citation

    def format_confidence(self, confidence: float) -> str:
        """
        Format confidence score as percentage.

        Args:
            confidence: Confidence score (0.0 to 1.0)

        Returns:
            str: Formatted confidence (e.g., "85%")
        """
        return f"{int(confidence * 100)}%"

    def get_severity_description(self, severity: str) -> str:
        """
        Get description for severity level.

        Args:
            severity: Severity level

        Returns:
            str: Description
        """
        descriptions = {
            "critical": "Critical - Immediate action required. Severe compliance risk.",
            "high": "High - High priority. Significant compliance gap.",
            "medium": "Medium - Should be addressed. Moderate compliance gap.",
            "low": "Low - Minor issue. Low compliance risk."
        }

        return descriptions.get(severity.lower(), "Unknown severity level")

    def generate_executive_summary(self, findings: List[Dict], config: Dict) -> str:
        """
        Generate executive summary text.

        Args:
            findings: List of findings
            config: Configuration dictionary

        Returns:
            str: Executive summary text
        """
        summary_stats = self.format_finding_summary(findings)

        total = summary_stats["total_findings"]
        critical = summary_stats["by_severity"]["critical"]
        high = summary_stats["by_severity"]["high"]
        critical_high = summary_stats["critical_high_count"]
        compliance_rate = summary_stats["compliance_rate"]

        jurisdiction = config.get("jurisdiction", "Unknown")
        domains = config.get("selected_domains", [])
        domains_str = ", ".join(domains) if domains else "N/A"

        summary = f"""
This compliance gap analysis reviewed the organization's internal policy documentation
against regulatory requirements for {jurisdiction} in the following domains: {domains_str}.

KEY FINDINGS:
- Total compliance gaps identified: {total}
- Critical priority findings: {critical}
- High priority findings: {high}
- Estimated compliance rate: {compliance_rate:.1f}%

OVERALL ASSESSMENT:
"""

        if critical_high == 0:
            summary += """
The organization demonstrates strong compliance posture with no critical or high-priority
gaps identified. Minor improvements are recommended in the areas highlighted in this report.
"""
        elif critical > 0:
            summary += f"""
IMMEDIATE ACTION REQUIRED: {critical} critical compliance gap(s) identified that pose
significant regulatory risk. These should be addressed as a matter of priority.
"""
        elif high > 0:
            summary += f"""
The organization has {high} high-priority compliance gap(s) that should be addressed
promptly to ensure full regulatory compliance.
"""
        else:
            summary += """
The organization demonstrates reasonable compliance with moderate gaps identified.
Recommendations should be implemented to strengthen compliance posture.
"""

        return summary.strip()

    def generate_methodology_section(self) -> str:
        """
        Generate methodology section text.

        Returns:
            str: Methodology description
        """
        return """
This analysis was conducted using an AI-powered agentic workflow that:

1. DOCUMENT PARSING: Extracted and structured content from policy and regulatory documents

2. REQUIREMENT EXTRACTION: Identified discrete regulatory requirements from benchmark
   documents using intelligent parsing

3. SEMANTIC SEARCH: Utilized vector embeddings and semantic search to locate relevant
   policy sections addressing each requirement

4. ITERATIVE ANALYSIS: Employed adaptive retrieval strategies to exhaustively search
   for compliance evidence before declaring gaps

5. REASONING & VALIDATION: Applied chain-of-thought reasoning to compare requirements
   against policy coverage, with automated validation to minimize false positives

6. CONFIDENCE SCORING: Assigned confidence scores to each finding based on evidence
   quality and reasoning certainty

This methodology combines the efficiency of AI automation with rigorous verification
to deliver accurate, actionable compliance gap analysis.
"""

    def format_date(self, date: Optional[datetime] = None) -> str:
        """
        Format date for reports.

        Args:
            date: Date to format (defaults to now)

        Returns:
            str: Formatted date string
        """
        if date is None:
            date = self.report_date

        return date.strftime("%B %d, %Y")

    def get_severity_color(self, severity: str) -> tuple:
        """
        Get RGB color tuple for severity level.

        Args:
            severity: Severity level

        Returns:
            tuple: RGB color (r, g, b) in 0-1 range
        """
        colors = {
            "critical": (0.86, 0.20, 0.27),  # Red
            "high": (0.99, 0.49, 0.08),      # Orange
            "medium": (1.0, 0.76, 0.03),     # Yellow
            "low": (0.16, 0.65, 0.27),       # Green
        }

        return colors.get(severity.lower(), (0.5, 0.5, 0.5))  # Gray for unknown
