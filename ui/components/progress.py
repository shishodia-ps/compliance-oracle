"""
Progress Display Component
==========================

Analysis progress display with:
- Overall progress bar with percentage
- Current stage indicator (parsing → extracting → analyzing → validating)
- Live log display (scrollable)
- Preliminary findings count by severity
- Cancel button
- Elapsed time and estimated remaining
"""

import streamlit as st
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import time


# Analysis stages
ANALYSIS_STAGES = [
    {"name": "Parsing", "icon": "📄", "description": "Parsing documents..."},
    {"name": "Extracting", "icon": "🔍", "description": "Extracting requirements..."},
    {"name": "Analyzing", "icon": "🤖", "description": "Analyzing compliance gaps..."},
    {"name": "Validating", "icon": "✅", "description": "Validating findings..."},
]


def render_progress_display(workflow_state: Dict) -> bool:
    """
    Render analysis progress display.

    Args:
        workflow_state: Current workflow state

    Returns:
        bool: True if user wants to cancel, False otherwise
    """
    st.markdown("## 🔄 Analysis in Progress")

    # Overall progress bar
    _render_progress_bar(workflow_state)

    # Stage indicators
    _render_stage_indicators(workflow_state)

    # Stats row
    col1, col2, col3 = st.columns(3)

    with col1:
        _render_elapsed_time(workflow_state)

    with col2:
        _render_estimated_remaining(workflow_state)

    with col3:
        _render_preliminary_findings(workflow_state)

    # Live log display
    _render_live_log(workflow_state)

    # Cancel button
    cancel_clicked = st.button(
        "🛑 Cancel Analysis",
        key="cancel_analysis",
        help="Stop the analysis process"
    )

    if cancel_clicked:
        if st.session_state.get("confirm_cancel"):
            return True
        else:
            st.warning("⚠️ Click again to confirm cancellation")
            st.session_state.confirm_cancel = True
            time.sleep(1)  # Brief delay to show warning
            return False

    return False


def _render_progress_bar(workflow_state: Dict):
    """
    Render overall progress bar.

    Args:
        workflow_state: Current workflow state
    """
    # Calculate overall progress
    total_requirements = workflow_state.get("total_requirements", 0)
    processed_requirements = workflow_state.get("processed_requirements", 0)

    if total_requirements > 0:
        progress = int((processed_requirements / total_requirements) * 100)
    else:
        # Use stage-based progress if requirements not yet counted
        current_stage_index = workflow_state.get("current_stage_index", 0)
        progress = int((current_stage_index / len(ANALYSIS_STAGES)) * 100)

    # Progress bar HTML
    st.markdown(f"""
    <div class="progress-container">
        <div class="progress-bar">
            <div class="progress-bar-fill" style="width: {progress}%;">
                {progress}%
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Show detailed progress text
    current_stage = workflow_state.get("current_stage", "Initializing")
    current_task = workflow_state.get("current_task", "")

    st.markdown(f"""
    <div style="text-align: center; margin-top: 1rem; color: #4B4B59;">
        <strong>{current_stage}</strong>
        {f"<br><span style='font-size: 0.9rem;'>{current_task}</span>" if current_task else ""}
    </div>
    """, unsafe_allow_html=True)


def _render_stage_indicators(workflow_state: Dict):
    """
    Render stage indicators showing progress through workflow.

    Args:
        workflow_state: Current workflow state
    """
    current_stage_index = workflow_state.get("current_stage_index", 0)

    st.markdown("""
    <div class="stage-indicator">
    """, unsafe_allow_html=True)

    cols = st.columns(len(ANALYSIS_STAGES))

    for i, stage in enumerate(ANALYSIS_STAGES):
        with cols[i]:
            # Determine stage status
            if i < current_stage_index:
                status_class = "stage-complete"
                status_icon = "✓"
            elif i == current_stage_index:
                status_class = "stage-active pulse"
                status_icon = stage["icon"]
            else:
                status_class = "stage-pending"
                status_icon = stage["icon"]

            st.markdown(f"""
            <div class="stage {status_class}">
                <div class="stage-icon">{status_icon}</div>
                <div style="font-size: 0.85rem;">{stage['name']}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)


def _render_elapsed_time(workflow_state: Dict):
    """
    Render elapsed time since analysis started.

    Args:
        workflow_state: Current workflow state
    """
    start_time = workflow_state.get("start_time")

    if start_time:
        elapsed = datetime.now() - start_time
        elapsed_str = str(timedelta(seconds=int(elapsed.total_seconds())))
    else:
        elapsed_str = "00:00:00"

    st.markdown(f"""
    <div class="summary-card">
        <p>⏱️ Elapsed Time</p>
        <h3>{elapsed_str}</h3>
    </div>
    """, unsafe_allow_html=True)


def _render_estimated_remaining(workflow_state: Dict):
    """
    Render estimated remaining time.

    Args:
        workflow_state: Current workflow state
    """
    # Calculate estimate based on progress
    total_requirements = workflow_state.get("total_requirements", 0)
    processed_requirements = workflow_state.get("processed_requirements", 0)
    start_time = workflow_state.get("start_time")

    if start_time and processed_requirements > 0 and total_requirements > 0:
        elapsed = (datetime.now() - start_time).total_seconds()
        avg_time_per_req = elapsed / processed_requirements
        remaining_reqs = total_requirements - processed_requirements
        estimated_remaining = timedelta(seconds=int(avg_time_per_req * remaining_reqs))
        remaining_str = str(estimated_remaining)
    else:
        remaining_str = "Calculating..."

    st.markdown(f"""
    <div class="summary-card">
        <p>⏳ Estimated Remaining</p>
        <h3>{remaining_str}</h3>
    </div>
    """, unsafe_allow_html=True)


def _render_preliminary_findings(workflow_state: Dict):
    """
    Render preliminary findings count.

    Args:
        workflow_state: Current workflow state
    """
    findings = workflow_state.get("preliminary_findings", [])
    findings_count = len(findings)

    # Count by severity
    severity_counts = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0
    }

    for finding in findings:
        severity = finding.get("severity", "medium").lower()
        if severity in severity_counts:
            severity_counts[severity] += 1

    st.markdown(f"""
    <div class="summary-card">
        <p>🔍 Preliminary Findings</p>
        <h3>{findings_count}</h3>
        <div style="font-size: 0.8rem; margin-top: 0.5rem; color: #6c757d;">
            <span style="color: #DC3545;">●</span> {severity_counts['critical']} Critical
            <span style="color: #FD7E14; margin-left: 0.5rem;">●</span> {severity_counts['high']} High
            <span style="color: #FFC107; margin-left: 0.5rem;">●</span> {severity_counts['medium']} Medium
            <span style="color: #28A745; margin-left: 0.5rem;">●</span> {severity_counts['low']} Low
        </div>
    </div>
    """, unsafe_allow_html=True)


def _render_live_log(workflow_state: Dict):
    """
    Render live log display.

    Args:
        workflow_state: Current workflow state
    """
    st.markdown("### 📋 Activity Log")

    # Get log entries
    log_entries = workflow_state.get("log_entries", [])

    if not log_entries:
        st.info("Waiting for activity...")
        return

    # Build log HTML
    log_html = '<div class="log-container">'

    # Show last 20 entries
    for entry in log_entries[-20:]:
        timestamp = entry.get("timestamp", "")
        level = entry.get("level", "info")
        message = entry.get("message", "")

        log_html += f"""
        <div class="log-entry">
            <span class="log-timestamp">{timestamp}</span>
            <span class="log-level-{level}">[{level.upper()}]</span>
            <span>{message}</span>
        </div>
        """

    log_html += '</div>'

    st.markdown(log_html, unsafe_allow_html=True)

    # Auto-scroll to bottom (using JavaScript would be better, but not available in Streamlit)
    # User will need to scroll manually or we can refresh the component


def create_workflow_state() -> Dict:
    """
    Create initial workflow state.

    Returns:
        Dict: Initial workflow state
    """
    return {
        "start_time": datetime.now(),
        "current_stage": "Initializing",
        "current_stage_index": 0,
        "current_task": "",
        "total_requirements": 0,
        "processed_requirements": 0,
        "preliminary_findings": [],
        "log_entries": [],
        "status": "running"
    }


def update_workflow_state(
    state: Dict,
    stage: Optional[str] = None,
    stage_index: Optional[int] = None,
    task: Optional[str] = None,
    total_requirements: Optional[int] = None,
    processed_requirements: Optional[int] = None,
    new_finding: Optional[Dict] = None,
    log_message: Optional[str] = None,
    log_level: str = "info"
) -> Dict:
    """
    Update workflow state.

    Args:
        state: Current workflow state
        stage: New current stage name
        stage_index: New current stage index
        task: New current task description
        total_requirements: Total number of requirements
        processed_requirements: Number of processed requirements
        new_finding: New finding to add to preliminary findings
        log_message: Log message to add
        log_level: Log level (info, warning, error, success)

    Returns:
        Dict: Updated workflow state
    """
    if stage is not None:
        state["current_stage"] = stage

    if stage_index is not None:
        state["current_stage_index"] = stage_index

    if task is not None:
        state["current_task"] = task

    if total_requirements is not None:
        state["total_requirements"] = total_requirements

    if processed_requirements is not None:
        state["processed_requirements"] = processed_requirements

    if new_finding is not None:
        state["preliminary_findings"].append(new_finding)

    if log_message is not None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        state["log_entries"].append({
            "timestamp": timestamp,
            "level": log_level,
            "message": log_message
        })

    return state


def render_progress_placeholder() -> st.delta_generator.DeltaGenerator:
    """
    Create a placeholder for progress updates.

    Returns:
        Streamlit placeholder object
    """
    return st.empty()


def update_progress_display(
    placeholder: st.delta_generator.DeltaGenerator,
    workflow_state: Dict
):
    """
    Update progress display in placeholder.

    Args:
        placeholder: Streamlit placeholder object
        workflow_state: Current workflow state
    """
    with placeholder.container():
        render_progress_display(workflow_state)
