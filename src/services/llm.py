"""LLM client wrapper with support for OpenAI and Anthropic."""

import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import structlog
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

try:
    from openai import OpenAI, AzureOpenAI, APIError, RateLimitError, APITimeoutError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from anthropic import Anthropic, APIError as AnthropicAPIError
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from ..config.models import MODEL_REGISTRY, get_model_config, estimate_cost


logger = structlog.get_logger()


@dataclass
class LLMResponse:
    """Response from an LLM call."""
    content: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    cost: float
    finish_reason: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class LLMClient:
    """
    Unified LLM client supporting multiple providers.

    Supports:
    - OpenAI (GPT-4o, GPT-4o-mini, GPT-3.5-turbo, etc.)
    - Anthropic (Claude 3.5 Sonnet, Opus, Haiku)
    - Azure OpenAI
    - Ollama (local models)
    """

    def __init__(
        self,
        provider: str = "openai",
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        **kwargs
    ):
        """
        Initialize LLM client.

        Args:
            provider: Provider name ("openai", "anthropic", "azure", "ollama")
            model: Model ID (if None, uses provider's default)
            api_key: API key (if None, reads from environment)
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters
        """
        self.provider = provider.lower()
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.logger = logger.bind(provider=self.provider)

        # Get provider config
        if self.provider not in MODEL_REGISTRY:
            raise ValueError(f"Unknown provider: {self.provider}")

        self.provider_config = MODEL_REGISTRY[self.provider]

        # Set model
        if model is None:
            from ..config.models import get_default_model
            self.model = get_default_model(self.provider)
        else:
            self.model = model

        # Get model config
        self.model_config = get_model_config(self.provider, self.model)
        if not self.model_config:
            raise ValueError(f"Unknown model: {self.model} for provider: {self.provider}")

        # Initialize client
        self.client = self._init_client(api_key, **kwargs)

        self.logger.info(
            "LLM client initialized",
            provider=self.provider,
            model=self.model
        )

    def _init_client(self, api_key: Optional[str], **kwargs) -> Any:
        """Initialize the provider-specific client."""
        if self.provider == "openai":
            if not OPENAI_AVAILABLE:
                raise ImportError("openai package not installed. Install with: pip install openai")

            api_key = api_key or os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OpenAI API key not provided")

            return OpenAI(api_key=api_key)

        elif self.provider == "anthropic":
            if not ANTHROPIC_AVAILABLE:
                raise ImportError("anthropic package not installed. Install with: pip install anthropic")

            api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("Anthropic API key not provided")

            return Anthropic(api_key=api_key)

        elif self.provider == "azure":
            if not OPENAI_AVAILABLE:
                raise ImportError("openai package not installed. Install with: pip install openai")

            api_key = api_key or os.getenv("AZURE_OPENAI_API_KEY")
            endpoint = kwargs.get("azure_endpoint") or os.getenv("AZURE_OPENAI_ENDPOINT")

            if not api_key or not endpoint:
                raise ValueError("Azure OpenAI requires both API key and endpoint")

            return AzureOpenAI(
                api_key=api_key,
                azure_endpoint=endpoint,
                api_version=kwargs.get("api_version", "2024-02-01")
            )

        elif self.provider == "ollama":
            if not OPENAI_AVAILABLE:
                raise ImportError("openai package not installed for Ollama. Install with: pip install openai")

            # Ollama uses OpenAI-compatible API
            base_url = kwargs.get("base_url") or self.provider_config.get("base_url", "http://localhost:11434/v1")
            return OpenAI(
                base_url=base_url,
                api_key="ollama"  # Ollama doesn't need a real key
            )

        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((RateLimitError, APITimeoutError)),
        reraise=True
    )
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Generate text from a prompt.

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            temperature: Override default temperature
            max_tokens: Override default max_tokens
            **kwargs: Additional provider-specific parameters

        Returns:
            LLMResponse object
        """
        temperature = temperature if temperature is not None else self.temperature
        max_tokens = max_tokens if max_tokens is not None else self.max_tokens

        self.logger.debug(
            "Generating response",
            model=self.model,
            prompt_length=len(prompt),
            temperature=temperature
        )

        if self.provider in ["openai", "azure", "ollama"]:
            return self._generate_openai(prompt, system_prompt, temperature, max_tokens, **kwargs)
        elif self.provider == "anthropic":
            return self._generate_anthropic(prompt, system_prompt, temperature, max_tokens, **kwargs)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def _generate_openai(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        **kwargs
    ) -> LLMResponse:
        """Generate using OpenAI API."""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )

        content = response.choices[0].message.content
        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        finish_reason = response.choices[0].finish_reason

        cost = estimate_cost(self.provider, self.model, input_tokens, output_tokens)

        return LLMResponse(
            content=content,
            model=self.model,
            provider=self.provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            finish_reason=finish_reason
        )

    def _generate_anthropic(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: Optional[int],
        **kwargs
    ) -> LLMResponse:
        """Generate using Anthropic API."""
        # Anthropic requires max_tokens
        if max_tokens is None:
            max_tokens = 4096

        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt or "",
            messages=[
                {"role": "user", "content": prompt}
            ],
            **kwargs
        )

        content = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        finish_reason = response.stop_reason

        cost = estimate_cost(self.provider, self.model, input_tokens, output_tokens)

        return LLMResponse(
            content=content,
            model=self.model,
            provider=self.provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            finish_reason=finish_reason
        )

    def generate_structured(
        self,
        prompt: str,
        schema: Dict[str, Any],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate structured output (JSON) matching a schema.

        Args:
            prompt: User prompt
            schema: JSON schema for output
            system_prompt: System prompt
            **kwargs: Additional parameters

        Returns:
            Parsed JSON object
        """
        import json

        # Add schema to system prompt
        schema_prompt = f"\n\nYou must respond with valid JSON matching this schema:\n{json.dumps(schema, indent=2)}"
        full_system_prompt = (system_prompt or "") + schema_prompt

        response = self.generate(
            prompt=prompt,
            system_prompt=full_system_prompt,
            **kwargs
        )

        # Parse JSON from response
        try:
            # Try to extract JSON from markdown code blocks
            content = response.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            return json.loads(content)
        except json.JSONDecodeError as e:
            self.logger.error(
                "Failed to parse JSON response",
                error=str(e),
                content=response.content[:500]
            )
            raise ValueError(f"LLM did not return valid JSON: {e}")

    def batch_generate(
        self,
        prompts: List[str],
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> List[LLMResponse]:
        """
        Generate responses for multiple prompts.

        Args:
            prompts: List of prompts
            system_prompt: System prompt (same for all)
            **kwargs: Additional parameters

        Returns:
            List of LLMResponse objects
        """
        responses = []
        for prompt in prompts:
            response = self.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                **kwargs
            )
            responses.append(response)

        return responses

    def get_embedding_model(self) -> str:
        """Get the recommended embedding model for this provider."""
        # This would be used if we want provider-specific embeddings
        embedding_models = {
            "openai": "text-embedding-3-small",
            "anthropic": "voyage-2",  # Anthropic recommends Voyage
            "azure": "text-embedding-3-small",
            "ollama": "nomic-embed-text"
        }
        return embedding_models.get(self.provider, "sentence-transformers/all-MiniLM-L6-v2")

    def __repr__(self) -> str:
        """String representation."""
        return f"LLMClient(provider={self.provider}, model={self.model})"
