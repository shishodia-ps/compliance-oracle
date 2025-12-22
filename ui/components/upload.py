"""
File Upload Component
=====================

Handles file upload with:
- Drag-and-drop zone for policy document
- Benchmark options (auto-fetch based on jurisdiction OR upload OR URL)
- File validation (size, format)
- Language detection display after upload
- Uploaded files list with remove option
"""

import streamlit as st
from typing import Optional, Dict, Tuple
from pathlib import Path
import tempfile
from src.config.settings import Settings
from src.parsers.pdf import PDFParser
from src.parsers.docx import DOCXParser
from src.parsers.language import detect_language


# Supported file extensions
SUPPORTED_FORMATS = {
    "pdf": "PDF Document",
    "docx": "Word Document (DOCX)",
    "doc": "Word Document (DOC)",
    "txt": "Plain Text",
    "md": "Markdown",
    "html": "HTML Document",
}

MAX_FILE_SIZE_MB = 50


def render_upload_section(config: Dict) -> Dict:
    """
    Render the file upload section.

    Args:
        config: Configuration from sidebar

    Returns:
        Dict: Upload results with file paths and metadata
    """
    st.markdown("## 📄 Document Upload")

    # Create two columns for policy and benchmark
    col1, col2 = st.columns(2)

    with col1:
        policy_result = _render_policy_upload()

    with col2:
        benchmark_result = _render_benchmark_options(config)

    return {
        "policy": policy_result,
        "benchmark": benchmark_result
    }


def _render_policy_upload() -> Optional[Dict]:
    """
    Render policy document upload section.

    Returns:
        Optional[Dict]: Policy file information or None
    """
    st.markdown("### Internal Policy Document")
    st.markdown("Upload your company's compliance policy document")

    uploaded_file = st.file_uploader(
        "Choose policy document",
        type=list(SUPPORTED_FORMATS.keys()),
        key="policy_upload",
        help=f"Supported formats: {', '.join(SUPPORTED_FORMATS.values())}"
    )

    if uploaded_file is None:
        # Show upload zone instructions
        st.markdown("""
        <div class="upload-zone">
            <div class="upload-icon">📄</div>
            <p><strong>Drag and drop your policy document here</strong></p>
            <p style="color: #6c757d; font-size: 0.9rem;">
                or click to browse
            </p>
            <p style="color: #6c757d; font-size: 0.85rem; margin-top: 1rem;">
                Supported: PDF, DOCX, DOC, TXT, MD, HTML<br>
                Max size: 50 MB
            </p>
        </div>
        """, unsafe_allow_html=True)
        return None

    # Validate file
    validation_result = _validate_file(uploaded_file)

    if not validation_result["valid"]:
        st.error(f"❌ {validation_result['error']}")
        return None

    # Show file information
    file_info = _display_file_info(uploaded_file, "policy")

    # Save uploaded file to temp location
    temp_path = _save_uploaded_file(uploaded_file)

    if temp_path:
        file_info["temp_path"] = temp_path

        # Detect language if enabled
        if st.session_state.get("doc_language") == "Auto-detect":
            with st.spinner("Detecting language..."):
                detected_lang = _detect_document_language(temp_path, uploaded_file.type)
                if detected_lang:
                    file_info["detected_language"] = detected_lang
                    st.success(f"✓ Detected language: {detected_lang}")

        return file_info

    return None


def _render_benchmark_options(config: Dict) -> Optional[Dict]:
    """
    Render benchmark document options.

    Args:
        config: Configuration from sidebar

    Returns:
        Optional[Dict]: Benchmark information or None
    """
    st.markdown("### Regulatory Benchmark")
    st.markdown("Select how to provide the benchmark regulation")

    # Benchmark source selection
    benchmark_source = st.radio(
        "Benchmark Source",
        options=["Auto-fetch", "Upload Document", "Enter URL"],
        key="benchmark_source",
        horizontal=True
    )

    if benchmark_source == "Auto-fetch":
        return _render_auto_fetch_benchmark(config)
    elif benchmark_source == "Upload Document":
        return _render_benchmark_upload()
    else:  # Enter URL
        return _render_benchmark_url()


def _render_auto_fetch_benchmark(config: Dict) -> Optional[Dict]:
    """
    Render auto-fetch benchmark section.

    Args:
        config: Configuration from sidebar

    Returns:
        Optional[Dict]: Benchmark information
    """
    jurisdiction = config.get("jurisdiction")
    selected_domains = config.get("selected_domains", [])

    if not jurisdiction or not selected_domains:
        st.info("ℹ️ Select jurisdiction and domains in sidebar first")
        return None

    jurisdiction_data = config.get("jurisdiction_data", {})

    st.markdown("**Available benchmarks:**")

    # Show available benchmarks for selected domains
    available_benchmarks = []

    for domain in selected_domains:
        if domain in jurisdiction_data.get("benchmarks", {}):
            benchmark_info = jurisdiction_data["benchmarks"][domain]
            primary = benchmark_info.get("primary", {})

            if primary:
                available_benchmarks.append({
                    "domain": domain,
                    "name": primary.get("name", ""),
                    "full_name": primary.get("full_name", ""),
                    "citation": primary.get("citation", ""),
                    "url": primary.get("url", ""),
                })

                # Display benchmark info
                with st.expander(f"📋 {domain}: {primary.get('name', '')}"):
                    st.write(f"**Full Name:** {primary.get('full_name', 'N/A')}")
                    st.write(f"**Citation:** {primary.get('citation', 'N/A')}")
                    if primary.get('url'):
                        st.write(f"**URL:** [{primary['url']}]({primary['url']})")

    if not available_benchmarks:
        st.warning("⚠️ No benchmarks available for selected jurisdiction and domains")
        return None

    # Select which benchmarks to use
    if len(available_benchmarks) == 1:
        st.success(f"✓ Will use: {available_benchmarks[0]['name']}")
        selected_benchmarks = available_benchmarks
    else:
        st.info("💡 Multiple benchmarks available - all will be used")
        selected_benchmarks = available_benchmarks

    return {
        "source": "auto-fetch",
        "benchmarks": selected_benchmarks,
        "jurisdiction": jurisdiction
    }


def _render_benchmark_upload() -> Optional[Dict]:
    """
    Render benchmark document upload.

    Returns:
        Optional[Dict]: Benchmark file information
    """
    uploaded_file = st.file_uploader(
        "Choose benchmark document",
        type=list(SUPPORTED_FORMATS.keys()),
        key="benchmark_upload",
        help=f"Supported formats: {', '.join(SUPPORTED_FORMATS.values())}"
    )

    if not uploaded_file:
        st.info("📄 Upload the regulatory document to use as benchmark")
        return None

    # Validate file
    validation_result = _validate_file(uploaded_file)

    if not validation_result["valid"]:
        st.error(f"❌ {validation_result['error']}")
        return None

    # Show file information
    file_info = _display_file_info(uploaded_file, "benchmark")

    # Save uploaded file
    temp_path = _save_uploaded_file(uploaded_file)

    if temp_path:
        file_info["temp_path"] = temp_path
        return {
            "source": "upload",
            "file_info": file_info
        }

    return None


def _render_benchmark_url() -> Optional[Dict]:
    """
    Render benchmark URL input.

    Returns:
        Optional[Dict]: Benchmark URL information
    """
    url = st.text_input(
        "Benchmark Document URL",
        key="benchmark_url",
        placeholder="https://eur-lex.europa.eu/...",
        help="Enter the URL of the regulatory document"
    )

    if not url:
        st.info("🔗 Enter the URL of the regulatory document")
        return None

    # Basic URL validation
    if not url.startswith(("http://", "https://")):
        st.error("❌ Invalid URL - must start with http:// or https://")
        return None

    st.success(f"✓ URL: {url}")

    return {
        "source": "url",
        "url": url
    }


def _validate_file(uploaded_file) -> Dict:
    """
    Validate uploaded file.

    Args:
        uploaded_file: Streamlit UploadedFile object

    Returns:
        Dict: Validation result with 'valid' and optional 'error'
    """
    # Check file size
    file_size_mb = uploaded_file.size / (1024 * 1024)

    if file_size_mb > MAX_FILE_SIZE_MB:
        return {
            "valid": False,
            "error": f"File size ({file_size_mb:.1f} MB) exceeds maximum ({MAX_FILE_SIZE_MB} MB)"
        }

    # Check file extension
    file_extension = Path(uploaded_file.name).suffix.lower().lstrip('.')

    if file_extension not in SUPPORTED_FORMATS:
        return {
            "valid": False,
            "error": f"Unsupported file format: {file_extension}"
        }

    # Check if file is empty
    if uploaded_file.size == 0:
        return {
            "valid": False,
            "error": "File is empty"
        }

    return {"valid": True}


def _display_file_info(uploaded_file, file_type: str) -> Dict:
    """
    Display file information card.

    Args:
        uploaded_file: Streamlit UploadedFile object
        file_type: Type of file ('policy' or 'benchmark')

    Returns:
        Dict: File metadata
    """
    file_size_mb = uploaded_file.size / (1024 * 1024)
    file_extension = Path(uploaded_file.name).suffix.lower().lstrip('.')

    st.markdown(f"""
    <div class="info-card">
        <h4>✓ {uploaded_file.name}</h4>
        <div class="metric-row">
            <span class="metric-label">Format:</span>
            <span class="metric-value">{SUPPORTED_FORMATS.get(file_extension, file_extension.upper())}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Size:</span>
            <span class="metric-value">{file_size_mb:.2f} MB</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Add remove button
    if st.button(f"🗑️ Remove {file_type}", key=f"remove_{file_type}"):
        st.session_state[f"{file_type}_upload"] = None
        st.rerun()

    return {
        "filename": uploaded_file.name,
        "size": uploaded_file.size,
        "size_mb": file_size_mb,
        "extension": file_extension,
        "type": file_type
    }


def _save_uploaded_file(uploaded_file) -> Optional[str]:
    """
    Save uploaded file to temporary location.

    Args:
        uploaded_file: Streamlit UploadedFile object

    Returns:
        Optional[str]: Path to saved file or None
    """
    try:
        # Create temp directory if it doesn't exist
        temp_dir = Path(tempfile.gettempdir()) / "compliance_oracle"
        temp_dir.mkdir(exist_ok=True)

        # Save file
        file_path = temp_dir / uploaded_file.name
        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())

        return str(file_path)

    except Exception as e:
        st.error(f"❌ Error saving file: {str(e)}")
        return None


def _detect_document_language(file_path: str, file_type: str) -> Optional[str]:
    """
    Detect language of document.

    Args:
        file_path: Path to document file
        file_type: MIME type of file

    Returns:
        Optional[str]: Detected language code or None
    """
    try:
        # Extract some text from document
        if "pdf" in file_type:
            parser = PDFParser()
        elif "word" in file_type or file_type.endswith("docx"):
            parser = DOCXParser()
        else:
            # For plain text, just read the file directly
            with open(file_path, 'r', encoding='utf-8') as f:
                sample_text = f.read(1000)
            return detect_language(sample_text)

        # Parse document
        document = parser.parse(file_path)

        if not document or not document.text:
            return None

        # Get first 1000 characters for language detection
        sample_text = document.text[:1000]

        # Detect language
        lang_code = detect_language(sample_text)

        # Map to full language names
        language_names = {
            "en": "English",
            "de": "German",
            "fr": "French",
            "nl": "Dutch",
            "lu": "Luxembourgish"
        }

        return language_names.get(lang_code, lang_code.upper())

    except Exception as e:
        st.warning(f"⚠️ Could not detect language: {str(e)}")
        return None


def validate_upload_ready(upload_result: Dict) -> Tuple[bool, str]:
    """
    Validate that upload is ready for analysis.

    Args:
        upload_result: Upload result dictionary

    Returns:
        Tuple[bool, str]: (is_ready, error_message)
    """
    policy = upload_result.get("policy")
    benchmark = upload_result.get("benchmark")

    if not policy:
        return False, "Please upload a policy document"

    if not benchmark:
        return False, "Please select or upload a benchmark document"

    if not policy.get("temp_path"):
        return False, "Policy document not saved properly"

    # Validate benchmark based on source
    if benchmark.get("source") == "auto-fetch":
        if not benchmark.get("benchmarks"):
            return False, "No benchmarks available for auto-fetch"
    elif benchmark.get("source") == "upload":
        if not benchmark.get("file_info", {}).get("temp_path"):
            return False, "Benchmark document not saved properly"
    elif benchmark.get("source") == "url":
        if not benchmark.get("url"):
            return False, "No benchmark URL provided"

    return True, ""
