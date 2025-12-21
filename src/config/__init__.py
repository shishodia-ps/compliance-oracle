"""Configuration module for Compliance Oracle."""

from .settings import Settings, get_settings
from .keywords import MULTILINGUAL_KEYWORDS, get_keywords_for_domain
from .models import MODEL_REGISTRY, get_model_config
from .jurisdictions import JURISDICTION_REGISTRY, get_jurisdiction_config

__all__ = [
    "Settings",
    "get_settings",
    "MULTILINGUAL_KEYWORDS",
    "get_keywords_for_domain",
    "MODEL_REGISTRY", 
    "get_model_config",
    "JURISDICTION_REGISTRY",
    "get_jurisdiction_config",
]
