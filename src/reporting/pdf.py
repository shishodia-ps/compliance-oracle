"""
PDF Report Generator
===================

Professional PDF report generation using ReportLab.

Includes:
- Cover page (title, client name, date, confidentiality notice)
- Executive summary (compliance status, findings count, key risks)
- Methodology section
- Findings by domain (detailed cards with citations)
- Findings by severity
- Recommendations summary
- EY branding colors
- Table of contents
- Page numbers
"""

from typing import List, Dict
from io import BytesIO
from datetime import datetime

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, KeepTogether, ListFlowable, ListItem
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
    from reportlab.pdfgen import canvas
except ImportError:
    raise ImportError("ReportLab is required for PDF generation. Install with: pip install reportlab")

from src.reporting.base import BaseReportGenerator


# EY Brand Colors (RGB 0-1 scale)
EY_YELLOW = (1.0, 0.90, 0.0)
EY_BLACK = (0.18, 0.18, 0.22)
EY_DARK_GRAY = (0.29, 0.29, 0.35)


class PDFReportGenerator(BaseReportGenerator):
    """
    Generate professional PDF compliance reports.
    """

    def __init__(self):
        """Initialize PDF generator."""
        super().__init__()
        self.page_width = letter[0]
        self.page_height = letter[1]
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()

    def _create_custom_styles(self):
        """Create custom paragraph styles."""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.Color(*EY_BLACK),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))

        # Heading 1 - EY Yellow underline
        self.styles.add(ParagraphStyle(
            name='Heading1Custom',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.Color(*EY_BLACK),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold',
            borderColor=colors.Color(*EY_YELLOW),
            borderWidth=3,
            borderPadding=5
        ))

        # Heading 2
        self.styles.add(ParagraphStyle(
            name='Heading2Custom',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.Color(*EY_DARK_GRAY),
            spaceAfter=10,
            spaceBefore=10,
            fontName='Helvetica-Bold'
        ))

        # Heading 3
        self.styles.add(ParagraphStyle(
            name='Heading3Custom',
            parent=self.styles['Heading3'],
            fontSize=12,
            textColor=colors.Color(*EY_DARK_GRAY),
            spaceAfter=8,
            spaceBefore=8,
            fontName='Helvetica-Bold'
        ))

        # Body text
        self.styles.add(ParagraphStyle(
            name='BodyCustom',
            parent=self.styles['BodyText'],
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=10
        ))

        # Citation style
        self.styles.add(ParagraphStyle(
            name='Citation',
            parent=self.styles['BodyText'],
            fontSize=9,
            leading=12,
            leftIndent=20,
            rightIndent=20,
            textColor=colors.Color(0.3, 0.3, 0.3),
            backColor=colors.Color(0.95, 0.95, 0.95),
            borderColor=colors.Color(*EY_DARK_GRAY),
            borderWidth=1,
            borderPadding=10,
            spaceAfter=10
        ))

        # Recommendation style
        self.styles.add(ParagraphStyle(
            name='Recommendation',
            parent=self.styles['BodyText'],
            fontSize=10,
            leading=13,
            leftIndent=20,
            textColor=colors.Color(0.2, 0.2, 0.2),
            backColor=colors.Color(1.0, 0.98, 0.9),
            borderColor=colors.Color(*EY_YELLOW),
            borderWidth=2,
            borderPadding=10,
            spaceAfter=10
        ))

    def generate(self, findings: List[Dict], config: Dict) -> bytes:
        """
        Generate PDF report.

        Args:
            findings: List of findings
            config: Configuration dictionary

        Returns:
            bytes: PDF file as bytes
        """
        # Create BytesIO buffer
        buffer = BytesIO()

        # Create PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=inch,
            leftMargin=inch,
            topMargin=inch,
            bottomMargin=inch,
            title="Compliance Gap Analysis Report"
        )

        # Build content
        story = []

        # Cover page
        story.extend(self._create_cover_page(config))
        story.append(PageBreak())

        # Executive Summary
        story.extend(self._create_executive_summary(findings, config))
        story.append(PageBreak())

        # Methodology
        story.extend(self._create_methodology_section())
        story.append(PageBreak())

        # Summary Statistics
        story.extend(self._create_summary_statistics(findings))
        story.append(PageBreak())

        # Findings by Severity
        story.extend(self._create_findings_by_severity(findings))
        story.append(PageBreak())

        # Findings by Domain
        story.extend(self._create_findings_by_domain(findings))

        # Build PDF
        doc.build(story, onFirstPage=self._add_page_number, onLaterPages=self._add_page_number)

        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes

    def _create_cover_page(self, config: Dict) -> List:
        """Create cover page elements."""
        elements = []

        # Spacer for top margin
        elements.append(Spacer(1, 2*inch))

        # EY Logo (text-based)
        logo_style = ParagraphStyle(
            'Logo',
            parent=self.styles['Normal'],
            fontSize=48,
            textColor=colors.Color(*EY_BLACK),
            backColor=colors.Color(*EY_YELLOW),
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
            borderPadding=15
        )
        elements.append(Paragraph("<b>EY</b>", logo_style))
        elements.append(Spacer(1, 0.5*inch))

        # Title
        title_text = "Compliance Gap Analysis Report"
        elements.append(Paragraph(title_text, self.styles['CustomTitle']))
        elements.append(Spacer(1, 0.3*inch))

        # Jurisdiction and domains
        jurisdiction = config.get("jurisdiction", "N/A")
        domains = config.get("selected_domains", [])
        domains_str = ", ".join(domains) if domains else "N/A"

        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=self.styles['Normal'],
            fontSize=14,
            alignment=TA_CENTER,
            textColor=colors.Color(*EY_DARK_GRAY)
        )

        elements.append(Paragraph(f"<b>Jurisdiction:</b> {jurisdiction}", subtitle_style))
        elements.append(Paragraph(f"<b>Domains:</b> {domains_str}", subtitle_style))
        elements.append(Spacer(1, inch))

        # Date
        date_str = self.format_date()
        elements.append(Paragraph(f"<b>Report Date:</b> {date_str}", subtitle_style))
        elements.append(Spacer(1, 2*inch))

        # Confidentiality notice
        confidentiality_style = ParagraphStyle(
            'Confidential',
            parent=self.styles['Normal'],
            fontSize=9,
            alignment=TA_CENTER,
            textColor=colors.Color(0.4, 0.4, 0.4),
            borderColor=colors.red,
            borderWidth=2,
            borderPadding=10
        )

        conf_text = """
        <b>CONFIDENTIAL</b><br/>
        This report contains confidential information intended solely for the use of the addressed client.
        Unauthorized disclosure, copying, or distribution is strictly prohibited.
        """
        elements.append(Paragraph(conf_text, confidentiality_style))

        return elements

    def _create_executive_summary(self, findings: List[Dict], config: Dict) -> List:
        """Create executive summary section."""
        elements = []

        elements.append(Paragraph("Executive Summary", self.styles['Heading1Custom']))
        elements.append(Spacer(1, 0.2*inch))

        # Generate summary text
        summary_text = self.generate_executive_summary(findings, config)
        for paragraph in summary_text.split('\n\n'):
            if paragraph.strip():
                elements.append(Paragraph(paragraph.strip(), self.styles['BodyCustom']))

        return elements

    def _create_methodology_section(self) -> List:
        """Create methodology section."""
        elements = []

        elements.append(Paragraph("Methodology", self.styles['Heading1Custom']))
        elements.append(Spacer(1, 0.2*inch))

        # Generate methodology text
        methodology_text = self.generate_methodology_section()
        for paragraph in methodology_text.split('\n\n'):
            if paragraph.strip():
                elements.append(Paragraph(paragraph.strip(), self.styles['BodyCustom']))

        return elements

    def _create_summary_statistics(self, findings: List[Dict]) -> List:
        """Create summary statistics section."""
        elements = []

        elements.append(Paragraph("Summary Statistics", self.styles['Heading1Custom']))
        elements.append(Spacer(1, 0.2*inch))

        summary = self.format_finding_summary(findings)

        # Create summary table
        data = [
            ['Metric', 'Count'],
            ['Total Findings', str(summary['total_findings'])],
            ['Critical Priority', str(summary['by_severity']['critical'])],
            ['High Priority', str(summary['by_severity']['high'])],
            ['Medium Priority', str(summary['by_severity']['medium'])],
            ['Low Priority', str(summary['by_severity']['low'])],
        ]

        table = Table(data, colWidths=[4*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(*EY_DARK_GRAY)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))

        elements.append(table)
        elements.append(Spacer(1, 0.3*inch))

        # Domain breakdown
        if summary['by_domain']:
            elements.append(Paragraph("Findings by Domain", self.styles['Heading2Custom']))

            domain_data = [['Domain', 'Count']]
            for domain, count in summary['by_domain'].items():
                domain_data.append([domain, str(count)])

            domain_table = Table(domain_data, colWidths=[4*inch, 2*inch])
            domain_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(*EY_DARK_GRAY)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))

            elements.append(domain_table)

        return elements

    def _create_findings_by_severity(self, findings: List[Dict]) -> List:
        """Create findings grouped by severity."""
        elements = []

        elements.append(Paragraph("Findings by Severity", self.styles['Heading1Custom']))
        elements.append(Spacer(1, 0.2*inch))

        categorized = self.categorize_by_severity(findings)

        for severity in ['critical', 'high', 'medium', 'low']:
            severity_findings = categorized.get(severity, [])

            if not severity_findings:
                continue

            # Severity heading with color
            severity_color = colors.Color(*self.get_severity_color(severity))
            severity_style = ParagraphStyle(
                f'Severity{severity.title()}',
                parent=self.styles['Heading2Custom'],
                textColor=severity_color
            )

            severity_text = f"{severity.upper()} Priority ({len(severity_findings)} finding{'s' if len(severity_findings) != 1 else ''})"
            elements.append(Paragraph(severity_text, severity_style))
            elements.append(Spacer(1, 0.1*inch))

            # Add findings
            for finding in severity_findings:
                elements.extend(self._create_finding_card(finding))

        return elements

    def _create_findings_by_domain(self, findings: List[Dict]) -> List:
        """Create findings grouped by domain."""
        elements = []

        elements.append(Paragraph("Findings by Domain", self.styles['Heading1Custom']))
        elements.append(Spacer(1, 0.2*inch))

        categorized = self.categorize_by_domain(findings)

        for domain, domain_findings in categorized.items():
            elements.append(Paragraph(f"{domain} ({len(domain_findings)} finding{'s' if len(domain_findings) != 1 else ''})",
                                    self.styles['Heading2Custom']))
            elements.append(Spacer(1, 0.1*inch))

            for finding in domain_findings:
                elements.extend(self._create_finding_card(finding))

        return elements

    def _create_finding_card(self, finding: Dict) -> List:
        """Create a finding card."""
        elements = []

        # Finding elements
        severity = finding.get('severity', 'medium')
        domain = finding.get('domain', 'Unknown')
        requirement_citation = finding.get('requirement_citation', 'N/A')
        requirement_text = finding.get('requirement_text', '')
        policy_reference = finding.get('policy_reference', 'N/A')
        gap_description = finding.get('gap_description', '')
        recommendation = finding.get('recommendation', '')
        confidence = finding.get('confidence', 0.0)

        # Create card content
        card_elements = []

        # Header with severity and domain
        header_text = f"<b>[{severity.upper()}]</b> {domain}"
        card_elements.append(Paragraph(header_text, self.styles['Heading3Custom']))

        # Requirement citation
        citation_text = f"<b>Requirement:</b> {self.format_citation(requirement_citation)}<br/>{requirement_text}"
        card_elements.append(Paragraph(citation_text, self.styles['Citation']))

        # Policy reference
        if policy_reference and policy_reference != 'N/A':
            policy_text = f"<b>Policy Reference:</b> {policy_reference}"
            card_elements.append(Paragraph(policy_text, self.styles['BodyCustom']))

        # Gap description
        gap_text = f"<b>Gap Identified:</b><br/>{gap_description}"
        card_elements.append(Paragraph(gap_text, self.styles['BodyCustom']))

        # Recommendation
        rec_text = f"<b>💡 Recommendation:</b><br/>{recommendation}"
        card_elements.append(Paragraph(rec_text, self.styles['Recommendation']))

        # Confidence
        conf_text = f"<b>Confidence:</b> {self.format_confidence(confidence)}"
        card_elements.append(Paragraph(conf_text, self.styles['BodyCustom']))

        # Keep finding together
        elements.append(KeepTogether(card_elements))
        elements.append(Spacer(1, 0.3*inch))

        return elements

    def _add_page_number(self, canvas_obj: canvas.Canvas, doc):
        """Add page number to each page."""
        page_num = canvas_obj.getPageNumber()
        text = f"Page {page_num}"
        canvas_obj.saveState()
        canvas_obj.setFont('Helvetica', 9)
        canvas_obj.setFillColor(colors.Color(*EY_DARK_GRAY))
        canvas_obj.drawRightString(self.page_width - inch, 0.5*inch, text)
        canvas_obj.restoreState()
