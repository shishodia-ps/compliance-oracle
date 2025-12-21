"""
Workflow module for compliance analysis using LangGraph.

This module provides the complete LangGraph workflow that orchestrates
the compliance analysis process through multiple agents with iterative
loops and self-correction mechanisms.

Main components:
- WorkflowState: TypedDict defining the state passed through the workflow
- Node functions: Individual steps in the workflow
- Condition functions: Edge conditions for routing
- ComplianceWorkflowRunner: High-level interface for running the workflow
"""

from src.workflow.state import (
    WorkflowState,
    create_initial_state,
    add_log,
    add_error,
)
from src.workflow.graph import (
    create_compliance_workflow,
    ComplianceWorkflowRunner,
    run_compliance_analysis,
    run_compliance_analysis_async,
)

__all__ = [
    # State
    "WorkflowState",
    "create_initial_state",
    "add_log",
    "add_error",
    # Graph
    "create_compliance_workflow",
    "ComplianceWorkflowRunner",
    "run_compliance_analysis",
    "run_compliance_analysis_async",
]
