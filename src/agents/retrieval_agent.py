"""Adaptive iterative retrieval agent - MOST CRITICAL COMPONENT."""

from typing import Dict, Any, List, Set
from collections import defaultdict

from .base import BaseAgent
from ..models.requirements import Requirement, SearchStrategy
from ..models.findings import RetrievalResult, PolicySection
from ..services.vector_store import VectorStore


class RetrievalAgent(BaseAgent):
    """
    Adaptive Retrieval Agent with Iterative Search.

    THIS IS THE MOST CRITICAL AGENT - it ensures we don't miss relevant policy sections.

    Behavior:
    1. Execute primary searches first
    2. Evaluate if results are sufficient
    3. If not, expand with secondary queries
    4. Continue up to MAX 3 iterations until:
       - Sufficient coverage achieved, OR
       - All search strategies exhausted, OR
       - Max iterations reached

    Prevents false positives (claiming gaps when policy actually covers it).
    """

    def __init__(
        self,
        llm_client,
        vector_store: VectorStore,
        max_iterations: int = 3,
        min_results: int = 3,
        results_per_query: int = 5
    ):
        """
        Initialize Retrieval Agent.

        Args:
            llm_client: LLM client for coverage assessment
            vector_store: Vector store for semantic search
            max_iterations: Maximum search iterations (default: 3)
            min_results: Minimum results to consider sufficient
            results_per_query: Results to retrieve per query
        """
        super().__init__(
            llm_client=llm_client,
            max_iterations=max_iterations,
            agent_name="RetrievalAgent"
        )
        self.vector_store = vector_store
        self.min_results = min_results
        self.results_per_query = results_per_query

    def _think(self, context: Dict[str, Any]) -> str:
        """Decide what queries to run next."""
        requirement: Requirement = context["requirement"]
        search_strategy: SearchStrategy = context["search_strategy"]
        sections_found: List[PolicySection] = context.get("sections_found", [])
        queries_executed: List[str] = context.get("queries_executed", [])

        if self.current_step == 1:
            return f"""Starting retrieval for requirement: {requirement.citation}

Plan: Execute {len(search_strategy.primary_queries)} primary queries to find relevant policy sections.
Target: At least {self.min_results} relevant sections."""

        elif self.current_step == 2:
            return f"""Iteration 2: Found {len(sections_found)} sections so far.

Evaluating coverage:
- Are results relevant to the requirement?
- Do we have sufficient depth?
- Should we search more?

Plan: Execute {len(search_strategy.secondary_queries)} secondary queries for broader coverage."""

        else:
            return f"""Iteration 3 (final): Found {len(sections_found)} sections total.

This is the last iteration. Executing:
- Category queries for maximum coverage
- Any remaining search strategies
- Final coverage assessment"""

    def _act(self, thought: str, context: Dict[str, Any]) -> Any:
        """Execute searches based on current iteration."""
        search_strategy: SearchStrategy = context["search_strategy"]
        sections_found: List[PolicySection] = context.get("sections_found", [])
        queries_executed: List[str] = context.get("queries_executed", [])
        seen_section_ids: Set[str] = context.get("seen_section_ids", set())

        # Determine which queries to execute
        if self.current_step == 1:
            queries_to_run = search_strategy.primary_queries
        elif self.current_step == 2:
            queries_to_run = search_strategy.secondary_queries
        else:
            queries_to_run = search_strategy.category_queries

        # Execute searches
        new_sections = []
        for query in queries_to_run:
            if not query or query in queries_executed:
                continue

            self.logger.debug(
                "Executing search",
                query=query,
                iteration=self.current_step
            )

            # Search vector store
            results = self.vector_store.search(
                query=query,
                n_results=self.results_per_query
            )

            # Convert to PolicySection and deduplicate
            for result in results:
                section_id = result["section_id"]

                # Skip if we've already seen this section
                if section_id in seen_section_ids:
                    continue

                policy_section = PolicySection(
                    section_id=section_id,
                    title=result.get("title"),
                    content=result["content"],
                    relevance_score=result["score"],
                    page=result.get("page"),
                    found_by_query=query
                )

                new_sections.append(policy_section)
                seen_section_ids.add(section_id)

            queries_executed.append(query)

        # Update context
        context["queries_executed"] = queries_executed
        context["seen_section_ids"] = seen_section_ids

        return new_sections

    def _observe(self, action_result: Any, context: Dict[str, Any]) -> str:
        """Process search results and update context."""
        new_sections: List[PolicySection] = action_result
        sections_found: List[PolicySection] = context.get("sections_found", [])

        # Add new sections
        sections_found.extend(new_sections)
        context["sections_found"] = sections_found

        # Sort by relevance
        sections_found.sort(key=lambda s: s.relevance_score, reverse=True)

        observation = f"""Search iteration {self.current_step} complete:
- Found {len(new_sections)} new sections
- Total unique sections: {len(sections_found)}
- Queries executed: {len(context['queries_executed'])}
- Top relevance score: {sections_found[0].relevance_score:.3f if sections_found else 0}"""

        self.logger.info(
            "Retrieval iteration complete",
            iteration=self.current_step,
            new_sections=len(new_sections),
            total_sections=len(sections_found)
        )

        return observation

    def _should_continue(self, context: Dict[str, Any]) -> bool:
        """Decide if we should continue searching."""
        sections_found: List[PolicySection] = context.get("sections_found", [])
        search_strategy: SearchStrategy = context["search_strategy"]
        queries_executed: List[str] = context.get("queries_executed", [])

        # Stop if we've reached max iterations
        if self.current_step >= self.max_iterations:
            self.logger.info(
                "Max iterations reached",
                iterations=self.current_step
            )
            return False

        # Stop if we have sufficient high-quality results
        high_quality_results = [
            s for s in sections_found
            if s.relevance_score > 0.7
        ]

        if len(high_quality_results) >= self.min_results:
            self.logger.info(
                "Sufficient coverage achieved",
                high_quality_results=len(high_quality_results),
                total_results=len(sections_found)
            )
            return False

        # Stop if all search strategies are exhausted
        all_queries = search_strategy.get_all_queries()
        remaining_queries = [q for q in all_queries if q not in queries_executed]

        if not remaining_queries:
            self.logger.info(
                "All search strategies exhausted",
                queries_executed=len(queries_executed)
            )
            return False

        # Continue searching
        self.logger.info(
            "Continuing search",
            sections_found=len(sections_found),
            remaining_queries=len(remaining_queries)
        )
        return True

    def _assess_coverage(self, context: Dict[str, Any]) -> str:
        """Assess the quality and coverage of retrieved sections."""
        sections_found: List[PolicySection] = context.get("sections_found", [])

        if not sections_found:
            return "none"

        # Check relevance scores
        high_relevance = [s for s in sections_found if s.relevance_score > 0.8]
        medium_relevance = [s for s in sections_found if 0.6 <= s.relevance_score <= 0.8]

        if len(high_relevance) >= 3:
            return "comprehensive"
        elif len(high_relevance) >= 1 or len(medium_relevance) >= 3:
            return "partial"
        elif sections_found:
            return "insufficient"
        else:
            return "none"

    def _extract_result(self, context: Dict[str, Any]) -> RetrievalResult:
        """Extract final retrieval result."""
        requirement: Requirement = context["requirement"]
        sections_found: List[PolicySection] = context.get("sections_found", [])
        queries_executed: List[str] = context.get("queries_executed", [])

        # Assess coverage
        coverage = self._assess_coverage(context)

        # Calculate confidence based on results
        if not sections_found:
            confidence = 0.0
        else:
            # Confidence based on top results' scores
            top_scores = [s.relevance_score for s in sections_found[:5]]
            confidence = sum(top_scores) / len(top_scores) if top_scores else 0.0

        return RetrievalResult(
            requirement_id=requirement.requirement_id,
            retrieval_attempts=self.current_step,
            queries_executed=queries_executed,
            sections_found=sections_found,
            coverage_assessment=coverage,
            confidence=confidence
        )

    def retrieve(
        self,
        requirement: Requirement,
        search_strategy: SearchStrategy
    ) -> RetrievalResult:
        """
        Main entry point: Retrieve relevant policy sections for a requirement.

        Args:
            requirement: Regulatory requirement
            search_strategy: Search strategy with queries

        Returns:
            RetrievalResult with found sections and coverage assessment
        """
        context = {
            "requirement": requirement,
            "search_strategy": search_strategy,
            "sections_found": [],
            "queries_executed": [],
            "seen_section_ids": set()
        }

        result = self.run(context)

        if result.success:
            return result.result
        else:
            # Return empty result on failure
            return RetrievalResult(
                requirement_id=requirement.requirement_id,
                retrieval_attempts=self.current_step,
                queries_executed=[],
                sections_found=[],
                coverage_assessment="none",
                confidence=0.0
            )
