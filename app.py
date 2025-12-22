"""
Compliance Oracle v3.0 - Main Application Entry Point
=====================================================

Streamlit application for AI-powered regulatory compliance gap analysis.

Features:
- Multi-format document support (PDF, DOCX, HTML, TXT)
- Multilingual support (EN, DE, FR, NL, LU)
- Agentic RAG workflow
- Professional reporting (PDF, DOCX, Excel, JSON)
"""

import streamlit as st
from datetime import datetime
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Import UI components
from ui.styles import get_custom_css
from ui.pages.home import render_home_page


def main():
    """
    Main application entry point.
    """
    # Page configuration
    st.set_page_config(
        page_title="Compliance Oracle v3.0",
        page_icon="⚖️",
        layout="wide",
        initial_sidebar_state="expanded",
        menu_items={
            'Get Help': 'https://github.com/yourusername/compliance-oracle',
            'Report a bug': 'https://github.com/yourusername/compliance-oracle/issues',
            'About': """
            # Compliance Oracle v3.0

            AI-Powered Regulatory Compliance Gap Analysis

            Built with:
            - Streamlit
            - LangChain & LangGraph
            - OpenAI / Anthropic
            - ChromaDB

            © 2024 EY
            """
        }
    )

    # Inject custom CSS
    st.markdown(get_custom_css(), unsafe_allow_html=True)

    # Initialize session state
    _initialize_session_state()

    # Render main page
    render_home_page()

    # Footer
    _render_footer()


def _initialize_session_state():
    """
    Initialize session state variables.
    """
    # Page routing
    if "page" not in st.session_state:
        st.session_state.page = "upload"

    # Workflow state
    if "workflow_state" not in st.session_state:
        st.session_state.workflow_state = None

    # Upload results
    if "upload_result" not in st.session_state:
        st.session_state.upload_result = None

    # Configuration
    if "config" not in st.session_state:
        st.session_state.config = None

    # Findings
    if "findings" not in st.session_state:
        st.session_state.findings = None

    # Analysis metadata
    if "analysis_started_at" not in st.session_state:
        st.session_state.analysis_started_at = None

    if "analysis_completed_at" not in st.session_state:
        st.session_state.analysis_completed_at = None

    # Confirmation flags
    if "confirm_cancel" not in st.session_state:
        st.session_state.confirm_cancel = False


def _render_footer():
    """
    Render application footer.
    """
    st.markdown("---")

    col1, col2, col3 = st.columns([2, 1, 2])

    with col1:
        st.markdown("""
        <div style="color: #6c757d; font-size: 0.85rem;">
            <strong>Compliance Oracle v3.0</strong><br>
            AI-Powered Regulatory Compliance Gap Analysis
        </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown(f"""
        <div style="text-align: center; color: #6c757d; font-size: 0.85rem;">
            © {datetime.now().year} EY
        </div>
        """, unsafe_allow_html=True)

    with col3:
        st.markdown("""
        <div style="text-align: right; color: #6c757d; font-size: 0.85rem;">
            Built with LangChain, LangGraph & Streamlit
        </div>
        """, unsafe_allow_html=True)


if __name__ == "__main__":
    main()
