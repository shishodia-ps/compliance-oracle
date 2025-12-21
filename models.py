"""LLM Model registry and configuration."""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class ModelConfig:
    """Configuration for a single LLM model."""
    id: str
    display_name: str
    description: str
    cost_per_1k_input: float
    cost_per_1k_output: float
    speed_rating: int  # 1-5, 5 being fastest
    quality_rating: int  # 1-5, 5 being best
    context_window: int
    recommended_for: List[str]
    is_default: bool = False
    warning: Optional[str] = None
    requirements: Optional[str] = None


MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    # =========================================================================
    # OpenAI Models
    # =========================================================================
    "openai": {
        "provider_name": "OpenAI",
        "provider_icon": "🟢",
        "api_key_env": "OPENAI_API_KEY",
        "models": {
            "gpt-4o": ModelConfig(
                id="gpt-4o",
                display_name="GPT-4o",
                description="Most capable OpenAI model, best for complex analysis",
                cost_per_1k_input=0.005,
                cost_per_1k_output=0.015,
                speed_rating=3,
                quality_rating=5,
                context_window=128000,
                recommended_for=["critical_audit", "complex_analysis", "production"]
            ),
            "gpt-4o-mini": ModelConfig(
                id="gpt-4o-mini",
                display_name="GPT-4o Mini",
                description="Best balance of cost and quality - RECOMMENDED",
                cost_per_1k_input=0.00015,
                cost_per_1k_output=0.0006,
                speed_rating=5,
                quality_rating=4,
                context_window=128000,
                recommended_for=["standard_analysis", "cost_effective"],
                is_default=True
            ),
            "gpt-4-turbo": ModelConfig(
                id="gpt-4-turbo",
                display_name="GPT-4 Turbo",
                description="High capability with large context window",
                cost_per_1k_input=0.01,
                cost_per_1k_output=0.03,
                speed_rating=3,
                quality_rating=5,
                context_window=128000,
                recommended_for=["large_documents", "detailed_analysis"]
            ),
            "gpt-3.5-turbo": ModelConfig(
                id="gpt-3.5-turbo",
                display_name="GPT-3.5 Turbo",
                description="Fast and cheap, but lower accuracy",
                cost_per_1k_input=0.0005,
                cost_per_1k_output=0.0015,
                speed_rating=5,
                quality_rating=3,
                context_window=16385,
                recommended_for=["testing", "development"],
                warning="Not recommended for production compliance analysis"
            ),
        }
    },

    # =========================================================================
    # Anthropic Models
    # =========================================================================
    "anthropic": {
        "provider_name": "Anthropic",
        "provider_icon": "🟤",
        "api_key_env": "ANTHROPIC_API_KEY",
        "models": {
            "claude-3-5-sonnet-20241022": ModelConfig(
                id="claude-3-5-sonnet-20241022",
                display_name="Claude 3.5 Sonnet",
                description="Excellent reasoning, great for legal/regulatory text",
                cost_per_1k_input=0.003,
                cost_per_1k_output=0.015,
                speed_rating=4,
                quality_rating=5,
                context_window=200000,
                recommended_for=["legal_analysis", "complex_reasoning", "production"]
            ),
            "claude-3-opus-20240229": ModelConfig(
                id="claude-3-opus-20240229",
                display_name="Claude 3 Opus",
                description="Highest accuracy, best for critical audits",
                cost_per_1k_input=0.015,
                cost_per_1k_output=0.075,
                speed_rating=1,
                quality_rating=5,
                context_window=200000,
                recommended_for=["highest_accuracy", "critical_audit"]
            ),
            "claude-3-haiku-20240307": ModelConfig(
                id="claude-3-haiku-20240307",
                display_name="Claude 3 Haiku",
                description="Fast and affordable for simpler tasks",
                cost_per_1k_input=0.00025,
                cost_per_1k_output=0.00125,
                speed_rating=5,
                quality_rating=3,
                context_window=200000,
                recommended_for=["testing", "simple_tasks"],
                warning="May miss nuanced compliance issues"
            ),
        }
    },

    # =========================================================================
    # Azure OpenAI Models
    # =========================================================================
    "azure": {
        "provider_name": "Azure OpenAI",
        "provider_icon": "🔵",
        "api_key_env": "AZURE_OPENAI_API_KEY",
        "requires_endpoint": True,
        "requires_deployment": True,
        "models": {
            "gpt-4o": ModelConfig(
                id="gpt-4o",
                display_name="GPT-4o (Azure)",
                description="GPT-4o via Azure - enterprise deployment",
                cost_per_1k_input=0.005,  # May vary by agreement
                cost_per_1k_output=0.015,
                speed_rating=3,
                quality_rating=5,
                context_window=128000,
                recommended_for=["enterprise", "data_residency"]
            ),
            "gpt-4o-mini": ModelConfig(
                id="gpt-4o-mini",
                display_name="GPT-4o Mini (Azure)",
                description="GPT-4o Mini via Azure",
                cost_per_1k_input=0.00015,
                cost_per_1k_output=0.0006,
                speed_rating=5,
                quality_rating=4,
                context_window=128000,
                recommended_for=["enterprise", "cost_effective"]
            ),
        }
    },

    # =========================================================================
    # Local Models (Ollama)
    # =========================================================================
    "ollama": {
        "provider_name": "Ollama (Local)",
        "provider_icon": "🦙",
        "api_key_env": None,  # No API key needed
        "base_url": "http://localhost:11434",
        "models": {
            "llama3.1:70b": ModelConfig(
                id="llama3.1:70b",
                display_name="Llama 3.1 70B",
                description="Large local model, requires powerful GPU",
                cost_per_1k_input=0,
                cost_per_1k_output=0,
                speed_rating=2,
                quality_rating=4,
                context_window=131072,
                recommended_for=["offline", "privacy", "no_api_costs"],
                requirements="Requires 48GB+ VRAM"
            ),
            "llama3.1:8b": ModelConfig(
                id="llama3.1:8b",
                display_name="Llama 3.1 8B",
                description="Smaller local model, runs on consumer GPUs",
                cost_per_1k_input=0,
                cost_per_1k_output=0,
                speed_rating=4,
                quality_rating=3,
                context_window=131072,
                recommended_for=["testing", "local", "development"],
                requirements="Requires 8GB+ VRAM"
            ),
            "mistral:7b": ModelConfig(
                id="mistral:7b",
                display_name="Mistral 7B",
                description="Efficient local model",
                cost_per_1k_input=0,
                cost_per_1k_output=0,
                speed_rating=4,
                quality_rating=3,
                context_window=32768,
                recommended_for=["testing", "local"],
                requirements="Requires 8GB+ VRAM"
            ),
        }
    },
}


def get_model_config(provider: str, model_id: str) -> Optional[ModelConfig]:
    """
    Get configuration for a specific model.
    
    Args:
        provider: Provider name (e.g., "openai", "anthropic")
        model_id: Model ID (e.g., "gpt-4o-mini")
    
    Returns:
        ModelConfig or None if not found
    """
    if provider not in MODEL_REGISTRY:
        return None
    
    models = MODEL_REGISTRY[provider].get("models", {})
    return models.get(model_id)


def get_default_model(provider: str) -> Optional[str]:
    """Get the default model ID for a provider."""
    if provider not in MODEL_REGISTRY:
        return None
    
    models = MODEL_REGISTRY[provider].get("models", {})
    for model_id, config in models.items():
        if config.is_default:
            return model_id
    
    # Return first model if no default set
    return next(iter(models.keys()), None)


def get_all_providers() -> List[str]:
    """Get list of all available providers."""
    return list(MODEL_REGISTRY.keys())


def get_provider_models(provider: str) -> List[ModelConfig]:
    """Get all models for a provider."""
    if provider not in MODEL_REGISTRY:
        return []
    
    models = MODEL_REGISTRY[provider].get("models", {})
    return list(models.values())


def estimate_cost(
    provider: str,
    model_id: str,
    input_tokens: int,
    output_tokens: int
) -> float:
    """
    Estimate the cost for an API call.
    
    Args:
        provider: Provider name
        model_id: Model ID
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
    
    Returns:
        Estimated cost in USD
    """
    config = get_model_config(provider, model_id)
    if not config:
        return 0.0
    
    input_cost = (input_tokens / 1000) * config.cost_per_1k_input
    output_cost = (output_tokens / 1000) * config.cost_per_1k_output
    
    return input_cost + output_cost


def get_speed_stars(rating: int) -> str:
    """Convert speed rating to star display."""
    return "⚡" * rating


def get_quality_stars(rating: int) -> str:
    """Convert quality rating to star display."""
    return "⭐" * rating
