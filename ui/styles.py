"""
UI Styles - EY Branding and Professional Styling
================================================

Defines all CSS styles for the Compliance Oracle application with:
- EY branding colors (yellow #FFE600, black, dark gray)
- Professional styling for findings cards
- Severity color coding
- Progress bar styling
"""

# EY Brand Colors
EY_YELLOW = "#FFE600"
EY_BLACK = "#2E2E38"
EY_DARK_GRAY = "#4B4B59"
EY_LIGHT_GRAY = "#F2F2F5"
EY_WHITE = "#FFFFFF"

# Severity Colors
SEVERITY_COLORS = {
    "critical": "#DC3545",  # Red
    "high": "#FD7E14",      # Orange
    "medium": "#FFC107",    # Yellow
    "low": "#28A745",       # Green
    "info": "#17A2B8",      # Blue
}

# Status Colors
STATUS_COLORS = {
    "success": "#28A745",
    "warning": "#FFC107",
    "error": "#DC3545",
    "info": "#17A2B8",
}


def get_custom_css() -> str:
    """
    Returns complete custom CSS for the application.

    Returns:
        str: CSS styles as a string
    """
    return f"""
    <style>
    /* ===== GLOBAL STYLES ===== */
    :root {{
        --ey-yellow: {EY_YELLOW};
        --ey-black: {EY_BLACK};
        --ey-dark-gray: {EY_DARK_GRAY};
        --ey-light-gray: {EY_LIGHT_GRAY};
        --ey-white: {EY_WHITE};
        --severity-critical: {SEVERITY_COLORS['critical']};
        --severity-high: {SEVERITY_COLORS['high']};
        --severity-medium: {SEVERITY_COLORS['medium']};
        --severity-low: {SEVERITY_COLORS['low']};
    }}

    /* Main app background */
    .main {{
        background-color: {EY_WHITE};
    }}

    /* Sidebar styling */
    [data-testid="stSidebar"] {{
        background-color: {EY_LIGHT_GRAY};
    }}

    [data-testid="stSidebar"] > div:first-child {{
        background-color: {EY_LIGHT_GRAY};
    }}

    /* ===== HEADER STYLES ===== */
    .app-header {{
        background: linear-gradient(135deg, {EY_BLACK} 0%, {EY_DARK_GRAY} 100%);
        padding: 2rem;
        border-radius: 10px;
        margin-bottom: 2rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }}

    .app-header h1 {{
        color: {EY_YELLOW};
        margin: 0;
        font-size: 2.5rem;
        font-weight: 700;
    }}

    .app-header p {{
        color: {EY_WHITE};
        margin: 0.5rem 0 0 0;
        font-size: 1.1rem;
    }}

    .ey-logo {{
        background-color: {EY_YELLOW};
        color: {EY_BLACK};
        padding: 0.5rem 1rem;
        border-radius: 5px;
        font-weight: 700;
        font-size: 1.5rem;
        display: inline-block;
        margin-bottom: 1rem;
    }}

    /* ===== SIDEBAR SECTION STYLES ===== */
    .sidebar-section {{
        background-color: {EY_WHITE};
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }}

    .sidebar-section-header {{
        font-size: 0.9rem;
        font-weight: 600;
        color: {EY_DARK_GRAY};
        margin-bottom: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid {EY_YELLOW};
        padding-bottom: 0.5rem;
    }}

    .status-indicator {{
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 500;
    }}

    .status-connected {{
        background-color: #D4EDDA;
        color: #155724;
    }}

    .status-disconnected {{
        background-color: #F8D7DA;
        color: #721C24;
    }}

    /* ===== CARD STYLES ===== */
    .info-card {{
        background-color: {EY_WHITE};
        border-left: 4px solid {EY_YELLOW};
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 1.5rem;
    }}

    .summary-card {{
        background-color: {EY_WHITE};
        padding: 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        text-align: center;
        border-top: 4px solid {EY_YELLOW};
    }}

    .summary-card h3 {{
        margin: 0;
        font-size: 2.5rem;
        font-weight: 700;
        color: {EY_BLACK};
    }}

    .summary-card p {{
        margin: 0.5rem 0 0 0;
        color: {EY_DARK_GRAY};
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}

    /* ===== FINDING CARD STYLES ===== */
    .finding-card {{
        background-color: {EY_WHITE};
        border-radius: 10px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
    }}

    .finding-card:hover {{
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }}

    .finding-header {{
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 1rem;
    }}

    .finding-title {{
        font-size: 1.2rem;
        font-weight: 600;
        color: {EY_BLACK};
        margin: 0;
    }}

    /* ===== SEVERITY BADGES ===== */
    .severity-badge {{
        display: inline-block;
        padding: 0.4rem 1rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}

    .severity-critical {{
        background-color: {SEVERITY_COLORS['critical']};
        color: white;
    }}

    .severity-high {{
        background-color: {SEVERITY_COLORS['high']};
        color: white;
    }}

    .severity-medium {{
        background-color: {SEVERITY_COLORS['medium']};
        color: {EY_BLACK};
    }}

    .severity-low {{
        background-color: {SEVERITY_COLORS['low']};
        color: white;
    }}

    /* ===== DOMAIN TAGS ===== */
    .domain-tag {{
        display: inline-block;
        background-color: {EY_LIGHT_GRAY};
        color: {EY_DARK_GRAY};
        padding: 0.3rem 0.8rem;
        border-radius: 15px;
        font-size: 0.8rem;
        font-weight: 500;
        margin-right: 0.5rem;
        margin-bottom: 0.5rem;
    }}

    /* ===== PROGRESS BAR STYLES ===== */
    .progress-container {{
        background-color: {EY_LIGHT_GRAY};
        border-radius: 10px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }}

    .progress-bar {{
        background-color: {EY_LIGHT_GRAY};
        border-radius: 10px;
        height: 30px;
        overflow: hidden;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    }}

    .progress-bar-fill {{
        background: linear-gradient(90deg, {EY_YELLOW} 0%, #FFD700 100%);
        height: 100%;
        border-radius: 10px;
        transition: width 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: {EY_BLACK};
        font-weight: 600;
        font-size: 0.9rem;
    }}

    .stage-indicator {{
        display: flex;
        justify-content: space-between;
        margin-top: 1rem;
    }}

    .stage {{
        text-align: center;
        flex: 1;
    }}

    .stage-icon {{
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }}

    .stage-active {{
        color: {EY_YELLOW};
        font-weight: 600;
    }}

    .stage-complete {{
        color: {SEVERITY_COLORS['low']};
    }}

    .stage-pending {{
        color: {EY_DARK_GRAY};
        opacity: 0.4;
    }}

    /* ===== BUTTON STYLES ===== */
    .stButton > button {{
        background-color: {EY_YELLOW};
        color: {EY_BLACK};
        font-weight: 600;
        border: none;
        border-radius: 8px;
        padding: 0.75rem 2rem;
        font-size: 1rem;
        transition: all 0.2s;
    }}

    .stButton > button:hover {{
        background-color: #FFD700;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }}

    .export-button {{
        background-color: {EY_DARK_GRAY} !important;
        color: {EY_WHITE} !important;
    }}

    .export-button:hover {{
        background-color: {EY_BLACK} !important;
    }}

    .danger-button {{
        background-color: {SEVERITY_COLORS['critical']} !important;
        color: white !important;
    }}

    /* ===== FILE UPLOAD STYLES ===== */
    .upload-zone {{
        border: 3px dashed {EY_DARK_GRAY};
        border-radius: 10px;
        padding: 3rem;
        text-align: center;
        background-color: {EY_LIGHT_GRAY};
        transition: all 0.3s;
    }}

    .upload-zone:hover {{
        border-color: {EY_YELLOW};
        background-color: #FFFEF0;
    }}

    .upload-icon {{
        font-size: 4rem;
        color: {EY_DARK_GRAY};
        margin-bottom: 1rem;
    }}

    /* ===== EXPANDABLE SECTION STYLES ===== */
    .expandable-section {{
        background-color: {EY_LIGHT_GRAY};
        border-radius: 8px;
        padding: 1rem;
        margin-top: 1rem;
    }}

    .expandable-header {{
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        color: {EY_DARK_GRAY};
    }}

    .expandable-content {{
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid {EY_DARK_GRAY};
    }}

    /* ===== LOG DISPLAY STYLES ===== */
    .log-container {{
        background-color: {EY_BLACK};
        color: {EY_WHITE};
        border-radius: 8px;
        padding: 1rem;
        font-family: 'Courier New', monospace;
        font-size: 0.85rem;
        max-height: 300px;
        overflow-y: auto;
        margin-top: 1rem;
    }}

    .log-entry {{
        margin-bottom: 0.5rem;
        padding: 0.25rem;
    }}

    .log-timestamp {{
        color: {EY_YELLOW};
        margin-right: 0.5rem;
    }}

    .log-level-info {{
        color: #17A2B8;
    }}

    .log-level-warning {{
        color: #FFC107;
    }}

    .log-level-error {{
        color: #DC3545;
    }}

    .log-level-success {{
        color: #28A745;
    }}

    /* ===== METRIC STYLES ===== */
    .metric-row {{
        display: flex;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid {EY_LIGHT_GRAY};
    }}

    .metric-label {{
        color: {EY_DARK_GRAY};
        font-weight: 500;
    }}

    .metric-value {{
        color: {EY_BLACK};
        font-weight: 600;
    }}

    /* ===== FILTER STYLES ===== */
    .filter-container {{
        background-color: {EY_LIGHT_GRAY};
        padding: 1.5rem;
        border-radius: 10px;
        margin-bottom: 2rem;
    }}

    .filter-row {{
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
    }}

    /* ===== CITATION STYLES ===== */
    .citation {{
        background-color: {EY_LIGHT_GRAY};
        border-left: 3px solid {EY_DARK_GRAY};
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
        font-style: italic;
        color: {EY_DARK_GRAY};
    }}

    .citation-source {{
        font-weight: 600;
        color: {EY_BLACK};
        margin-bottom: 0.5rem;
    }}

    /* ===== CONFIDENCE INDICATOR ===== */
    .confidence-indicator {{
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        background-color: {EY_LIGHT_GRAY};
    }}

    .confidence-bar {{
        width: 100px;
        height: 8px;
        background-color: #E0E0E0;
        border-radius: 4px;
        overflow: hidden;
    }}

    .confidence-fill {{
        height: 100%;
        background: linear-gradient(90deg, {SEVERITY_COLORS['low']} 0%, {EY_YELLOW} 50%, {SEVERITY_COLORS['critical']} 100%);
        transition: width 0.3s;
    }}

    /* ===== RECOMMENDATION BOX ===== */
    .recommendation-box {{
        background-color: #FFF9E6;
        border-left: 4px solid {EY_YELLOW};
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
    }}

    .recommendation-icon {{
        color: {EY_YELLOW};
        font-size: 1.5rem;
        margin-right: 0.5rem;
    }}

    /* ===== TABLE STYLES ===== */
    .data-table {{
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
    }}

    .data-table th {{
        background-color: {EY_DARK_GRAY};
        color: {EY_WHITE};
        padding: 1rem;
        text-align: left;
        font-weight: 600;
    }}

    .data-table td {{
        padding: 0.75rem 1rem;
        border-bottom: 1px solid {EY_LIGHT_GRAY};
    }}

    .data-table tr:hover {{
        background-color: {EY_LIGHT_GRAY};
    }}

    /* ===== SCROLLBAR STYLES ===== */
    ::-webkit-scrollbar {{
        width: 8px;
        height: 8px;
    }}

    ::-webkit-scrollbar-track {{
        background: {EY_LIGHT_GRAY};
        border-radius: 4px;
    }}

    ::-webkit-scrollbar-thumb {{
        background: {EY_DARK_GRAY};
        border-radius: 4px;
    }}

    ::-webkit-scrollbar-thumb:hover {{
        background: {EY_BLACK};
    }}

    /* ===== RESPONSIVE DESIGN ===== */
    @media (max-width: 768px) {{
        .app-header h1 {{
            font-size: 1.8rem;
        }}

        .summary-card {{
            margin-bottom: 1rem;
        }}

        .filter-row {{
            flex-direction: column;
        }}
    }}

    /* ===== ANIMATIONS ===== */
    @keyframes fadeIn {{
        from {{
            opacity: 0;
            transform: translateY(10px);
        }}
        to {{
            opacity: 1;
            transform: translateY(0);
        }}
    }}

    .fade-in {{
        animation: fadeIn 0.3s ease-in;
    }}

    @keyframes pulse {{
        0%, 100% {{
            opacity: 1;
        }}
        50% {{
            opacity: 0.5;
        }}
    }}

    .pulse {{
        animation: pulse 2s infinite;
    }}

    </style>
    """


def get_severity_color(severity: str) -> str:
    """
    Get color code for a severity level.

    Args:
        severity: Severity level (critical, high, medium, low)

    Returns:
        str: Hex color code
    """
    return SEVERITY_COLORS.get(severity.lower(), SEVERITY_COLORS['info'])


def get_severity_badge_html(severity: str) -> str:
    """
    Generate HTML for a severity badge.

    Args:
        severity: Severity level

    Returns:
        str: HTML string for badge
    """
    severity_lower = severity.lower()
    return f'<span class="severity-badge severity-{severity_lower}">{severity.upper()}</span>'


def get_domain_tag_html(domain: str) -> str:
    """
    Generate HTML for a domain tag.

    Args:
        domain: Domain name

    Returns:
        str: HTML string for tag
    """
    return f'<span class="domain-tag">{domain}</span>'


def get_confidence_indicator_html(confidence: float) -> str:
    """
    Generate HTML for a confidence indicator.

    Args:
        confidence: Confidence score (0.0 to 1.0)

    Returns:
        str: HTML string for confidence indicator
    """
    percentage = int(confidence * 100)
    return f"""
    <div class="confidence-indicator">
        <span>Confidence: {percentage}%</span>
        <div class="confidence-bar">
            <div class="confidence-fill" style="width: {percentage}%;"></div>
        </div>
    </div>
    """
