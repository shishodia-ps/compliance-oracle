"""
UI Package
==========

User interface components for the Compliance Oracle application.

This package contains:
- Styles: EY branding and professional CSS
- Components: Reusable UI components (sidebar, upload, progress, findings, export)
- Pages: Application pages (home, analysis, results)
"""

from ui.styles import get_custom_css, SEVERITY_COLORS, EY_YELLOW, EY_BLACK

__all__ = [
    "get_custom_css",
    "SEVERITY_COLORS",
    "EY_YELLOW",
    "EY_BLACK",
]
