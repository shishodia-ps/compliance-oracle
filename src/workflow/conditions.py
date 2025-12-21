"""
Edge condition functions for LangGraph workflow.

This module defines the conditional edge functions that determine the flow
through the compliance analysis workflow graph. These functions evaluate the
current state and decide which node to execute next.
"""

from typing import Literal
from src.workflow.state import WorkflowState


def needs_more_retrieval(state: WorkflowState) -> Literal["retrieve_more", "analyze"]:
    """
    Determine if more retrieval iterations are needed.

    Checks:
    1. Has max iterations been reached? → analyze
    2. Is retrieval confidence low? → retrieve_more
    3. Are there no results? → retrieve_more
    4. Otherwise → analyze

    Args:
        state: Current workflow state

    Returns:
        "retrieve_more" to continue retrieval, "analyze" to proceed to analysis
    """
    retrieval_iteration = state.get("retrieval_iteration", 0)
    max_iterations = state.get("max_retrieval_iterations", 3)
    confidence = state.get("retrieval_confidence", 0.0)
    results = state.get("retrieval_results", [])

    # Check if max iterations reached
    if retrieval_iteration >= max_iterations:
        return "analyze"

    # Check if we have no results - need to try more
    if not results:
        return "retrieve_more"

    # Check if confidence is too low (threshold: 0.7)
    if confidence < 0.7 and retrieval_iteration < max_iterations:
        return "retrieve_more"

    # Otherwise, proceed to analysis
    return "analyze"


def needs_validation_retry(state: WorkflowState) -> Literal["retry_analysis", "aggregate", "retry_retrieval"]:
    """
    Determine if validation failed and retry is needed.

    Checks:
    1. Is validation approved? → aggregate
    2. Is validation rejected (bad citation/hallucination)? → aggregate (discard finding)
    3. Should retry analysis? → retry_analysis
    4. Should retry retrieval? → retry_retrieval
    5. Max retries exceeded? → aggregate (discard finding)

    Args:
        state: Current workflow state

    Returns:
        "aggregate" to move to next requirement
        "retry_analysis" to re-run analysis
        "retry_retrieval" to get more context
    """
    validation_status = state.get("validation_status")
    validation_iteration = state.get("validation_iteration", 0)
    max_iterations = state.get("max_validation_iterations", 2)
    validation_feedback = state.get("validation_feedback", "")

    # If approved, proceed to aggregate
    if validation_status == "approved":
        return "aggregate"

    # If rejected (bad citation, hallucination), discard and move on
    if validation_status == "rejected":
        return "aggregate"

    # If retry requested and not exceeded max iterations
    if validation_status == "retry" and validation_iteration < max_iterations:
        # Check if feedback suggests we need more retrieval
        if "incomplete" in validation_feedback.lower() or "missing" in validation_feedback.lower():
            return "retry_retrieval"
        else:
            # Otherwise, retry analysis with the same context
            return "retry_analysis"

    # Max retries exceeded - give up and move on
    return "aggregate"


def has_more_requirements(state: WorkflowState) -> Literal["understand_query", "complete"]:
    """
    Check if there are more requirements to process.

    Args:
        state: Current workflow state

    Returns:
        "understand_query" to process next requirement, "complete" if done
    """
    all_processed = state.get("all_requirements_processed", False)

    if all_processed:
        return "complete"
    else:
        return "understand_query"


def is_valid_finding(state: WorkflowState) -> Literal["validate", "aggregate"]:
    """
    Check if the current finding needs validation.

    If no finding (requirement is compliant), skip validation.
    Otherwise, proceed to validation.

    Args:
        state: Current workflow state

    Returns:
        "validate" to validate the finding, "aggregate" to skip validation
    """
    current_finding = state.get("current_finding")

    # If no finding or compliant status, skip validation
    if not current_finding:
        return "aggregate"

    if hasattr(current_finding, "status") and current_finding.status == "compliant":
        return "aggregate"

    # Otherwise, validate the finding
    return "validate"


def check_retrieval_confidence(state: WorkflowState) -> Literal["expand_query", "analyze"]:
    """
    Check if retrieval confidence is sufficient to proceed to analysis.

    This is used for the iterative retrieval loop.

    Args:
        state: Current workflow state

    Returns:
        "expand_query" to try different queries, "analyze" to proceed
    """
    confidence = state.get("retrieval_confidence", 0.0)
    retrieval_iteration = state.get("retrieval_iteration", 0)
    max_iterations = state.get("max_retrieval_iterations", 3)
    results = state.get("retrieval_results", [])

    # If we've hit max iterations, proceed regardless
    if retrieval_iteration >= max_iterations:
        return "analyze"

    # If confidence is good (>= 0.7), proceed
    if confidence >= 0.7:
        return "analyze"

    # If we have some results but low confidence, try expanding query
    if results and confidence < 0.7:
        return "expand_query"

    # If no results at all, expand query
    if not results:
        return "expand_query"

    # Default: proceed to analysis
    return "analyze"


def should_retry_retrieval(state: WorkflowState) -> bool:
    """
    Determine if retrieval should be retried based on validation feedback.

    Args:
        state: Current workflow state

    Returns:
        True if retrieval should be retried, False otherwise
    """
    validation_status = state.get("validation_status")
    validation_feedback = state.get("validation_feedback", "")
    retrieval_iteration = state.get("retrieval_iteration", 0)
    max_iterations = state.get("max_retrieval_iterations", 3)

    if validation_status != "retry":
        return False

    if retrieval_iteration >= max_iterations:
        return False

    # Check feedback for indicators that more retrieval is needed
    needs_more_context = any(
        keyword in validation_feedback.lower()
        for keyword in ["incomplete", "missing", "insufficient", "not found", "more context"]
    )

    return needs_more_context


def workflow_should_continue(state: WorkflowState) -> bool:
    """
    Determine if the workflow should continue or terminate.

    Checks for fatal errors or completion status.

    Args:
        state: Current workflow state

    Returns:
        True if workflow should continue, False to terminate
    """
    workflow_status = state.get("workflow_status", "running")

    # Continue if running
    if workflow_status == "running":
        return True

    # Stop if completed or failed
    if workflow_status in ["completed", "failed"]:
        return False

    # Default: continue
    return True


def route_after_validation(state: WorkflowState) -> Literal["aggregate", "retry_analysis", "retry_retrieval"]:
    """
    Route the workflow after validation based on the validation result.

    This is the main routing logic after validation:
    - approved → aggregate and move to next requirement
    - rejected → aggregate (discard finding) and move to next requirement
    - retry + incomplete → retry retrieval
    - retry + other → retry analysis
    - max retries exceeded → aggregate (discard finding)

    Args:
        state: Current workflow state

    Returns:
        Next node to execute
    """
    validation_status = state.get("validation_status")
    validation_iteration = state.get("validation_iteration", 0)
    max_iterations = state.get("max_validation_iterations", 2)
    validation_feedback = state.get("validation_feedback", "")

    # Approved: move to next requirement
    if validation_status == "approved":
        return "aggregate"

    # Rejected: discard finding and move to next requirement
    if validation_status == "rejected":
        return "aggregate"

    # Retry requested
    if validation_status == "retry":
        # Check if max retries exceeded
        if validation_iteration >= max_iterations:
            return "aggregate"

        # Check if we need more retrieval
        if should_retry_retrieval(state):
            return "retry_retrieval"
        else:
            return "retry_analysis"

    # Default: aggregate (shouldn't reach here)
    return "aggregate"
