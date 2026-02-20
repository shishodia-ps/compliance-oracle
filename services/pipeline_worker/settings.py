"""
Environment configuration for the Dutch Legal AI Pipeline Worker.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Pipeline worker configuration."""
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    
    # Data paths
    DATA_DIR: Path = Path("/app/data")
    
    # AI Providers
    LLAMA_CLOUD_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # Pipeline settings
    AI_MOCK_MODE: bool = False
    MAX_CONCURRENT: int = 4
    LLM_MODEL: str = "gpt-4o-mini"
    RETRY_ATTEMPTS: int = 3
    
    # LlamaCloud settings
    LLAMA_PARSE_TIER: str = "agentic_plus"
    LLAMA_PARSE_VERSION: str = "latest"
    LLAMA_OCR_LANGUAGES: list = ["nld", "eng"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings."""
    return settings
