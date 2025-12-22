"""
Workflow node functions for LangGraph.

This module defines the node functions that perform each step in the
compliance analysis workflow. Each node function receives the workflow
state, performs its operation, and returns the updated state.
"""

from typing import Dict, Any
import logging
from datetime import datetime

from .state import (
    WorkflowState,
    add_log,
    add_error,
    reset_retrieval_iteration,
    reset_validation_iteration,
    increment_retrieval_iteration,
    increment_validation_iteration,
    move_to_next_requirement,
)
from ..parsers.pdf import PDFParser
from ..parsers.docx import DOCXParser
from ..parsers.structure import StructureExtractor
from ..agents.requirement_extractor import RequirementExtractorAgent
from ..agents.query_agent import QueryAgent
from ..agents.retrieval_agent import RetrievalAgent
from ..agents.analysis_agent import AnalysisAgent
from ..agents.validation_agent import ValidationAgent
from ..models.documents import Document

logger = logging.getLogger(__name__)


def parse_documents(state: WorkflowState) -> WorkflowState:
    """
    Parse uploaded policy and benchmark documents.

    This node:
    1. Detects document format
    2. Extracts text and structure
    3. Creates structured Document objects
    4. Updates state with parsed documents

    Args:
        state: Current workflow state

    Returns:
        Updated workflow state with parsed documents
    """
    add_log(state, "Starting document parsing...")

    try:
        # Parse policy document
        if state.get("policy_document"):
            policy_doc = state["policy_document"]
            add_log(state, f"Parsing policy document: {policy_doc.metadata.get('filename', 'unknown')}")

            # Select parser based on file type
            parser = _get_parser_for_document(policy_doc)
            parsed_policy = parser.parse(policy_doc.raw_content)

            # Extract structure
            extractor = StructureExtractor()
            structured_policy = extractor.extract_structure(parsed_policy)

            state["policy_document"] = structured_policy
            add_log(state, f"Policy document parsed: {len(structured_policy.sections)} sections found")

        # Parse benchmark document
        if state.get("benchmark_document"):
            benchmark_doc = state["benchmark_document"]
            add_log(state, f"Parsing benchmark document: {benchmark_doc.metadata.get('filename', 'unknown')}")

            parser = _get_parser_for_document(benchmark_doc)
            parsed_benchmark = parser.parse(benchmark_doc.raw_content)

            extractor = StructureExtractor()
            structured_benchmark = extractor.extract_structure(parsed_benchmark)

            state["benchmark_document"] = structured_benchmark
            add_log(state, f"Benchmark document parsed: {len(structured_benchmark.sections)} sections found")

        add_log(state, "Document parsing completed successfully")

    except Exception as e:
        error_msg = f"Error parsing documents: {str(e)}"
        add_error(state, error_msg)
        logger.error(error_msg, exc_info=True)
        state["workflow_status"] = "failed"

    return state


def extract_requirements(state: WorkflowState) -> WorkflowState:
    """
    Extract requirements from the benchmark document using RequirementExtractor agent.

    This node:
    1. Analyzes benchmark structure
    2. Identifies requirement statements
    3. Categorizes and enriches requirements
    4. Updates state with requirement list

    Args:
        state: Current workflow state

    Returns:
        Updated workflow state with extracted requirements
    """
    add_log(state, "Starting requirement extraction...")

    try:
        benchmark_doc = state.get("benchmark_document")
        if not benchmark_doc:
            raise ValueError("No benchmark document found in state")

        # Initialize requirement extractor agent
        extractor = RequirementExtractorAgent()

        # Extract requirements
        add_log(state, "Analyzing benchmark document for requirements...")
        requirements = extractor.extract_requirements(benchmark_doc)

        state["requirements"] = requirements
        state["total_requirements"] = len(requirements)

        add_log(state, f"Extracted {len(requirements)} requirements from benchmark")

        # Initialize for first requirement
        if requirements:
            state["current_requirement"] = requirements[0]
            state["current_requirement_index"] = 0
            reset_retrieval_iteration(state)
            reset_validation_iteration(state)
            add_log(state, f"Starting analysis with first requirement: {requirements[0].requirement_id}")

    except Exception as e:
        error_msg = f"Error extracting requirements: {str(e)}"
        add_error(state, error_msg)
        logger.error(error_msg, exc_info=True)
        state["workflow_status"] = "failed"

    return state


def understand_query(state: WorkflowState) -> WorkflowState:
    """
    Use QueryAgent to understand the current requirement and generate search queries.

    This node:
    1. Analyzes the requirement text
    2. Extracts core concepts
    3. Generates synonym expansions
    4. Creates multiple query variants

    Args:
        state: Current workflow state

    Returns:
        Updated workflow state with search queries
    """
    add_log(state, "Understanding requirement and generating queries...")

    try:
        current_req = state.get("current_requirement")
        if not current_req:
            raise ValueError("No current requirement in state")

        add_log(state, f"Analyzing requirement: {current_req.requirement_id}")

        # Initialize query agent
        query_agent = QueryAgent()

        # Generate search strategy
        search_strategy = query_agent.understand_requirement(current_req)

        state["search_queries"] = search_strategy
        add_log(
            state,
            f"Generated {len(search_strategy.get('primary_queries', []))} primary queries, "
            f"{len(search_strategy.get('secondary_queries', []))} secondary queries",
        )

    except Exception as e:
        error_msg = f"Error in query understanding: {str(e)}"
        add_error(state, error_msg)
        logger.error(error_msg, exc_info=True)

    return state


def retrieve_context(state: WorkflowState) -> WorkflowState:
    """
    Use RetrievalAgent to search for relevant policy sections.

    This node:
    1. Executes search queries against policy vector store
    2. Evaluates retrieval quality
    3. Decides if more retrieval is needed
    4. Updates state with retrieved sections

    Args:
        state: Current workflow state

    Returns:
        Updated workflow state with retrieval results
    """
    iteration = state.get("retrieval_iteration", 0)
    add_log(state, f"Retrieving context (iteration {iteration + 1})...")

    try:
        policy_doc = state.get("policy_document")
        search_queries = state.get("search_queries", {})
        current_req = state.get("current_requirement")

        if not policy_doc or not search_queries or not current_req:
            raise ValueError("Missing required data for retrieval")

        # Initialize retrieval agent
        retrieval_agent = RetrievalAgent()

        # Execute retrieval
        retrieval_result = retrieval_agent.retrieve(
            requirement=current_req,
            search_queries=search_queries,
            policy_document=policy_doc,
            previous_results=state.get("retrieval_results", []),
            iteration=iteration,
        )

        # Update state
        state["retrieval_results"] = retrieval_result["sections"]
        state["retrieval_confidence"] = retrieval_result.get("confidence", 0.0)

        increment_retrieval_iteration(state)

        add_log(
            state,
            f"Retrieved {len(retrieval_result['sections'])} sections, "
            f"confidence: {retrieval_result.get('confidence', 0.0):.2f}",
        )

    except Exception as e:
        error_msg = f"Error in retrieval: {str(e)}"
        add_error(state, error_msg)
        logger.error(error_msg, exc_info=True)

    return state


def analyze_gap(state: WorkflowState) -> WorkflowState:
    """
    Use AnalysisAgent to determine compliance status.

    This node:
    1. Compares requirement to retrieved policy sections
    2. Performs reasoning-based analysis
    3. Determines compliance status
    4. Generates finding if gap exists

    Args:
        state: Current workflow state

    Returns:
        Updated workflow state with analysis results
    """
    add_log(state, "Analyzing compliance gap...")

    try:
        current_req = state.get("current_requirement")
        retrieval_results = state.get("retrieval_results", [])

        if not current_req:
            raise ValueError("No current requirement in state")

        # Initialize analysis agent
        analysis_agent = AnalysisAgent()

        # Perform analysis
        add_log(state, f"Comparing requirement {current_req.requirement_id} to policy sections...")
        finding = analysis_agent.analyze(
            requirement=current_req, retrieved_sections=retrieval_results
        )

        state["current_finding"] = finding
        state["analysis_reasoning"] = finding.reasoning_chain if finding else []

        if finding and finding.status != "compliant":
            add_log(state, f"Gap identified: {finding.gap_type}")
        else:
            add_log(state, "Requirement appears to be compliant")

    except Exception as e:
        error_msg = f"Error in analysis: {str(e)}"
        add_error(state, error_msg)
        logger.error(error_msg, exc_info=True)

    return state


def validate_finding(state: WorkflowState) -> WorkflowState:
    """
    Use ValidationAgent to verify the finding accuracy.

    This node:
    1. Verifies citations
    2. Checks reasoning logic
    3. Detects hallucinations
    4. Approves or rejects finding

    Args:
        state: Current workflow state

    Returns:
        Updated workflow state with validation results
    """
    iteration = state.get("validation_iteration", 0)
    add_log(state, f"Validating finding (iteration {iteration + 1})...")

    try:
        current_finding = state.get("current_finding")
        policy_doc = state.get("policy_document")
        benchmark_doc = state.get("benchmark_document")

        if not current_finding:
            # If no finding (compliant), validation passes automatically
            state["validation_status"] = "approved"
            add_log(state, "No gap found - validation passed")
            return state

        # Initialize validation agent
        validation_agent = ValidationAgent()

        # Validate the finding
        validation_result = validation_agent.validate(
            finding=current_finding, policy_document=policy_doc, benchmark_document=benchmark_doc
        )

        state["validation_status"] = validation_result["status"]
        state["validation_feedback"] = validation_result.get("feedback", "")

        increment_validation_iteration(state)

        add_log(state, f"Validation result: {validation_result['status']}")
        if validation_result.get("feedback"):
            add_log(state, f"Feedback: {validation_result['feedback']}")

    except Exception as e:
        error_msg = f"Error in validation: {str(e)}"
        add_error(state, error_msg)
        logger.error(error_msg, exc_info=True)
        # Default to retry on error
        state["validation_status"] = "retry"

    return state


def aggregate_findings(state: WorkflowState) -> WorkflowState:
    """
    Aggregate all validated findings into final results.

    This node:
    1. Collects all approved findings
    2. Sorts by severity
    3. Prepares final report data
    4. Marks workflow as completed

    Args:
        state: Current workflow state

    Returns:
        Updated workflow state with aggregated findings
    """
    add_log(state, "Aggregating all findings...")

    try:
        current_finding = state.get("current_finding")
        validation_status = state.get("validation_status")

        # Add approved finding to results
        if current_finding and validation_status == "approved":
            if "findings" not in state:
                state["findings"] = []

            state["findings"].append(current_finding)
            add_log(state, f"Added finding for requirement {current_finding.requirement_id}")

        # Move to next requirement
        move_to_next_requirement(state)

        # Check if we're done
        if state.get("all_requirements_processed"):
            state["workflow_status"] = "completed"
            state["end_time"] = datetime.utcnow().isoformat()

            findings_count = len(state.get("findings", []))
            add_log(state, f"Workflow completed. Total findings: {findings_count}")
        else:
            next_req = state.get("current_requirement")
            if next_req:
                add_log(state, f"Moving to next requirement: {next_req.requirement_id}")

    except Exception as e:
        error_msg = f"Error aggregating findings: {str(e)}"
        add_error(state, error_msg)
        logger.error(error_msg, exc_info=True)

    return state


def _get_parser_for_document(document: Document):
    """
    Get the appropriate parser based on document type.

    Args:
        document: Document to parse

    Returns:
        Parser instance
    """
    file_type = document.metadata.get("file_type", "").lower()

    if file_type == "pdf":
        return PDFParser()
    elif file_type in ["docx", "doc"]:
        return DOCXParser()
    else:
        # Default to PDF parser
        return PDFParser()
