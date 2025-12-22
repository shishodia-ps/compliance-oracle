"""
LangGraph workflow definition for compliance analysis.

This module defines the complete LangGraph workflow that orchestrates the
compliance analysis process through multiple agents with iterative loops
and self-correction mechanisms.

Workflow Flow:
    START
      ↓
    parse_documents
      ↓
    extract_requirements
      ↓
    ╔═══════════════════════════════════════════╗
    ║  FOR EACH REQUIREMENT (Loop)              ║
    ║                                           ║
    ║  understand_query                         ║
    ║       ↓                                   ║
    ║  retrieve_context ←─┐                     ║
    ║       ↓             │                     ║
    ║  [needs_more?] ─────┘                     ║
    ║       ↓                                   ║
    ║  analyze_gap                              ║
    ║       ↓                                   ║
    ║  validate_finding                         ║
    ║       ↓                                   ║
    ║  [validation result]                      ║
    ║       ├─ approved → aggregate_findings    ║
    ║       ├─ retry → analyze_gap              ║
    ║       └─ retry_retrieval → retrieve       ║
    ║                                           ║
    ║  aggregate_findings                       ║
    ║       ↓                                   ║
    ║  [has more requirements?]                 ║
    ║       ├─ yes → understand_query           ║
    ║       └─ no → END                         ║
    ╚═══════════════════════════════════════════╝
"""

import logging
from datetime import datetime
from typing import Optional
from langgraph.graph import StateGraph, END
from .state import WorkflowState, create_initial_state
from .nodes import (
    parse_documents,
    extract_requirements,
    understand_query,
    retrieve_context,
    analyze_gap,
    validate_finding,
    aggregate_findings,
)
from .conditions import (
    needs_more_retrieval,
    has_more_requirements,
    route_after_validation,
)

logger = logging.getLogger(__name__)


def create_compliance_workflow() -> StateGraph:
    """
    Create the LangGraph workflow for compliance analysis.

    The workflow implements an agentic RAG pattern with:
    - Iterative retrieval (up to 3 iterations)
    - Self-correction through validation
    - Retry mechanisms for failed validations
    - Processing each requirement through the full pipeline

    Returns:
        Compiled StateGraph ready for execution
    """
    # Create the state graph
    workflow = StateGraph(WorkflowState)

    # Add nodes for each step
    workflow.add_node("parse_documents", parse_documents)
    workflow.add_node("extract_requirements", extract_requirements)
    workflow.add_node("understand_query", understand_query)
    workflow.add_node("retrieve_context", retrieve_context)
    workflow.add_node("analyze_gap", analyze_gap)
    workflow.add_node("validate_finding", validate_finding)
    workflow.add_node("aggregate_findings", aggregate_findings)

    # Define the entry point
    workflow.set_entry_point("parse_documents")

    # Linear flow for document parsing and requirement extraction
    workflow.add_edge("parse_documents", "extract_requirements")
    workflow.add_edge("extract_requirements", "understand_query")

    # From query understanding to retrieval
    workflow.add_edge("understand_query", "retrieve_context")

    # Conditional edge from retrieval: more retrieval or proceed to analysis
    workflow.add_conditional_edges(
        "retrieve_context",
        needs_more_retrieval,
        {
            "retrieve_more": "retrieve_context",  # Loop back for more retrieval
            "analyze": "analyze_gap",  # Proceed to analysis
        },
    )

    # From analysis to validation
    workflow.add_edge("analyze_gap", "validate_finding")

    # Conditional edge from validation: approve, retry analysis, or retry retrieval
    workflow.add_conditional_edges(
        "validate_finding",
        route_after_validation,
        {
            "aggregate": "aggregate_findings",  # Finding approved or discarded
            "retry_analysis": "analyze_gap",  # Retry analysis with same context
            "retry_retrieval": "retrieve_context",  # Get more context
        },
    )

    # Conditional edge from aggregation: more requirements or complete
    workflow.add_conditional_edges(
        "aggregate_findings",
        has_more_requirements,
        {
            "understand_query": "understand_query",  # Process next requirement
            "complete": END,  # All requirements processed
        },
    )

    # Compile the graph
    compiled_workflow = workflow.compile()

    logger.info("Compliance workflow graph created successfully")

    return compiled_workflow


class ComplianceWorkflowRunner:
    """
    Runner class for executing the compliance workflow.

    This class provides a high-level interface for running the workflow
    with proper initialization, error handling, and state management.
    """

    def __init__(self):
        """Initialize the workflow runner."""
        self.workflow = create_compliance_workflow()
        self.current_state: Optional[WorkflowState] = None

    def run(
        self,
        policy_document,
        benchmark_document,
        session_id: Optional[str] = None,
    ) -> WorkflowState:
        """
        Run the complete compliance analysis workflow.

        Args:
            policy_document: Parsed policy document
            benchmark_document: Parsed benchmark document
            session_id: Optional session identifier for tracking

        Returns:
            Final workflow state with findings
        """
        # Create initial state
        initial_state = create_initial_state()
        initial_state["policy_document"] = policy_document
        initial_state["benchmark_document"] = benchmark_document
        initial_state["session_id"] = session_id or f"session_{datetime.utcnow().timestamp()}"
        initial_state["start_time"] = datetime.utcnow().isoformat()

        logger.info(f"Starting compliance workflow for session {initial_state['session_id']}")

        try:
            # Run the workflow
            final_state = self.workflow.invoke(initial_state)

            # Store final state
            self.current_state = final_state

            logger.info(
                f"Workflow completed successfully. "
                f"Processed {final_state.get('total_requirements', 0)} requirements. "
                f"Found {len(final_state.get('findings', []))} gaps."
            )

            return final_state

        except Exception as e:
            logger.error(f"Workflow execution failed: {str(e)}", exc_info=True)

            # Create error state
            error_state = initial_state.copy()
            error_state["workflow_status"] = "failed"
            error_state["errors"].append(f"Workflow execution failed: {str(e)}")
            error_state["end_time"] = datetime.utcnow().isoformat()

            self.current_state = error_state
            return error_state

    async def run_async(
        self,
        policy_document,
        benchmark_document,
        session_id: Optional[str] = None,
    ) -> WorkflowState:
        """
        Run the workflow asynchronously.

        Args:
            policy_document: Parsed policy document
            benchmark_document: Parsed benchmark document
            session_id: Optional session identifier

        Returns:
            Final workflow state with findings
        """
        # Create initial state
        initial_state = create_initial_state()
        initial_state["policy_document"] = policy_document
        initial_state["benchmark_document"] = benchmark_document
        initial_state["session_id"] = session_id or f"session_{datetime.utcnow().timestamp()}"
        initial_state["start_time"] = datetime.utcnow().isoformat()

        logger.info(f"Starting async compliance workflow for session {initial_state['session_id']}")

        try:
            # Run the workflow asynchronously
            final_state = await self.workflow.ainvoke(initial_state)

            # Store final state
            self.current_state = final_state

            logger.info(
                f"Async workflow completed successfully. "
                f"Processed {final_state.get('total_requirements', 0)} requirements. "
                f"Found {len(final_state.get('findings', []))} gaps."
            )

            return final_state

        except Exception as e:
            logger.error(f"Async workflow execution failed: {str(e)}", exc_info=True)

            # Create error state
            error_state = initial_state.copy()
            error_state["workflow_status"] = "failed"
            error_state["errors"].append(f"Async workflow execution failed: {str(e)}")
            error_state["end_time"] = datetime.utcnow().isoformat()

            self.current_state = error_state
            return error_state

    def get_state(self) -> Optional[WorkflowState]:
        """
        Get the current workflow state.

        Returns:
            Current workflow state or None if not run yet
        """
        return self.current_state

    def get_findings(self):
        """
        Get the findings from the current state.

        Returns:
            List of findings or empty list
        """
        if self.current_state:
            return self.current_state.get("findings", [])
        return []

    def get_logs(self):
        """
        Get the logs from the current state.

        Returns:
            List of log messages or empty list
        """
        if self.current_state:
            return self.current_state.get("logs", [])
        return []

    def get_errors(self):
        """
        Get the errors from the current state.

        Returns:
            List of error messages or empty list
        """
        if self.current_state:
            return self.current_state.get("errors", [])
        return []


# Convenience function for direct workflow execution
def run_compliance_analysis(policy_document, benchmark_document, session_id: Optional[str] = None):
    """
    Convenience function to run compliance analysis.

    Args:
        policy_document: Policy document to analyze
        benchmark_document: Regulatory benchmark
        session_id: Optional session identifier

    Returns:
        Final workflow state with findings
    """
    runner = ComplianceWorkflowRunner()
    return runner.run(policy_document, benchmark_document, session_id)


# Convenience function for async workflow execution
async def run_compliance_analysis_async(
    policy_document, benchmark_document, session_id: Optional[str] = None
):
    """
    Convenience function to run compliance analysis asynchronously.

    Args:
        policy_document: Policy document to analyze
        benchmark_document: Regulatory benchmark
        session_id: Optional session identifier

    Returns:
        Final workflow state with findings
    """
    runner = ComplianceWorkflowRunner()
    return await runner.run_async(policy_document, benchmark_document, session_id)
