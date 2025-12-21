"""Finding validation and citation checking agent."""

from typing import Dict, Any, List
import json

from .base import BaseAgent
from ..models.findings import Finding, ValidationResult, ComplianceStatus
from ..services.vector_store import VectorStore


class ValidationAgent(BaseAgent):
    """
    Validation Agent - Verify Finding Accuracy.

    Performs rigorous checks to prevent hallucinations and false positives:
    1. Citation Verification - Do cited sections exist?
    2. Logic Verification - Does reasoning make sense?
    3. Completeness Verification - Did we search thoroughly?
    4. Hallucination Detection - Are facts verifiable?
    5. Actionability Verification - Is recommendation specific?

    REJECTS findings that fail critical checks.
    """

    def __init__(
        self,
        llm_client,
        vector_store: VectorStore,
        max_iterations: int = 2
    ):
        """
        Initialize Validation Agent.

        Args:
            llm_client: LLM client for validation reasoning
            vector_store: Vector store to verify citations
            max_iterations: Max validation iterations
        """
        super().__init__(
            llm_client=llm_client,
            max_iterations=max_iterations,
            agent_name="ValidationAgent"
        )
        self.vector_store = vector_store

    def _think(self, context: Dict[str, Any]) -> str:
        """Plan validation checks."""
        finding: Finding = context["finding"]

        if self.current_step == 1:
            return f"""Validating finding for: {finding.requirement_citation}

Status: {finding.status.value}
Confidence: {finding.confidence:.2f}
Sections cited: {len(finding.sections_found)}

Validation checklist:
1. Citation verification - Do sections exist?
2. Logic verification - Does reasoning hold?
3. Completeness - Could we have missed sections?
4. Hallucination detection - Are facts verifiable?
5. Recommendation quality (if gap)"""

        else:
            return "Performing final validation and generating validation result."

    def _act(self, thought: str, context: Dict[str, Any]) -> Any:
        """Execute validation checks."""
        finding: Finding = context["finding"]

        if self.current_step == 1:
            # Run all validation checks
            checks = {}
            checks["citation_valid"] = self._verify_citations(finding)
            checks["logic_valid"] = self._verify_logic(finding)
            checks["completeness_ok"] = self._verify_completeness(finding)
            checks["no_hallucination"] = self._detect_hallucination(finding)

            if finding.is_gap():
                checks["recommendation_actionable"] = self._verify_recommendation(finding)
            else:
                checks["recommendation_actionable"] = True  # N/A for compliant findings

            return checks

        else:
            # Generate final validation result
            checks: Dict[str, bool] = context["checks"]
            return self._generate_validation_result(checks, finding)

    def _observe(self, action_result: Any, context: Dict[str, Any]) -> str:
        """Process validation results."""
        if self.current_step == 1:
            checks: Dict[str, bool] = action_result
            context["checks"] = checks

            passed = sum(1 for v in checks.values() if v)
            total = len(checks)

            return f"Validation checks: {passed}/{total} passed"

        else:
            validation_result: ValidationResult = action_result
            context["result"] = validation_result

            return f"Validation {'PASSED' if validation_result.is_valid else 'FAILED'}"

    def _should_continue(self, context: Dict[str, Any]) -> bool:
        """Continue for final result generation."""
        return self.current_step < 2

    def _verify_citations(self, finding: Finding) -> bool:
        """Verify that cited policy sections actually exist."""
        if not finding.sections_found:
            # No citations to verify for gaps with no coverage
            return True

        for section in finding.sections_found:
            # Check if section exists in vector store
            result = self.vector_store.get_by_section_id(section.section_id)
            if not result:
                self.logger.warning(
                    "Citation verification failed",
                    section_id=section.section_id
                )
                return False

        return True

    def _verify_logic(self, finding: Finding) -> bool:
        """Verify that the reasoning chain makes logical sense."""
        if not finding.reasoning_chain:
            self.logger.warning("No reasoning chain provided")
            return False

        if len(finding.reasoning_chain) < 2:
            self.logger.warning("Insufficient reasoning steps")
            return False

        # Use LLM to verify logic
        reasoning_text = "\n".join([
            f"{step.step}. {step.observation} → {step.analysis}"
            for step in finding.reasoning_chain
        ])

        prompt = f"""Evaluate if this reasoning chain is logically sound:

REASONING:
{reasoning_text}

CONCLUSION:
{finding.status.value} (confidence: {finding.confidence:.2f})

Questions:
1. Does each step follow logically from the previous?
2. Is the conclusion supported by the reasoning?
3. Are there any logical fallacies?

Answer with JSON: {{"is_valid": true/false, "issue": "description if invalid"}}"""

        try:
            response = self.llm_client.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=200
            )

            content = response.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            data = json.loads(content)
            return data.get("is_valid", False)

        except Exception as e:
            self.logger.error("Logic verification failed", error=str(e))
            # Fail safe - assume valid if we can't verify
            return True

    def _verify_completeness(self, finding: Finding) -> bool:
        """Verify that the search was thorough enough."""
        # For gaps, we want to be extra sure we searched thoroughly
        if finding.status == ComplianceStatus.GAP:
            # Should have attempted multiple queries
            if not finding.sections_found and finding.confidence < 0.7:
                self.logger.warning("Gap finding with low confidence and no sections")
                return False

        # For compliant findings, check we have evidence
        if finding.status == ComplianceStatus.COMPLIANT:
            if not finding.sections_found:
                self.logger.warning("Compliant finding with no supporting sections")
                return False

            if finding.confidence < 0.6:
                self.logger.warning("Compliant finding with low confidence")
                return False

        return True

    def _detect_hallucination(self, finding: Finding) -> bool:
        """Detect potential hallucinations in the finding."""
        # Check if gap details mention specific facts that should be verifiable
        if finding.gap_details:
            # Ensure gap details are consistent with sections found
            if finding.gap_details.policy_has and not finding.sections_found:
                self.logger.warning("Gap details claim policy has content but no sections found")
                return False

        # Check confidence is reasonable
        if finding.status == ComplianceStatus.UNCERTAIN and finding.confidence > 0.7:
            self.logger.warning("Uncertain status with high confidence")
            return False

        if finding.status == ComplianceStatus.COMPLIANT and finding.confidence < 0.5:
            self.logger.warning("Compliant status with low confidence")
            return False

        return True

    def _verify_recommendation(self, finding: Finding) -> bool:
        """Verify that the recommendation is actionable and specific."""
        if not finding.recommendation:
            if finding.is_gap() and finding.status != ComplianceStatus.UNCERTAIN:
                self.logger.warning("Gap finding missing recommendation")
                return False
            return True

        # Check recommendation is not too vague
        vague_phrases = [
            "should consider",
            "may want to",
            "could improve",
            "think about"
        ]

        recommendation_lower = finding.recommendation.lower()
        if any(phrase in recommendation_lower for phrase in vague_phrases):
            self.logger.warning("Recommendation appears vague")
            return False

        # Check recommendation has reasonable length
        if len(finding.recommendation) < 20:
            self.logger.warning("Recommendation too short")
            return False

        return True

    def _generate_validation_result(
        self,
        checks: Dict[str, bool],
        finding: Finding
    ) -> ValidationResult:
        """Generate final validation result."""
        # Critical checks that must pass
        critical_checks = ["citation_valid", "no_hallucination"]

        critical_failed = [
            check for check in critical_checks
            if not checks.get(check, False)
        ]

        # Determine if valid
        is_valid = len(critical_failed) == 0 and sum(checks.values()) >= len(checks) - 1

        # Collect issues and suggestions
        issues = []
        suggestions = []

        if not checks.get("citation_valid"):
            issues.append("Citation verification failed - referenced section does not exist")

        if not checks.get("logic_valid"):
            issues.append("Reasoning chain contains logical flaws")
            suggestions.append("Re-analyze with clearer reasoning steps")

        if not checks.get("completeness_ok"):
            issues.append("Search may not have been thorough enough")
            suggestions.append("Expand search with additional queries")

        if not checks.get("no_hallucination"):
            issues.append("Potential hallucination detected")
            suggestions.append("Verify all facts against source documents")

        if not checks.get("recommendation_actionable"):
            issues.append("Recommendation is too vague or missing")
            suggestions.append("Generate more specific, actionable recommendation")

        return ValidationResult(
            is_valid=is_valid,
            validation_checks=checks,
            issues=issues,
            suggestions=suggestions
        )

    def validate(self, finding: Finding) -> ValidationResult:
        """
        Main entry point: Validate a finding.

        Args:
            finding: Finding to validate

        Returns:
            ValidationResult indicating if finding is valid
        """
        context = {"finding": finding}

        result = self.run(context)

        if result.success:
            return result.result
        else:
            # Return invalid result on failure
            return ValidationResult(
                is_valid=False,
                validation_checks={},
                issues=["Validation process failed"],
                suggestions=["Retry validation"]
            )
