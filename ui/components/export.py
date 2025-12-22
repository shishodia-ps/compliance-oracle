"""
Export Component
================

Export buttons component with:
- PDF Report button
- Word Report button
- Excel export button
- JSON export button
- Download handling
"""

import streamlit as st
from typing import List, Dict
from datetime import datetime
import json


def render_export_buttons(findings: List[Dict], config: Dict):
    """
    Render export buttons for different formats.

    Args:
        findings: List of findings
        config: Configuration dictionary
    """
    st.markdown("## 📥 Export Results")

    st.markdown("Download your analysis results in various formats:")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        if st.button("📄 PDF Report", key="export_pdf", use_container_width=True):
            _export_pdf(findings, config)

    with col2:
        if st.button("📝 Word Report", key="export_docx", use_container_width=True):
            _export_docx(findings, config)

    with col3:
        if st.button("📊 Excel", key="export_excel", use_container_width=True):
            _export_excel(findings, config)

    with col4:
        if st.button("{ } JSON", key="export_json", use_container_width=True):
            _export_json(findings, config)


def _export_pdf(findings: List[Dict], config: Dict):
    """
    Export findings as PDF report.

    Args:
        findings: List of findings
        config: Configuration dictionary
    """
    try:
        from src.reporting.pdf import PDFReportGenerator

        # Generate PDF
        generator = PDFReportGenerator()
        pdf_bytes = generator.generate(findings, config)

        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"compliance_report_{timestamp}.pdf"

        # Download button
        st.download_button(
            label="⬇️ Download PDF",
            data=pdf_bytes,
            file_name=filename,
            mime="application/pdf",
            key="download_pdf"
        )

        st.success("✓ PDF report generated successfully!")

    except Exception as e:
        st.error(f"❌ Error generating PDF: {str(e)}")
        st.exception(e)


def _export_docx(findings: List[Dict], config: Dict):
    """
    Export findings as Word document.

    Args:
        findings: List of findings
        config: Configuration dictionary
    """
    try:
        from src.reporting.docx import DOCXReportGenerator

        # Generate DOCX
        generator = DOCXReportGenerator()
        docx_bytes = generator.generate(findings, config)

        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"compliance_report_{timestamp}.docx"

        # Download button
        st.download_button(
            label="⬇️ Download Word Document",
            data=docx_bytes,
            file_name=filename,
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            key="download_docx"
        )

        st.success("✓ Word report generated successfully!")

    except Exception as e:
        st.error(f"❌ Error generating Word document: {str(e)}")
        st.exception(e)


def _export_excel(findings: List[Dict], config: Dict):
    """
    Export findings as Excel spreadsheet.

    Args:
        findings: List of findings
        config: Configuration dictionary
    """
    try:
        from src.reporting.excel import ExcelReportGenerator

        # Generate Excel
        generator = ExcelReportGenerator()
        excel_bytes = generator.generate(findings, config)

        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"compliance_findings_{timestamp}.xlsx"

        # Download button
        st.download_button(
            label="⬇️ Download Excel",
            data=excel_bytes,
            file_name=filename,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            key="download_excel"
        )

        st.success("✓ Excel file generated successfully!")

    except Exception as e:
        st.error(f"❌ Error generating Excel file: {str(e)}")
        st.exception(e)


def _export_json(findings: List[Dict], config: Dict):
    """
    Export findings as JSON.

    Args:
        findings: List of findings
        config: Configuration dictionary
    """
    try:
        from src.reporting.json_export import JSONExporter

        # Generate JSON
        exporter = JSONExporter()
        json_data = exporter.export(findings, config)

        # Convert to pretty JSON string
        json_str = json.dumps(json_data, indent=2, ensure_ascii=False)

        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"compliance_findings_{timestamp}.json"

        # Download button
        st.download_button(
            label="⬇️ Download JSON",
            data=json_str,
            file_name=filename,
            mime="application/json",
            key="download_json"
        )

        st.success("✓ JSON export generated successfully!")

    except Exception as e:
        st.error(f"❌ Error generating JSON: {str(e)}")
        st.exception(e)


def render_quick_export(findings: List[Dict], config: Dict):
    """
    Render quick export section (minimal, for sidebar or compact display).

    Args:
        findings: List of findings
        config: Configuration dictionary
    """
    with st.expander("📥 Quick Export"):
        if st.button("PDF", key="quick_pdf", use_container_width=True):
            _export_pdf(findings, config)

        if st.button("Word", key="quick_docx", use_container_width=True):
            _export_docx(findings, config)

        if st.button("Excel", key="quick_excel", use_container_width=True):
            _export_excel(findings, config)

        if st.button("JSON", key="quick_json", use_container_width=True):
            _export_json(findings, config)
