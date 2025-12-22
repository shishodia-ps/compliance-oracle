"""
Reporting Package
=================

Provides report generation and export functionality for compliance findings.

Available Generators:
- PDFReportGenerator: Professional PDF reports with EY branding
- DOCXReportGenerator: Editable Word documents
- ExcelReportGenerator: Excel spreadsheets with filtering
- JSONExporter: Machine-readable JSON export

Usage:
    from src.reporting import PDFReportGenerator

    generator = PDFReportGenerator()
    pdf_bytes = generator.generate(findings, config)
"""

from src.reporting.base import BaseReportGenerator
from src.reporting.pdf import PDFReportGenerator
from src.reporting.docx import DOCXReportGenerator
from src.reporting.excel import ExcelReportGenerator
from src.reporting.json_export import JSONExporter, export_to_json_file

__all__ = [
    "BaseReportGenerator",
    "PDFReportGenerator",
    "DOCXReportGenerator",
    "ExcelReportGenerator",
    "JSONExporter",
    "export_to_json_file",
]
