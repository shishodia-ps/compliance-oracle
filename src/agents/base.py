"""Base agent class for agentic loop pattern."""

from typing import Any, Dict, List, Optional
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
import structlog

from ..services.llm import LLMClient


logger = structlog.get_logger()


class AgentState(str, Enum):
    """Agent execution state."""
    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    OBSERVING = "observing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class AgentStep:
    """A single step in agent execution."""
    step_number: int
    state: AgentState
    thought: str
    action: Optional[str] = None
    observation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Result of agent execution."""
    success: bool
    result: Any
    steps: List[AgentStep] = field(default_factory=list)
    total_steps: int = 0
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """
    Base class for all agents.

    Implements the agentic loop pattern:
    1. Think (understand the task)
    2. Act (take an action)
    3. Observe (see the result)
    4. Decide (continue or complete)

    Subclasses must implement:
    - _think(): Decide what to do next
    - _act(): Take an action
    - _observe(): Process the action result
    - _should_continue(): Decide if more iterations needed
    """

    def __init__(
        self,
        llm_client: LLMClient,
        max_iterations: int = 5,
        agent_name: Optional[str] = None
    ):
        """
        Initialize base agent.

        Args:
            llm_client: LLM client for reasoning
            max_iterations: Maximum number of iterations
            agent_name: Name of the agent
        """
        self.llm_client = llm_client
        self.max_iterations = max_iterations
        self.agent_name = agent_name or self.__class__.__name__

        self.logger = logger.bind(agent=self.agent_name)

        # Execution state
        self.current_step = 0
        self.steps: List[AgentStep] = []
        self.state = AgentState.IDLE

    @abstractmethod
    def _think(self, context: Dict[str, Any]) -> str:
        """
        Think about what to do next.

        Args:
            context: Current context

        Returns:
            Thought/reasoning about next action
        """
        pass

    @abstractmethod
    def _act(self, thought: str, context: Dict[str, Any]) -> Any:
        """
        Take an action based on the thought.

        Args:
            thought: The reasoning from _think()
            context: Current context

        Returns:
            Action result
        """
        pass

    @abstractmethod
    def _observe(self, action_result: Any, context: Dict[str, Any]) -> str:
        """
        Observe and process the action result.

        Args:
            action_result: Result from _act()
            context: Current context

        Returns:
            Observation/interpretation of result
        """
        pass

    @abstractmethod
    def _should_continue(self, context: Dict[str, Any]) -> bool:
        """
        Decide if agent should continue iterating.

        Args:
            context: Current context

        Returns:
            True if should continue, False if done
        """
        pass

    def run(self, initial_context: Dict[str, Any]) -> AgentResult:
        """
        Run the agent loop.

        Args:
            initial_context: Initial context for the agent

        Returns:
            AgentResult with final output
        """
        self.logger.info(
            "Agent starting",
            max_iterations=self.max_iterations
        )

        context = initial_context.copy()
        self.current_step = 0
        self.steps = []
        self.state = AgentState.IDLE

        try:
            while self.current_step < self.max_iterations:
                self.current_step += 1

                self.logger.debug(
                    "Agent iteration",
                    step=self.current_step,
                    max_iterations=self.max_iterations
                )

                # Think
                self.state = AgentState.THINKING
                thought = self._think(context)

                self.logger.debug(
                    "Agent thought",
                    step=self.current_step,
                    thought=thought[:200]
                )

                # Act
                self.state = AgentState.ACTING
                action_result = self._act(thought, context)

                # Observe
                self.state = AgentState.OBSERVING
                observation = self._observe(action_result, context)

                self.logger.debug(
                    "Agent observation",
                    step=self.current_step,
                    observation=observation[:200] if observation else None
                )

                # Record step
                step = AgentStep(
                    step_number=self.current_step,
                    state=self.state,
                    thought=thought,
                    action=str(action_result)[:500] if action_result else None,
                    observation=observation
                )
                self.steps.append(step)

                # Decide whether to continue
                if not self._should_continue(context):
                    self.logger.info(
                        "Agent completed",
                        steps=self.current_step
                    )
                    self.state = AgentState.COMPLETED
                    break

            # Extract final result
            final_result = self._extract_result(context)

            return AgentResult(
                success=True,
                result=final_result,
                steps=self.steps,
                total_steps=self.current_step
            )

        except Exception as e:
            self.logger.error(
                "Agent failed",
                error=str(e),
                step=self.current_step
            )
            self.state = AgentState.FAILED

            return AgentResult(
                success=False,
                result=None,
                steps=self.steps,
                total_steps=self.current_step,
                error=str(e)
            )

    def _extract_result(self, context: Dict[str, Any]) -> Any:
        """
        Extract the final result from context.

        Override this if you need custom result extraction.

        Args:
            context: Final context

        Returns:
            Final result
        """
        return context.get("result")

    def get_execution_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the agent execution.

        Returns:
            Summary dictionary
        """
        return {
            "agent_name": self.agent_name,
            "total_steps": len(self.steps),
            "final_state": self.state.value,
            "steps": [
                {
                    "step": s.step_number,
                    "state": s.state.value,
                    "thought": s.thought[:100],
                    "observation": s.observation[:100] if s.observation else None
                }
                for s in self.steps
            ]
        }

    def __repr__(self) -> str:
        """String representation."""
        return f"{self.agent_name}(state={self.state.value}, steps={len(self.steps)})"
