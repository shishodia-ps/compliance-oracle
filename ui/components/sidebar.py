"""
Sidebar Component
=================

Complete sidebar with:
- API Configuration section (Provider dropdown, Model dropdown, API key input)
- Jurisdiction dropdown with flags (using JURISDICTION_REGISTRY)
- Domain multi-select checkboxes (using MULTILINGUAL_KEYWORDS)
- Language settings (auto-detect option + manual override)
- Analysis settings (confidence threshold slider, toggles)
- Status display (API connected, estimated time/cost)
"""

import streamlit as st
from typing import Dict, List, Optional
from src.config.settings import Settings
from src.config.keywords import MULTILINGUAL_KEYWORDS
from src.config.jurisdictions import JURISDICTION_REGISTRY
from src.config.models import MODEL_REGISTRY


def render_sidebar() -> Dict:
    """
    Render the complete sidebar and return configuration.

    Returns:
        Dict: Configuration dictionary with all user selections
    """
    with st.sidebar:
        # EY Logo/Title
        st.markdown("""
        <div class="ey-logo">
            EY
        </div>
        <h3>Compliance Oracle</h3>
        """, unsafe_allow_html=True)

        st.markdown("---")

        # API Configuration Section
        config = _render_api_config()

        st.markdown("---")

        # Jurisdiction Section
        jurisdiction_config = _render_jurisdiction_selector()
        config.update(jurisdiction_config)

        st.markdown("---")

        # Domain Selection Section
        domain_config = _render_domain_selector()
        config.update(domain_config)

        st.markdown("---")

        # Language Settings Section
        language_config = _render_language_settings()
        config.update(language_config)

        st.markdown("---")

        # Analysis Settings Section
        analysis_config = _render_analysis_settings()
        config.update(analysis_config)

        st.markdown("---")

        # Status Display
        _render_status_display(config)

        return config


def _render_api_config() -> Dict:
    """
    Render API configuration section.

    Returns:
        Dict: API configuration settings
    """
    st.markdown("""
    <div class="sidebar-section-header">
        🔑 API CONFIGURATION
    </div>
    """, unsafe_allow_html=True)

    # Provider dropdown
    providers = list(MODEL_REGISTRY.keys())
    provider_names = {
        "openai": "OpenAI",
        "anthropic": "Anthropic (Claude)",
        "ollama": "Ollama (Local)"
    }

    provider = st.selectbox(
        "Provider",
        options=providers,
        format_func=lambda x: provider_names.get(x, x),
        key="api_provider"
    )

    # Model dropdown (filtered by provider)
    models = MODEL_REGISTRY[provider]["models"]
    model_options = list(models.keys())

    # Find default model
    default_model = next(
        (k for k, v in models.items() if v.get("is_default")),
        model_options[0] if model_options else None
    )

    selected_model = st.selectbox(
        "Model",
        options=model_options,
        index=model_options.index(default_model) if default_model else 0,
        format_func=lambda x: models[x]["display_name"],
        key="api_model",
        help=models.get(model_options[0], {}).get("description", "")
    )

    # Show model info
    model_info = models[selected_model]
    with st.expander("ℹ️ Model Information"):
        st.write(f"**Description:** {model_info.get('description', 'N/A')}")
        st.write(f"**Speed Rating:** {'⚡' * model_info.get('speed_rating', 3)}")
        st.write(f"**Quality Rating:** {'⭐' * model_info.get('quality_rating', 3)}")
        st.write(f"**Context Window:** {model_info.get('context_window', 'N/A'):,} tokens")

        if model_info.get('warning'):
            st.warning(model_info['warning'])

        if model_info.get('recommended_for'):
            st.info(f"**Recommended for:** {', '.join(model_info['recommended_for'])}")

    # API Key input (only for cloud providers)
    api_key = None
    api_key_valid = False

    if provider != "ollama":
        api_key = st.text_input(
            "API Key",
            type="password",
            key=f"{provider}_api_key",
            placeholder=f"Enter your {provider_names[provider]} API key"
        )

        if api_key:
            # Basic validation
            if provider == "openai" and api_key.startswith("sk-"):
                api_key_valid = True
            elif provider == "anthropic" and api_key.startswith("sk-ant-"):
                api_key_valid = True
            else:
                st.warning("⚠️ API key format may be incorrect")

            if api_key_valid:
                st.success("✓ API key format valid")
        else:
            st.info("💡 Enter API key to enable analysis")
    else:
        # For Ollama, check if it's running
        st.info("💡 Make sure Ollama is running locally")
        api_key_valid = True  # Assume valid for local

    return {
        "provider": provider,
        "model": selected_model,
        "api_key": api_key,
        "api_key_valid": api_key_valid,
        "model_info": model_info
    }


def _render_jurisdiction_selector() -> Dict:
    """
    Render jurisdiction selection section.

    Returns:
        Dict: Jurisdiction configuration
    """
    st.markdown("""
    <div class="sidebar-section-header">
        🌍 JURISDICTION
    </div>
    """, unsafe_allow_html=True)

    # Jurisdiction dropdown with flags
    jurisdictions = list(JURISDICTION_REGISTRY.keys())

    def format_jurisdiction(code: str) -> str:
        j = JURISDICTION_REGISTRY[code]
        return f"{j['flag']} {j['name']}"

    selected_jurisdiction = st.selectbox(
        "Select Jurisdiction",
        options=jurisdictions,
        format_func=format_jurisdiction,
        key="jurisdiction",
        index=jurisdictions.index("LU") if "LU" in jurisdictions else 0
    )

    jurisdiction_data = JURISDICTION_REGISTRY[selected_jurisdiction]

    # Show jurisdiction info
    with st.expander("ℹ️ Jurisdiction Information"):
        st.write(f"**Primary Language:** {jurisdiction_data['primary_language'].upper()}")

        if jurisdiction_data.get('inherit_from'):
            st.info(f"Inherits regulations from: {jurisdiction_data['inherit_from']}")

        if jurisdiction_data.get('regulator'):
            reg = jurisdiction_data['regulator']
            st.write(f"**Regulator:** {reg['name']} - {reg['full_name']}")

    # Option to include supranational requirements (if applicable)
    include_supranational = False
    if jurisdiction_data.get('inherit_from') == "EU":
        include_supranational = st.checkbox(
            "☑ Include EU requirements",
            value=True,
            key="include_eu"
        )

    return {
        "jurisdiction": selected_jurisdiction,
        "jurisdiction_data": jurisdiction_data,
        "include_supranational": include_supranational
    }


def _render_domain_selector() -> Dict:
    """
    Render domain selection section.

    Returns:
        Dict: Domain configuration
    """
    st.markdown("""
    <div class="sidebar-section-header">
        📋 COMPLIANCE DOMAINS
    </div>
    """, unsafe_allow_html=True)

    # Domain checkboxes
    domains = list(MULTILINGUAL_KEYWORDS.keys())
    selected_domains = []

    # Create columns for better layout
    col1, col2 = st.columns(2)

    for i, domain in enumerate(domains):
        domain_info = MULTILINGUAL_KEYWORDS[domain]
        label = domain_info["name"]["en"]

        # Alternate between columns
        with col1 if i % 2 == 0 else col2:
            if st.checkbox(label, key=f"domain_{domain}", value=domain in ["AML", "KYC"]):
                selected_domains.append(domain)

    # Show selected domains info
    if selected_domains:
        with st.expander("ℹ️ Selected Domains"):
            for domain in selected_domains:
                domain_info = MULTILINGUAL_KEYWORDS[domain]
                st.write(f"**{domain}:** {domain_info['name']['en']}")
    else:
        st.warning("⚠️ Select at least one compliance domain")

    return {
        "selected_domains": selected_domains,
        "domain_keywords": {
            domain: MULTILINGUAL_KEYWORDS[domain]
            for domain in selected_domains
        }
    }


def _render_language_settings() -> Dict:
    """
    Render language settings section.

    Returns:
        Dict: Language configuration
    """
    st.markdown("""
    <div class="sidebar-section-header">
        🌐 LANGUAGE
    </div>
    """, unsafe_allow_html=True)

    # Document language detection
    doc_language_options = ["Auto-detect", "English", "German", "French", "Dutch", "Luxembourgish"]
    doc_language = st.selectbox(
        "Document Language",
        options=doc_language_options,
        key="doc_language"
    )

    # Report language
    report_language_options = ["English", "German", "French", "Dutch"]
    report_language = st.selectbox(
        "Report Language",
        options=report_language_options,
        key="report_language"
    )

    # Map to language codes
    language_map = {
        "Auto-detect": "auto",
        "English": "en",
        "German": "de",
        "French": "fr",
        "Dutch": "nl",
        "Luxembourgish": "lu"
    }

    return {
        "document_language": language_map.get(doc_language, "auto"),
        "report_language": language_map.get(report_language, "en"),
        "auto_detect": doc_language == "Auto-detect"
    }


def _render_analysis_settings() -> Dict:
    """
    Render analysis settings section.

    Returns:
        Dict: Analysis configuration
    """
    st.markdown("""
    <div class="sidebar-section-header">
        ⚙️ SETTINGS
    </div>
    """, unsafe_allow_html=True)

    # Confidence threshold slider
    confidence_threshold = st.slider(
        "Confidence Threshold",
        min_value=0.0,
        max_value=1.0,
        value=0.7,
        step=0.05,
        key="confidence_threshold",
        help="Minimum confidence score to include findings in report"
    )

    # Validate citations toggle
    validate_citations = st.checkbox(
        "☑ Validate citations",
        value=True,
        key="validate_citations",
        help="Enable citation verification by validation agent"
    )

    # Enable iterative search toggle
    enable_iterative_search = st.checkbox(
        "☑ Enable iterative search",
        value=True,
        key="iterative_search",
        help="Use adaptive retrieval with multiple search strategies"
    )

    # Show reasoning chains toggle
    show_reasoning = st.checkbox(
        "☑ Show reasoning chains",
        value=True,
        key="show_reasoning",
        help="Include detailed reasoning in findings"
    )

    # Max requirements to analyze
    max_requirements = st.number_input(
        "Max Requirements",
        min_value=10,
        max_value=200,
        value=100,
        step=10,
        key="max_requirements",
        help="Maximum number of requirements to extract from benchmark"
    )

    return {
        "confidence_threshold": confidence_threshold,
        "validate_citations": validate_citations,
        "enable_iterative_search": enable_iterative_search,
        "show_reasoning": show_reasoning,
        "max_requirements": max_requirements
    }


def _render_status_display(config: Dict):
    """
    Render status display section.

    Args:
        config: Current configuration dictionary
    """
    st.markdown("""
    <div class="sidebar-section-header">
        📊 STATUS
    </div>
    """, unsafe_allow_html=True)

    # API Status
    if config.get("api_key_valid"):
        st.markdown("""
        <div class="status-indicator status-connected">
            ✓ API Connected
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown("""
        <div class="status-indicator status-disconnected">
            ✗ API Not Connected
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Estimate time and cost
    if config.get("model_info"):
        model_info = config["model_info"]

        # Estimate based on model speed
        speed_rating = model_info.get("speed_rating", 3)
        base_time = 12  # minutes

        if speed_rating >= 5:
            est_time = "6-10 min"
        elif speed_rating >= 4:
            est_time = "8-12 min"
        elif speed_rating >= 3:
            est_time = "10-15 min"
        else:
            est_time = "15-20 min"

        st.info(f"⏱️ **Est. Time:** {est_time}")

        # Estimate cost
        if config.get("provider") != "ollama":
            # Rough estimate: 30 requirements × 5k tokens per requirement
            input_tokens = 30 * 5000
            output_tokens = 30 * 1000

            cost_input = (input_tokens / 1000) * model_info.get("cost_per_1k_input", 0)
            cost_output = (output_tokens / 1000) * model_info.get("cost_per_1k_output", 0)
            total_cost = cost_input + cost_output

            if total_cost > 0:
                st.info(f"💰 **Est. Cost:** ${total_cost:.2f}-${total_cost*1.5:.2f}")
        else:
            st.info("💰 **Cost:** Free (Local)")


def get_sidebar_config() -> Optional[Dict]:
    """
    Get the current sidebar configuration.

    Returns:
        Optional[Dict]: Configuration dictionary or None if not ready
    """
    config = render_sidebar()

    # Validate that configuration is complete
    if not config.get("api_key_valid"):
        return None

    if not config.get("selected_domains"):
        return None

    return config
