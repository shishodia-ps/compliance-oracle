"""
Home Page
=========

Main page layout with:
- Header with title and description
- Document upload section
- Start analysis button
- Integration of all components
"""

import streamlit as st
from typing import Dict, Optional
from ui.components.sidebar import get_sidebar_config
from ui.components.upload import render_upload_section, validate_upload_ready
from ui.components.progress import render_progress_display, create_workflow_state
from ui.components.findings import render_findings_display
from ui.components.export import render_export_buttons


def render_home_page():
    """
    Render the main home page.
    """
    # Get sidebar configuration
    config = get_sidebar_config()

    # Render header
    _render_header()

    # Check session state for current page
    if "page" not in st.session_state:
        st.session_state.page = "upload"

    if "workflow_state" not in st.session_state:
        st.session_state.workflow_state = None

    if "findings" not in st.session_state:
        st.session_state.findings = None

    # Route to appropriate page
    if st.session_state.page == "upload":
        _render_upload_page(config)
    elif st.session_state.page == "analysis":
        _render_analysis_page(config)
    elif st.session_state.page == "results":
        _render_results_page(config)


def _render_header():
    """
    Render application header.
    """
    st.markdown("""
    <div class="app-header">
        <h1>🔍 Compliance Oracle</h1>
        <p>AI-Powered Regulatory Compliance Gap Analysis</p>
    </div>
    """, unsafe_allow_html=True)


def _render_upload_page(config: Optional[Dict]):
    """
    Render document upload page.

    Args:
        config: Configuration from sidebar
    """
    if not config:
        st.warning("⚠️ Please complete the configuration in the sidebar before proceeding.")
        return

    # Upload section
    upload_result = render_upload_section(config)

    # Store in session state
    st.session_state.upload_result = upload_result

    # Validate and show start button
    is_ready, error_message = validate_upload_ready(upload_result)

    if is_ready:
        st.markdown("---")

        col1, col2, col3 = st.columns([1, 2, 1])

        with col2:
            if st.button(
                "🚀 Start Analysis",
                key="start_analysis",
                use_container_width=True,
                type="primary"
            ):
                # Initialize workflow state
                st.session_state.workflow_state = create_workflow_state()
                st.session_state.page = "analysis"
                st.session_state.config = config
                st.rerun()
    else:
        if error_message:
            st.info(f"ℹ️ {error_message}")


def _render_analysis_page(config: Optional[Dict]):
    """
    Render analysis in progress page.

    Args:
        config: Configuration from sidebar
    """
    workflow_state = st.session_state.get("workflow_state")

    if not workflow_state:
        st.error("❌ No workflow state found. Please start from upload page.")
        if st.button("← Back to Upload"):
            st.session_state.page = "upload"
            st.rerun()
        return

    # Render progress display
    cancel_requested = render_progress_display(workflow_state)

    if cancel_requested:
        st.warning("Analysis cancelled by user.")
        if st.button("← Back to Upload"):
            st.session_state.page = "upload"
            st.session_state.workflow_state = None
            st.rerun()
        return

    # Check if analysis is complete (this would be updated by the workflow)
    if workflow_state.get("status") == "complete":
        st.session_state.page = "results"
        st.session_state.findings = workflow_state.get("findings", [])
        st.rerun()


def _render_results_page(config: Optional[Dict]):
    """
    Render results page with findings.

    Args:
        config: Configuration from sidebar
    """
    findings = st.session_state.get("findings")

    if not findings:
        st.error("❌ No findings available. Please run analysis first.")
        if st.button("← Back to Upload"):
            st.session_state.page = "upload"
            st.rerun()
        return

    # Render findings display
    render_findings_display(findings, config)

    st.markdown("---")

    # Render export buttons
    render_export_buttons(findings, config)

    st.markdown("---")

    # Actions
    col1, col2 = st.columns(2)

    with col1:
        if st.button("🔄 New Analysis", key="new_analysis", use_container_width=True):
            # Reset session state
            st.session_state.page = "upload"
            st.session_state.workflow_state = None
            st.session_state.findings = None
            st.session_state.upload_result = None
            st.rerun()

    with col2:
        if st.button("📊 Re-analyze with Different Settings", key="reanalyze", use_container_width=True):
            # Keep upload, reset analysis
            st.session_state.page = "upload"
            st.session_state.workflow_state = None
            st.session_state.findings = None
            st.rerun()
