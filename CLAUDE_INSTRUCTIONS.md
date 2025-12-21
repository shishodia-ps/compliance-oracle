# Claude Code Instructions

This document provides instructions for Claude Code to build the Compliance Oracle v3.0 system.

## Project Context

You are building an **Agentic RAG compliance gap analysis system** that:
1. Accepts policy documents (PDF, DOCX) and regulatory benchmarks
2. Extracts discrete requirements from benchmarks
3. Uses iterative retrieval to find relevant policy sections
4. Analyzes compliance through reasoning (not keyword matching)
5. Validates findings before output
6. Generates professional reports

## Reference Documents

- **Full Specification**: See `docs/SPECIFICATION.md` for complete requirements
- **Configuration**: Pre-built configs in `src/config/`

## Implementation Order

Build in this sequence:

### Phase 1: Foundation
```
1. src/config/settings.py      - Environment and app settings
2. src/config/keywords.py      - Multilingual keyword registry  
3. src/config/models.py        - LLM model registry
4. src/config/jurisdictions.py - Jurisdiction and benchmark registry
5. src/models/*.py             - All Pydantic data models
```

### Phase 2: Document Processing
```
6. src/parsers/base.py         - Abstract parser class
7. src/parsers/pdf.py          - PDF parser (PyMuPDF)
8. src/parsers/docx.py         - Word document parser
9. src/parsers/language.py     - Language detection
10. src/parsers/structure.py   - Section/structure extraction
```

### Phase 3: Core Services
```
11. src/services/llm.py        - LLM client wrapper (OpenAI, Anthropic)
12. src/services/embedding.py  - Embedding service
13. src/services/vector_store.py - ChromaDB integration
```

### Phase 4: Agents
```
14. src/agents/base.py                  - Base agent class
15. src/agents/requirement_extractor.py - Extract requirements from benchmark
16. src/agents/query_agent.py           - Query understanding and expansion
17. src/agents/retrieval_agent.py       - Adaptive iterative retrieval
18. src/agents/analysis_agent.py        - Gap analysis with reasoning
19. src/agents/validation_agent.py      - Finding validation
```

### Phase 5: Workflow
```
20. src/workflow/state.py      - Workflow state definition
21. src/workflow/nodes.py      - LangGraph node functions
22. src/workflow/conditions.py - Edge condition functions
23. src/workflow/graph.py      - Main LangGraph definition
```

### Phase 6: Reporting
```
24. src/reporting/pdf.py       - PDF report generation
25. src/reporting/docx.py      - Word report generation
26. src/reporting/json_export.py - JSON export
```

### Phase 7: UI
```
27. ui/styles.py               - CSS styles
28. ui/components/sidebar.py   - Sidebar with all configs
29. ui/components/upload.py    - File upload component
30. ui/components/progress.py  - Progress indicator
31. ui/components/findings.py  - Findings display
32. ui/pages/home.py           - Home page
33. ui/pages/analysis.py       - Analysis page
34. ui/pages/results.py        - Results page
35. app.py                     - Main Streamlit app
```

## Key Design Decisions

### 1. Agentic RAG (Not Traditional RAG)
```
WRONG: Query → Search → Retrieve → Generate → Done
RIGHT: Query → Search → Evaluate → Need more? → Search again → Analyze → Validate → Done
```

### 2. Semantic Matching (Not Keyword Matching)
```
WRONG: Search for "beneficial owner" → exact phrase not found → GAP
RIGHT: Search for "beneficial owner", "UBO", "ownership" → found concept → ANALYZE
```

### 3. Reasoning-Based Analysis
```
WRONG: "Policy doesn't say 'sanctions screening'" → GAP
RIGHT: "Policy says 'screen against all restricted lists' which includes sanctions" → COMPLIANT
```

### 4. Citation Validation
```
WRONG: LLM says "Article 5.2 requires..." → trust it
RIGHT: LLM says "Article 5.2 requires..." → verify Article 5.2 exists → confirm text matches
```

### 5. Multilingual Support
```
When document is German:
1. Detect language
2. Use German keywords for search
3. Reason in English
4. Cite original German text
5. Report in user's preferred language
```

## Code Style Guidelines

### Pydantic Models
```python
from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class Requirement(BaseModel):
    """A discrete regulatory requirement."""
    requirement_id: str = Field(..., description="Unique identifier")
    source: str = Field(..., description="Regulatory source name")
    article: str = Field(..., description="Article/section reference")
    text: str = Field(..., description="Full requirement text")
    category: str = Field(..., description="Compliance category")
    criticality: Literal["mandatory", "recommended"] = "mandatory"
```

### Agent Structure
```python
from abc import ABC, abstractmethod
from typing import Any

class BaseAgent(ABC):
    """Base class for all agents."""
    
    def __init__(self, llm_client, config):
        self.llm = llm_client
        self.config = config
    
    @abstractmethod
    async def run(self, state: dict) -> dict:
        """Execute agent logic and return updated state."""
        pass
    
    def _build_prompt(self, template: str, **kwargs) -> str:
        """Build prompt from template."""
        return template.format(**kwargs)
```

### Error Handling
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def call_llm(self, prompt: str) -> str:
    """Call LLM with retry logic."""
    try:
        response = await self.llm.complete(prompt)
        return response
    except RateLimitError:
        logger.warning("Rate limit hit, retrying...")
        raise
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise
```

## Testing Requirements

Each module should have corresponding tests:
```
src/parsers/pdf.py → tests/unit/test_pdf_parser.py
src/agents/analysis_agent.py → tests/unit/test_analysis_agent.py
```

Use pytest fixtures for common test data:
```python
@pytest.fixture
def sample_requirement():
    return Requirement(
        requirement_id="TEST-001",
        source="Test Regulation",
        article="Article 1",
        text="Test requirement text",
        category="AML"
    )
```

## Common Pitfalls to Avoid

1. **Don't chunk blindly** - Preserve document structure
2. **Don't match keywords** - Match concepts semantically  
3. **Don't trust LLM citations** - Always verify
4. **Don't ignore language** - Use multilingual keywords
5. **Don't report everything** - Only validated findings
6. **Don't use bare except** - Catch specific exceptions
7. **Don't hardcode models** - Use configuration registry

## When You're Stuck

If you encounter a complex design decision:
1. Check `docs/SPECIFICATION.md` for requirements
2. Look at the failure modes section
3. Ask the user for clarification
4. Prefer explicit over implicit behavior

## Success Criteria

The system is complete when:
- [ ] Can parse PDF and DOCX in multiple languages
- [ ] Extracts 25-40 requirements from benchmark (not 100+ chunks)
- [ ] Uses iterative retrieval (not single-shot)
- [ ] Produces findings with valid citations
- [ ] Validates findings before output
- [ ] Generates PDF/DOCX reports
- [ ] UI allows multi-domain selection
- [ ] All tests pass
