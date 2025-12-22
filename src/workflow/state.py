"""
Workflow state definition for LangGraph.

This module defines the TypedDict that represents the state of the compliance
analysis workflow as it progresses through the LangGraph nodes.
"""

from typing import TypedDict, List, Dict, Any, Optional
from ..models.documents import Document
from ..models.requirements import Requirement
from ..models.findings import Finding


class WorkflowState(TypedDict, total=False):
    """
    State object that is passed through the LangGraph workflow.

    This state tracks the entire compliance analysis process:
    - Documents being analyzed
    - Requirements extracted from the benchmark
    - Current requirement being processed
    - Search queries and retrieval results
    - Findings from gap analysis
    - Validation status and iteration counters
    - Logs and errors for debugging
    """

    # Input documents
    policy_document: Optional[Document]
    benchmark_document: Optional[Document]

    # Extracted requirements from benchmark
    requirements: List[Requirement]
    total_requirements: int

    # Current requirement being processed
    current_requirement: Optional[Requirement]
    current_requirement_index: int

    # Query understanding results
    search_queries: Dict[str, List[str]]  # {"primary": [...], "secondary": [...], "category": [...]}

    # Retrieval results
    retrieval_results: List[Dict[str, Any]]  # List of retrieved sections with metadata
    retrieval_iteration: int
    max_retrieval_iterations: int
    retrieval_confidence: float

    # Analysis results
    current_finding: Optional[Finding]
    analysis_reasoning: List[Dict[str, str]]  # Chain-of-thought reasoning steps

    # Validation results
    validation_status: Optional[str]  # "approved", "rejected", "retry"
    validation_feedback: Optional[str]
    validation_iteration: int
    max_validation_iterations: int

    # Aggregated findings
    findings: List[Finding]

    # Workflow control
    all_requirements_processed: bool
    workflow_status: str  # "running", "completed", "failed"

    # Logs and debugging
    logs: List[str]
    errors: List[str]

    # Metadata
    session_id: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]


def create_initial_state() -> WorkflowState:
    """
    Create an initial workflow state with default values.

    Returns:
        WorkflowState: Initial state object
    """
    return WorkflowState(
        policy_document=None,
        benchmark_document=None,
        requirements=[],
        total_requirements=0,
        current_requirement=None,
        current_requirement_index=0,
        search_queries={},
        retrieval_results=[],
        retrieval_iteration=0,
        max_retrieval_iterations=3,
        retrieval_confidence=0.0,
        current_finding=None,
        analysis_reasoning=[],
        validation_status=None,
        validation_feedback=None,
        validation_iteration=0,
        max_validation_iterations=2,
        findings=[],
        all_requirements_processed=False,
        workflow_status="running",
        logs=[],
        errors=[],
        session_id=None,
        start_time=None,
        end_time=None,
    )


def add_log(state: WorkflowState, message: str) -> None:
    """
    Add a log message to the workflow state.

    Args:
        state: Current workflow state
        message: Log message to add
    """
    if "logs" not in state:
        state["logs"] = []
    state["logs"].append(message)


def add_error(state: WorkflowState, error: str) -> None:
    """
    Add an error message to the workflow state.

    Args:
        state: Current workflow state
        error: Error message to add
    """
    if "errors" not in state:
        state["errors"] = []
    state["errors"].append(error)


def reset_retrieval_iteration(state: WorkflowState) -> None:
    """
    Reset retrieval iteration counter for a new requirement.

    Args:
        state: Current workflow state
    """
    state["retrieval_iteration"] = 0
    state["retrieval_results"] = []
    state["retrieval_confidence"] = 0.0


def reset_validation_iteration(state: WorkflowState) -> None:
    """
    Reset validation iteration counter for a new finding.

    Args:
        state: Current workflow state
    """
    state["validation_iteration"] = 0
    state["validation_status"] = None
    state["validation_feedback"] = None


def increment_retrieval_iteration(state: WorkflowState) -> None:
    """
    Increment the retrieval iteration counter.

    Args:
        state: Current workflow state
    """
    state["retrieval_iteration"] = state.get("retrieval_iteration", 0) + 1


def increment_validation_iteration(state: WorkflowState) -> None:
    """
    Increment the validation iteration counter.

    Args:
        state: Current workflow state
    """
    state["validation_iteration"] = state.get("validation_iteration", 0) + 1


def get_next_requirement(state: WorkflowState) -> Optional[Requirement]:
    """
    Get the next requirement to process.

    Args:
        state: Current workflow state

    Returns:
        Next requirement or None if all processed
    """
    requirements = state.get("requirements", [])
    index = state.get("current_requirement_index", 0)

    if index < len(requirements):
        return requirements[index]
    return None


def move_to_next_requirement(state: WorkflowState) -> None:
    """
    Move to the next requirement in the list.

    Args:
        state: Current workflow state
    """
    state["current_requirement_index"] = state.get("current_requirement_index", 0) + 1

    # Reset iteration counters for the new requirement
    reset_retrieval_iteration(state)
    reset_validation_iteration(state)

    # Clear current finding and analysis
    state["current_finding"] = None
    state["analysis_reasoning"] = []

    # Get next requirement
    next_req = get_next_requirement(state)
    state["current_requirement"] = next_req

    # Check if all requirements processed
    if next_req is None:
        state["all_requirements_processed"] = True
