"""
Findings Display Component
==========================

Findings display component with:
- Summary cards (total, critical, high, medium, low counts)
- Filter controls (by domain, by severity, search)
- Individual finding cards with:
  - Severity badge and color
  - Domain tag
  - Requirement citation (expandable)
  - Policy reference
  - Gap description
  - Recommendation
  - Confidence score
  - Expandable reasoning chain
"""

import streamlit as st
from typing import List, Dict, Optional
from ui.styles import get_severity_badge_html, get_domain_tag_html, get_confidence_indicator_html


def render_findings_display(findings: List[Dict], config: Dict):
    """
    Render complete findings display.

    Args:
        findings: List of finding dictionaries
        config: Configuration from sidebar
    """
    if not findings:
        st.info("✅ No compliance gaps found! Your policy appears to be compliant with the selected benchmarks.")
        return

    st.markdown("## 📊 Analysis Results")

    # Summary cards
    _render_summary_cards(findings)

    # Filter controls
    filtered_findings = _render_filter_controls(findings, config)

    # Findings list
    if filtered_findings:
        st.markdown(f"### Showing {len(filtered_findings)} finding(s)")
        _render_findings_list(filtered_findings, config)
    else:
        st.info("No findings match the selected filters.")


def _render_summary_cards(findings: List[Dict]):
    """
    Render summary cards with counts by severity.

    Args:
        findings: List of finding dictionaries
    """
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

    total = len(findings)

    # Render cards
    col1, col2, col3, col4, col5 = st.columns(5)

    with col1:
        st.markdown(f"""
        <div class="summary-card">
            <h3>{total}</h3>
            <p>Total Findings</p>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown(f"""
        <div class="summary-card" style="border-top-color: #DC3545;">
            <h3 style="color: #DC3545;">{severity_counts['critical']}</h3>
            <p>Critical</p>
        </div>
        """, unsafe_allow_html=True)

    with col3:
        st.markdown(f"""
        <div class="summary-card" style="border-top-color: #FD7E14;">
            <h3 style="color: #FD7E14;">{severity_counts['high']}</h3>
            <p>High</p>
        </div>
        """, unsafe_allow_html=True)

    with col4:
        st.markdown(f"""
        <div class="summary-card" style="border-top-color: #FFC107;">
            <h3 style="color: #FFC107;">{severity_counts['medium']}</h3>
            <p>Medium</p>
        </div>
        """, unsafe_allow_html=True)

    with col5:
        st.markdown(f"""
        <div class="summary-card" style="border-top-color: #28A745;">
            <h3 style="color: #28A745;">{severity_counts['low']}</h3>
            <p>Low</p>
        </div>
        """, unsafe_allow_html=True)


def _render_filter_controls(findings: List[Dict], config: Dict) -> List[Dict]:
    """
    Render filter controls and return filtered findings.

    Args:
        findings: List of all findings
        config: Configuration from sidebar

    Returns:
        List[Dict]: Filtered findings
    """
    st.markdown("### 🔍 Filter Findings")

    col1, col2, col3 = st.columns(3)

    with col1:
        # Domain filter
        all_domains = list(set(f.get("domain", "Unknown") for f in findings))
        selected_domains_filter = st.multiselect(
            "Filter by Domain",
            options=["All"] + all_domains,
            default=["All"],
            key="domain_filter"
        )

    with col2:
        # Severity filter
        severity_options = ["All", "Critical", "High", "Medium", "Low"]
        selected_severity_filter = st.multiselect(
            "Filter by Severity",
            options=severity_options,
            default=["All"],
            key="severity_filter"
        )

    with col3:
        # Search
        search_query = st.text_input(
            "Search findings",
            key="search_findings",
            placeholder="Search in descriptions..."
        )

    # Apply filters
    filtered = findings

    # Domain filter
    if "All" not in selected_domains_filter and selected_domains_filter:
        filtered = [
            f for f in filtered
            if f.get("domain", "Unknown") in selected_domains_filter
        ]

    # Severity filter
    if "All" not in selected_severity_filter and selected_severity_filter:
        selected_severity_lower = [s.lower() for s in selected_severity_filter]
        filtered = [
            f for f in filtered
            if f.get("severity", "medium").lower() in selected_severity_lower
        ]

    # Search filter
    if search_query:
        search_lower = search_query.lower()
        filtered = [
            f for f in filtered
            if search_lower in f.get("gap_description", "").lower()
            or search_lower in f.get("recommendation", "").lower()
            or search_lower in f.get("requirement_text", "").lower()
        ]

    return filtered


def _render_findings_list(findings: List[Dict], config: Dict):
    """
    Render list of finding cards.

    Args:
        findings: List of filtered findings
        config: Configuration from sidebar
    """
    # Sort by severity (critical first)
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_findings = sorted(
        findings,
        key=lambda x: severity_order.get(x.get("severity", "medium").lower(), 99)
    )

    for i, finding in enumerate(sorted_findings):
        _render_finding_card(finding, i, config)


def _render_finding_card(finding: Dict, index: int, config: Dict):
    """
    Render individual finding card.

    Args:
        finding: Finding dictionary
        index: Finding index (for unique keys)
        config: Configuration from sidebar
    """
    severity = finding.get("severity", "medium").lower()
    domain = finding.get("domain", "Unknown")
    requirement_text = finding.get("requirement_text", "")
    requirement_citation = finding.get("requirement_citation", "")
    policy_reference = finding.get("policy_reference", "")
    gap_description = finding.get("gap_description", "")
    recommendation = finding.get("recommendation", "")
    confidence = finding.get("confidence", 0.0)
    reasoning_chain = finding.get("reasoning_chain", [])

    # Card HTML
    st.markdown(f"""
    <div class="finding-card fade-in">
        <div class="finding-header">
            <div>
                {get_severity_badge_html(severity)}
                {get_domain_tag_html(domain)}
            </div>
            {get_confidence_indicator_html(confidence)}
        </div>
    """, unsafe_allow_html=True)

    # Requirement citation
    with st.expander(f"📜 Requirement: {requirement_citation}", expanded=False):
        st.markdown(f"""
        <div class="citation">
            <div class="citation-source">{requirement_citation}</div>
            <div>{requirement_text}</div>
        </div>
        """, unsafe_allow_html=True)

    # Policy reference (if available)
    if policy_reference:
        st.markdown(f"""
        <div style="margin: 1rem 0;">
            <strong>📄 Policy Reference:</strong> {policy_reference}
        </div>
        """, unsafe_allow_html=True)

    # Gap description
    st.markdown(f"""
    <div style="margin: 1rem 0;">
        <strong>⚠️ Gap Identified:</strong><br>
        {gap_description}
    </div>
    """, unsafe_allow_html=True)

    # Recommendation
    st.markdown(f"""
    <div class="recommendation-box">
        <strong><span class="recommendation-icon">💡</span>Recommendation:</strong><br>
        {recommendation}
    </div>
    """, unsafe_allow_html=True)

    # Reasoning chain (if enabled and available)
    if config.get("show_reasoning") and reasoning_chain:
        with st.expander("🧠 Reasoning Chain", expanded=False):
            for step in reasoning_chain:
                step_num = step.get("step", 0)
                observation = step.get("observation", "")
                analysis = step.get("analysis", "")

                st.markdown(f"""
                <div class="expandable-section">
                    <strong>Step {step_num}:</strong><br>
                    <div style="margin-top: 0.5rem;">
                        <strong>Observation:</strong> {observation}<br>
                        <strong>Analysis:</strong> {analysis}
                    </div>
                </div>
                """, unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)


def render_findings_summary(findings: List[Dict]) -> Dict:
    """
    Generate summary statistics for findings.

    Args:
        findings: List of findings

    Returns:
        Dict: Summary statistics
    """
    if not findings:
        return {
            "total": 0,
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "by_domain": {},
            "avg_confidence": 0.0
        }

    # Count by severity
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for finding in findings:
        severity = finding.get("severity", "medium").lower()
        if severity in severity_counts:
            severity_counts[severity] += 1

    # Count by domain
    domain_counts = {}
    for finding in findings:
        domain = finding.get("domain", "Unknown")
        domain_counts[domain] = domain_counts.get(domain, 0) + 1

    # Average confidence
    confidences = [f.get("confidence", 0.0) for f in findings]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "total": len(findings),
        "by_severity": severity_counts,
        "by_domain": domain_counts,
        "avg_confidence": avg_confidence
    }


def export_findings_to_dict(findings: List[Dict]) -> Dict:
    """
    Export findings to a structured dictionary for reporting.

    Args:
        findings: List of findings

    Returns:
        Dict: Structured findings data
    """
    summary = render_findings_summary(findings)

    return {
        "summary": summary,
        "findings": findings,
        "generated_at": st.session_state.get("analysis_completed_at"),
        "configuration": {
            "jurisdiction": st.session_state.get("jurisdiction"),
            "domains": st.session_state.get("selected_domains"),
            "confidence_threshold": st.session_state.get("confidence_threshold")
        }
    }
