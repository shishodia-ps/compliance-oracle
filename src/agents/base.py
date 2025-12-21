"""Base agent class for all agentic components."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base class for all agents in the system."""

    def __init__(self, llm_client: Any, config: Optional[Dict[str, Any]] = None):
        """Initialize agent.

        Args:
            llm_client: LLM client for API calls
            config: Agent-specific configuration
        """
        self.llm = llm_client
        self.config = config or {}
        self.name = self.__class__.__name__

    @abstractmethod
    async def run(self, **kwargs) -> Dict[str, Any]:
        """Execute agent logic.

        Args:
            **kwargs: Agent-specific inputs

        Returns:
            Dictionary containing agent output
        """
        pass

    def _build_prompt(self, template: str, **kwargs) -> str:
        """Build prompt from template.

        Args:
            template: Prompt template string
            **kwargs: Variables to substitute in template

        Returns:
            Formatted prompt
        """
        try:
            return template.format(**kwargs)
        except KeyError as e:
            logger.error(f"Missing template variable: {e}")
            raise

    async def _call_llm(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """Call LLM with retry logic.

        Args:
            prompt: User prompt
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            system_prompt: System prompt

        Returns:
            LLM response text
        """
        # This will be implemented when LLM service is built
        # For now, raise NotImplementedError
        raise NotImplementedError("LLM client not implemented yet")

    def log(self, message: str, level: str = "info"):
        """Log a message.

        Args:
            message: Message to log
            level: Log level (debug, info, warning, error)
        """
        log_func = getattr(logger, level, logger.info)
        log_func(f"[{self.name}] {message}")
