"""Application settings and configuration."""

from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # =========================================================================
    # API Keys
    # =========================================================================
    openai_api_key: Optional[SecretStr] = Field(default=None, description="OpenAI API key")
    anthropic_api_key: Optional[SecretStr] = Field(default=None, description="Anthropic API key")
    azure_openai_api_key: Optional[SecretStr] = Field(default=None, description="Azure OpenAI API key")
    azure_openai_endpoint: Optional[str] = Field(default=None, description="Azure OpenAI endpoint")
    azure_openai_deployment: Optional[str] = Field(default=None, description="Azure OpenAI deployment name")
    
    # =========================================================================
    # Default Configuration
    # =========================================================================
    default_provider: Literal["openai", "anthropic", "azure", "ollama"] = Field(
        default="openai",
        description="Default LLM provider"
    )
    default_model: str = Field(
        default="gpt-4o-mini",
        description="Default model name"
    )
    default_temperature: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="Default LLM temperature"
    )
    
    # =========================================================================
    # Feature Flags
    # =========================================================================
    enable_ocr: bool = Field(default=False, description="Enable OCR for scanned PDFs")
    enable_translation: bool = Field(default=False, description="Enable automatic translation")
    enable_caching: bool = Field(default=True, description="Enable response caching")
    debug_mode: bool = Field(default=False, description="Enable debug logging")
    
    # =========================================================================
    # Limits
    # =========================================================================
    max_file_size_mb: int = Field(default=50, description="Maximum file size in MB")
    max_pages: int = Field(default=500, description="Maximum pages to process")
    max_requirements: int = Field(default=100, description="Maximum requirements to extract")
    max_retrieval_iterations: int = Field(default=3, description="Maximum retrieval iterations")
    max_validation_retries: int = Field(default=2, description="Maximum validation retries")
    
    # =========================================================================
    # Analysis Settings
    # =========================================================================
    confidence_threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Minimum confidence for findings"
    )
    include_low_confidence: bool = Field(
        default=False,
        description="Include low-confidence findings"
    )
    
    # =========================================================================
    # Logging
    # =========================================================================
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Logging level"
    )
    log_format: Literal["json", "text"] = Field(
        default="text",
        description="Log format"
    )
    
    # =========================================================================
    # Computed Properties
    # =========================================================================
    @property
    def max_file_size_bytes(self) -> int:
        """Maximum file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024
    
    def get_api_key(self, provider: str) -> Optional[str]:
        """Get API key for the specified provider."""
        key_map = {
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
            "azure": self.azure_openai_api_key,
        }
        secret = key_map.get(provider)
        return secret.get_secret_value() if secret else None
    
    def has_valid_api_key(self, provider: str) -> bool:
        """Check if a valid API key exists for the provider."""
        key = self.get_api_key(provider)
        return key is not None and len(key) > 10


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# =========================================================================
# Application Constants
# =========================================================================

APP_NAME = "Compliance Oracle"
APP_VERSION = "3.0.0"
APP_DESCRIPTION = "Agentic AI-powered regulatory compliance gap analysis"

# Supported file formats
SUPPORTED_FORMATS = {
    "pdf": {
        "extensions": [".pdf"],
        "mime_types": ["application/pdf"],
        "description": "PDF documents"
    },
    "docx": {
        "extensions": [".docx"],
        "mime_types": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        "description": "Word documents (modern)"
    },
    "doc": {
        "extensions": [".doc"],
        "mime_types": ["application/msword"],
        "description": "Word documents (legacy)"
    },
    "txt": {
        "extensions": [".txt"],
        "mime_types": ["text/plain"],
        "description": "Plain text"
    },
    "html": {
        "extensions": [".html", ".htm"],
        "mime_types": ["text/html"],
        "description": "HTML documents"
    },
    "rtf": {
        "extensions": [".rtf"],
        "mime_types": ["application/rtf", "text/rtf"],
        "description": "Rich text format"
    },
}

# Supported languages
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "native": "English", "tier": 1},
    "de": {"name": "German", "native": "Deutsch", "tier": 1},
    "fr": {"name": "French", "native": "Français", "tier": 1},
    "nl": {"name": "Dutch", "native": "Nederlands", "tier": 1},
    "lu": {"name": "Luxembourgish", "native": "Lëtzebuergesch", "tier": 1},
    "it": {"name": "Italian", "native": "Italiano", "tier": 2},
    "es": {"name": "Spanish", "native": "Español", "tier": 2},
    "pt": {"name": "Portuguese", "native": "Português", "tier": 2},
}

# Severity levels
SEVERITY_LEVELS = {
    "critical": {"order": 1, "color": "#dc3545", "icon": "🔴"},
    "high": {"order": 2, "color": "#fd7e14", "icon": "🟠"},
    "medium": {"order": 3, "color": "#ffc107", "icon": "🟡"},
    "low": {"order": 4, "color": "#28a745", "icon": "🟢"},
}

# Gap types
GAP_TYPES = [
    "missing_requirement",      # Policy doesn't address requirement at all
    "partial_implementation",   # Policy addresses but incompletely
    "inconsistent_implementation",  # Policy has conflicting provisions
    "ambiguous_coverage",       # Unclear if policy meets requirement
    "contradictory_provision",  # Policy contradicts requirement
]
