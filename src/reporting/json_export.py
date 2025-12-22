"""
JSON Exporter
=============

JSON export for machine-readable output.

Includes:
- Complete findings data
- Metadata (timestamp, versions, settings used)
- Machine-readable format for integrations
"""

from typing import List, Dict
from datetime import datetime
import json

from src.reporting.base import BaseReportGenerator


class JSONExporter(BaseReportGenerator):
    """
    Export compliance findings to JSON format.
    """

    def __init__(self):
        """Initialize JSON exporter."""
        super().__init__()

    def export(self, findings: List[Dict], config: Dict) -> Dict:
        """
        Export findings to JSON-serializable dictionary.

        Args:
            findings: List of findings
            config: Configuration dictionary

        Returns:
            Dict: JSON-serializable dictionary
        """
        # Generate summary
        summary = self.format_finding_summary(findings)

        # Build export data
        export_data = {
            "metadata": self._generate_metadata(config),
            "summary": summary,
            "findings": self._format_findings(findings),
            "categorization": {
                "by_severity": self._categorize_severity(findings),
                "by_domain": self._categorize_domain(findings)
            }
        }

        return export_data

    def _generate_metadata(self, config: Dict) -> Dict:
        """
        Generate metadata section.

        Args:
            config: Configuration dictionary

        Returns:
            Dict: Metadata
        """
        return {
            "report_type": "compliance_gap_analysis",
            "generated_at": self.report_date.isoformat(),
            "version": "3.0",
            "tool": "Compliance Oracle",
            "configuration": {
                "jurisdiction": config.get("jurisdiction", "Unknown"),
                "domains": config.get("selected_domains", []),
                "confidence_threshold": config.get("confidence_threshold", 0.7),
                "provider": config.get("provider", "Unknown"),
                "model": config.get("model", "Unknown"),
                "validate_citations": config.get("validate_citations", True),
                "iterative_search": config.get("enable_iterative_search", True)
            }
        }

    def _format_findings(self, findings: List[Dict]) -> List[Dict]:
        """
        Format findings for JSON export.

        Args:
            findings: List of findings

        Returns:
            List[Dict]: Formatted findings
        """
        formatted = []

        for i, finding in enumerate(findings, start=1):
            formatted_finding = {
                "finding_id": i,
                "severity": finding.get("severity", "medium"),
                "domain": finding.get("domain", "Unknown"),
                "requirement": {
                    "citation": finding.get("requirement_citation", "N/A"),
                    "text": finding.get("requirement_text", ""),
                    "source": finding.get("requirement_source", "")
                },
                "policy": {
                    "reference": finding.get("policy_reference", "N/A"),
                    "section": finding.get("policy_section", "")
                },
                "gap": {
                    "description": finding.get("gap_description", ""),
                    "type": finding.get("gap_type", "missing"),
                    "impact": finding.get("impact", "")
                },
                "recommendation": {
                    "text": finding.get("recommendation", ""),
                    "priority": finding.get("priority", "medium"),
                    "effort": finding.get("effort", "unknown")
                },
                "confidence": finding.get("confidence", 0.0),
                "reasoning_chain": finding.get("reasoning_chain", []),
                "metadata": {
                    "detected_at": finding.get("detected_at", ""),
                    "validated": finding.get("validated", False),
                    "validator_notes": finding.get("validator_notes", "")
                }
            }

            formatted.append(formatted_finding)

        return formatted

    def _categorize_severity(self, findings: List[Dict]) -> Dict:
        """
        Categorize findings by severity.

        Args:
            findings: List of findings

        Returns:
            Dict: Findings grouped by severity with IDs
        """
        categorized = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": []
        }

        for i, finding in enumerate(findings, start=1):
            severity = finding.get("severity", "medium").lower()
            if severity in categorized:
                categorized[severity].append({
                    "finding_id": i,
                    "domain": finding.get("domain", "Unknown"),
                    "citation": finding.get("requirement_citation", "N/A"),
                    "confidence": finding.get("confidence", 0.0)
                })

        return categorized

    def _categorize_domain(self, findings: List[Dict]) -> Dict:
        """
        Categorize findings by domain.

        Args:
            findings: List of findings

        Returns:
            Dict: Findings grouped by domain with IDs
        """
        categorized = {}

        for i, finding in enumerate(findings, start=1):
            domain = finding.get("domain", "Unknown")

            if domain not in categorized:
                categorized[domain] = []

            categorized[domain].append({
                "finding_id": i,
                "severity": finding.get("severity", "medium"),
                "citation": finding.get("requirement_citation", "N/A"),
                "confidence": finding.get("confidence", 0.0)
            })

        return categorized

    def generate(self, findings: List[Dict], config: Dict) -> bytes:
        """
        Generate JSON export as bytes (for compatibility with base class).

        Args:
            findings: List of findings
            config: Configuration dictionary

        Returns:
            bytes: JSON as bytes
        """
        export_data = self.export(findings, config)
        json_str = json.dumps(export_data, indent=2, ensure_ascii=False)
        return json_str.encode('utf-8')


def export_to_json_file(findings: List[Dict], config: Dict, filepath: str):
    """
    Export findings directly to a JSON file.

    Args:
        findings: List of findings
        config: Configuration dictionary
        filepath: Path to output file
    """
    exporter = JSONExporter()
    export_data = exporter.export(findings, config)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)
