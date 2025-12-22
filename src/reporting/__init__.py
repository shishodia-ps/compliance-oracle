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

from .base import BaseReportGenerator
from .pdf import PDFReportGenerator
from .docx import DOCXReportGenerator
from .excel import ExcelReportGenerator
from .json_export import JSONExporter, export_to_json_file

__all__ = [
    "BaseReportGenerator",
    "PDFReportGenerator",
    "DOCXReportGenerator",
    "ExcelReportGenerator",
    "JSONExporter",
    "export_to_json_file",
]
