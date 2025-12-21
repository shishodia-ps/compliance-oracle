"""Query understanding and expansion agent."""

from typing import Dict, Any, List
import json

from .base import BaseAgent
from ..models.requirements import Requirement, SearchStrategy
from ..config.keywords import get_keywords_for_domain


class QueryAgent(BaseAgent):
    """
    Query Understanding Agent.

    Transforms regulatory requirements into optimal search strategies:
    1. Extracts core concepts from requirement
    2. Generates synonym expansions
    3. Creates multiple query variants
    4. Considers multilingual keywords
    """

    def __init__(self, llm_client, domain: str = "AML", language: str = "en"):
        """
        Initialize Query Agent.

        Args:
            llm_client: LLM client for query generation
            domain: Compliance domain (AML, KYC, etc.)
            language: Primary language
        """
        super().__init__(
            llm_client=llm_client,
            max_iterations=2,  # Think + refine
            agent_name="QueryAgent"
        )
        self.domain = domain
        self.language = language

    def _think(self, context: Dict[str, Any]) -> str:
        """Analyze the requirement and plan query generation."""
        requirement: Requirement = context["requirement"]

        if self.current_step == 1:
            return f"""Analyzing requirement to generate search queries:

Requirement: {requirement.citation}
Text: {requirement.text}
Category: {requirement.category.value}

I need to:
1. Extract core concepts (SUBJECT, ACTION, PARAMETERS)
2. Generate synonyms and industry terms
3. Create primary, secondary, and category queries
4. Consider multilingual variants"""

        else:
            # Refinement step
            return "Refining queries based on domain keywords and ensuring comprehensive coverage."

    def _act(self, thought: str, context: Dict[str, Any]) -> Any:
        """Generate search queries."""
        requirement: Requirement = context["requirement"]

        if self.current_step == 1:
            # Generate initial queries
            return self._generate_queries(requirement)
        else:
            # Refine with domain keywords
            initial_strategy: SearchStrategy = context.get("search_strategy")
            return self._refine_with_keywords(initial_strategy, requirement)

    def _observe(self, action_result: Any, context: Dict[str, Any]) -> str:
        """Process the generated queries."""
        if self.current_step == 1:
            context["search_strategy"] = action_result
            return f"Generated {len(action_result.get_all_queries())} initial queries"
        else:
            context["search_strategy"] = action_result
            context["result"] = action_result
            return f"Refined strategy with {len(action_result.get_all_queries())} total queries"

    def _should_continue(self, context: Dict[str, Any]) -> bool:
        """Continue for refinement step only."""
        return self.current_step < 2

    def _generate_queries(self, requirement: Requirement) -> SearchStrategy:
        """Generate search queries using LLM."""
        prompt = f"""You are a search query expert for compliance documents.

Given this regulatory requirement, generate comprehensive search queries to find relevant policy sections:

REQUIREMENT:
Citation: {requirement.citation}
Text: {requirement.text}
Category: {requirement.category.value}
Type: {requirement.type.value}

Generate search queries in these categories:

1. PRIMARY QUERIES (3-5): Direct, specific queries using exact terminology
2. SECONDARY QUERIES (3-5): Broader queries using synonyms and related terms
3. CATEGORY QUERIES (2-3): High-level category-based queries
4. CONCEPTS TO FIND (3-5): Key concepts that must be present

Consider:
- Legal synonyms (e.g., beneficial owner = UBO)
- Industry terms (e.g., CDD = Know Your Customer)
- Plain language equivalents
- Abbreviations and expansions

Return ONLY valid JSON matching this schema:
{{
    "primary_queries": ["query1", "query2", ...],
    "secondary_queries": ["query1", "query2", ...],
    "category_queries": ["query1", "query2", ...],
    "concepts_to_find": ["concept1", "concept2", ...]
}}"""

        response = self.llm_client.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=1000
        )

        # Parse JSON response
        try:
            content = response.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            data = json.loads(content)

            return SearchStrategy(
                requirement_id=requirement.requirement_id,
                primary_queries=data.get("primary_queries", []),
                secondary_queries=data.get("secondary_queries", []),
                category_queries=data.get("category_queries", []),
                concepts_to_find=data.get("concepts_to_find", [])
            )

        except json.JSONDecodeError as e:
            self.logger.error("Failed to parse LLM response", error=str(e))
            # Fallback: use requirement keywords
            return SearchStrategy(
                requirement_id=requirement.requirement_id,
                primary_queries=requirement.keywords[:5],
                secondary_queries=[requirement.text[:100]],
                category_queries=[requirement.category.value]
            )

    def _refine_with_keywords(
        self,
        strategy: SearchStrategy,
        requirement: Requirement
    ) -> SearchStrategy:
        """Refine queries with domain-specific multilingual keywords."""
        # Get domain keywords
        domain_keywords = get_keywords_for_domain(
            domain=requirement.category.value,
            language=self.language,
            include_all_languages=False
        )

        # Add relevant domain keywords to secondary queries
        for keyword in domain_keywords[:5]:
            if keyword.lower() not in [q.lower() for q in strategy.get_all_queries()]:
                strategy.secondary_queries.append(keyword)

        # Add requirement's own keywords
        for keyword in requirement.keywords[:3]:
            if keyword.lower() not in [q.lower() for q in strategy.primary_queries]:
                strategy.primary_queries.append(keyword)

        # Deduplicate
        strategy.primary_queries = list(dict.fromkeys(strategy.primary_queries))
        strategy.secondary_queries = list(dict.fromkeys(strategy.secondary_queries))
        strategy.category_queries = list(dict.fromkeys(strategy.category_queries))

        return strategy

    def generate_search_strategy(self, requirement: Requirement) -> SearchStrategy:
        """
        Main entry point: Generate search strategy for a requirement.

        Args:
            requirement: Regulatory requirement

        Returns:
            SearchStrategy with queries
        """
        context = {"requirement": requirement}
        result = self.run(context)

        if result.success:
            return result.result
        else:
            # Fallback strategy
            self.logger.warning("Failed to generate strategy, using fallback")
            return SearchStrategy(
                requirement_id=requirement.requirement_id,
                primary_queries=requirement.keywords[:5] if requirement.keywords else [requirement.text[:100]],
                secondary_queries=[requirement.category.value],
                category_queries=["compliance", "policy"]
            )
