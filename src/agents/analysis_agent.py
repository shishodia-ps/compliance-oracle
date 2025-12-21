"""Gap analysis agent with reasoning chains."""

from typing import Dict, Any, List
import json

from .base import BaseAgent
from ..models.requirements import Requirement
from ..models.findings import (
    Finding, ReasoningStep, PolicySection, GapDetails,
    ComplianceStatus, Severity, RetrievalResult
)


class AnalysisAgent(BaseAgent):
    """
    Analysis Agent for Compliance Gap Detection.

    Performs deep reasoning-based analysis to determine:
    - COMPLIANT: Policy fully meets requirement
    - PARTIAL_GAP: Policy addresses but incompletely
    - GAP: Policy doesn't address requirement
    - CONTRADICTION: Policy conflicts with requirement
    - UNCERTAIN: Cannot determine from available info

    Uses chain-of-thought reasoning to avoid false positives.
    """

    def __init__(self, llm_client, max_iterations: int = 2):
        """
        Initialize Analysis Agent.

        Args:
            llm_client: LLM client for reasoning
            max_iterations: Max analysis iterations
        """
        super().__init__(
            llm_client=llm_client,
            max_iterations=max_iterations,
            agent_name="AnalysisAgent"
        )

    def _think(self, context: Dict[str, Any]) -> str:
        """Plan the analysis approach."""
        requirement: Requirement = context["requirement"]
        retrieval_result: RetrievalResult = context["retrieval_result"]

        if self.current_step == 1:
            return f"""Analyzing compliance for: {requirement.citation}

Retrieved {len(retrieval_result.sections_found)} policy sections.
Coverage assessment: {retrieval_result.coverage_assessment}

Analysis approach:
1. Understand what the requirement mandates
2. Analyze what each policy section says
3. Compare requirement elements to policy coverage
4. Determine compliance status with reasoning
5. Identify specific gaps if any"""

        else:
            return "Refining analysis and generating actionable recommendation."

    def _act(self, thought: str, context: Dict[str, Any]) -> Any:
        """Perform compliance analysis."""
        requirement: Requirement = context["requirement"]
        retrieval_result: RetrievalResult = context["retrieval_result"]

        if self.current_step == 1:
            # Initial analysis
            return self._analyze_compliance(requirement, retrieval_result)
        else:
            # Refine and add recommendation
            draft_finding: Finding = context.get("draft_finding")
            return self._add_recommendation(draft_finding, requirement)

    def _observe(self, action_result: Any, context: Dict[str, Any]) -> str:
        """Process analysis result."""
        if self.current_step == 1:
            finding: Finding = action_result
            context["draft_finding"] = finding
            return f"Analysis complete: {finding.status.value} (confidence: {finding.confidence:.2f})"
        else:
            finding: Finding = action_result
            context["result"] = finding
            return f"Final finding ready with {len(finding.reasoning_chain)} reasoning steps"

    def _should_continue(self, context: Dict[str, Any]) -> bool:
        """Continue for recommendation generation."""
        return self.current_step < 2

    def _analyze_compliance(
        self,
        requirement: Requirement,
        retrieval_result: RetrievalResult
    ) -> Finding:
        """Perform detailed compliance analysis with reasoning."""
        sections = retrieval_result.sections_found

        # Build policy context
        policy_context = self._build_policy_context(sections)

        # Generate analysis prompt
        prompt = f"""You are a compliance analysis expert. Analyze if the policy meets the regulatory requirement.

REQUIREMENT:
Citation: {requirement.citation}
Type: {requirement.type.value}
Category: {requirement.category.value}
Text: {requirement.text}

POLICY SECTIONS FOUND:
{policy_context}

ANALYSIS TASK:
Determine compliance status through step-by-step reasoning:

1. REQUIREMENT UNDERSTANDING
   - What exactly is required?
   - What would compliance look like?
   - What are the key elements?

2. POLICY ANALYSIS
   - What does the policy say?
   - Does it address the requirement?
   - How completely?

3. COMPARISON & REASONING
   - Map requirement elements to policy coverage
   - Identify gaps or contradictions
   - Consider semantic equivalence
   - Account for "broader than required" scenarios

4. DETERMINATION
   - Status: COMPLIANT, PARTIAL_GAP, GAP, CONTRADICTION, or UNCERTAIN
   - Confidence: 0.0 to 1.0
   - Reasoning: Clear explanation

Return ONLY valid JSON:
{{
    "status": "COMPLIANT|PARTIAL_GAP|GAP|CONTRADICTION|UNCERTAIN",
    "confidence": 0.85,
    "reasoning_steps": [
        {{
            "step": 1,
            "observation": "What you observed",
            "analysis": "Your analysis of the observation"
        }}
    ],
    "gap_details": {{
        "what_is_missing": "Specific element missing",
        "policy_has": "What policy covers",
        "policy_lacks": "What policy lacks"
    }},
    "severity": "CRITICAL|HIGH|MEDIUM|LOW"
}}

If COMPLIANT, set gap_details to null.
Be rigorous - avoid false positives. Consider semantic equivalence."""

        try:
            response = self.llm_client.generate(
                prompt=prompt,
                temperature=0.2,
                max_tokens=2000
            )

            # Parse response
            content = response.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            data = json.loads(content)

            # Build Finding
            finding = Finding(
                requirement_id=requirement.requirement_id,
                requirement_citation=requirement.citation,
                requirement_text=requirement.text,
                status=ComplianceStatus(data["status"].lower()),
                confidence=float(data["confidence"]),
                reasoning_chain=[
                    ReasoningStep(
                        step=step["step"],
                        observation=step["observation"],
                        analysis=step["analysis"]
                    )
                    for step in data.get("reasoning_steps", [])
                ],
                sections_found=sections,
                severity=Severity(data["severity"].lower()) if data.get("severity") else None
            )

            # Add gap details if present
            if data.get("gap_details") and finding.is_gap():
                finding.gap_details = GapDetails(
                    what_is_missing=data["gap_details"].get("what_is_missing", ""),
                    policy_has=data["gap_details"].get("policy_has"),
                    policy_lacks=data["gap_details"].get("policy_lacks")
                )

            return finding

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            self.logger.error("Failed to parse analysis response", error=str(e))
            # Fallback: uncertain status
            return Finding(
                requirement_id=requirement.requirement_id,
                requirement_citation=requirement.citation,
                requirement_text=requirement.text,
                status=ComplianceStatus.UNCERTAIN,
                confidence=0.3,
                reasoning_chain=[
                    ReasoningStep(
                        step=1,
                        observation="Analysis failed due to parsing error",
                        analysis=f"Error: {str(e)}"
                    )
                ],
                sections_found=sections
            )

    def _add_recommendation(self, finding: Finding, requirement: Requirement) -> Finding:
        """Generate actionable recommendation for gaps."""
        if not finding.is_gap():
            # No recommendation needed for compliant findings
            finding.recommendation = None
            return finding

        # Generate recommendation
        prompt = f"""Generate a specific, actionable recommendation to fix this compliance gap.

REQUIREMENT:
{requirement.citation}: {requirement.text}

GAP IDENTIFIED:
{finding.gap_details.what_is_missing if finding.gap_details else "Policy does not address requirement"}

POLICY CURRENTLY HAS:
{finding.gap_details.policy_has if finding.gap_details else "No relevant coverage"}

Generate a recommendation that:
1. Is specific and actionable
2. Tells exactly what to add/change
3. Suggests where in the policy to add it
4. Uses appropriate regulatory language

Return only the recommendation text (not JSON)."""

        try:
            response = self.llm_client.generate(
                prompt=prompt,
                temperature=0.3,
                max_tokens=500
            )

            finding.recommendation = response.content.strip()

        except Exception as e:
            self.logger.error("Failed to generate recommendation", error=str(e))
            finding.recommendation = f"Add policy section addressing: {requirement.text}"

        return finding

    def _build_policy_context(self, sections: List[PolicySection]) -> str:
        """Build formatted policy context for LLM."""
        if not sections:
            return "NO RELEVANT POLICY SECTIONS FOUND"

        context_parts = []
        for i, section in enumerate(sections[:10], 1):  # Top 10 sections
            context_parts.append(
                f"Section {section.section_id} (relevance: {section.relevance_score:.2f}):\n"
                f"Title: {section.title}\n"
                f"Content: {section.content[:500]}...\n"
                f"Page: {section.page}\n"
            )

        return "\n---\n".join(context_parts)

    def analyze(
        self,
        requirement: Requirement,
        retrieval_result: RetrievalResult
    ) -> Finding:
        """
        Main entry point: Analyze compliance and generate finding.

        Args:
            requirement: Regulatory requirement
            retrieval_result: Retrieval result with found sections

        Returns:
            Finding with compliance determination
        """
        context = {
            "requirement": requirement,
            "retrieval_result": retrieval_result
        }

        result = self.run(context)

        if result.success:
            return result.result
        else:
            # Return uncertain finding on failure
            return Finding(
                requirement_id=requirement.requirement_id,
                requirement_citation=requirement.citation,
                requirement_text=requirement.text,
                status=ComplianceStatus.UNCERTAIN,
                confidence=0.0,
                reasoning_chain=[
                    ReasoningStep(
                        step=1,
                        observation="Analysis failed",
                        analysis=result.error or "Unknown error"
                    )
                ],
                sections_found=retrieval_result.sections_found
            )
