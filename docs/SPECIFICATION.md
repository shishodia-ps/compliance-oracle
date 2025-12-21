# Agentic Compliance Oracle v3.0
## System Design & Failure Analysis Document

**Version:** 3.0 (Complete Redesign)
**Date:** December 2024
**Purpose:** Intelligent regulatory compliance gap analysis

---

# Table of Contents

1. [System Overview](#1-system-overview)
2. [Document Ingestion](#2-document-ingestion)
3. [Agentic RAG Architecture](#3-agentic-rag-architecture)
4. [Agent Specifications](#4-agent-specifications)
5. [Data Flow](#5-data-flow)
6. [Technical Failure Modes](#6-technical-failure-modes)
7. [Functional Failure Modes](#7-functional-failure-modes)
8. [Edge Cases & Scenarios](#8-edge-cases--scenarios)
9. [Mitigation Strategies](#9-mitigation-strategies)
10. [Project Structure](#10-project-structure)
11. [Implementation Phases](#11-implementation-phases)

---

# 1. System Overview

## 1.1 What This System Does

```
INPUT:
├── Company Policy Document (any format)
├── Regulatory Benchmark (any format or auto-fetch)
├── Jurisdiction (e.g., Luxembourg, EU, Netherlands)
└── Domain (e.g., AML, GDPR, KYC)

PROCESS:
├── Intelligent document parsing (preserve structure)
├── Requirement extraction from benchmark
├── Agentic RAG analysis (iterative, self-correcting)
└── Gap identification with reasoning

OUTPUT:
├── List of compliance gaps with:
│   ├── Regulatory citation (exact article/section)
│   ├── Policy reference (exact section)
│   ├── Gap description (what's missing)
│   ├── Severity rating (Critical/High/Medium/Low)
│   ├── Reasoning chain (why it's a gap)
│   └── Actionable recommendation
└── Professional report (PDF/DOCX/JSON)
```

## 1.2 Key Principles

```
1. INTELLIGENCE OVER KEYWORDS
   - Semantic understanding, not string matching
   - "KYC" = "Customer Due Diligence" = "Client Identification"

2. ITERATIVE SEARCH
   - Don't stop at first result
   - Exhaust search strategies before declaring gap

3. SELF-CORRECTION
   - Validate every finding
   - Retry if uncertain
   - Admit when cannot determine

4. CITATION ACCURACY
   - Every claim backed by document reference
   - No hallucinated article numbers

5. ACTIONABLE OUTPUT
   - Not just "gap exists"
   - Specific recommendation to fix
```

---

# 2. Document Ingestion

## 2.1 Supported Formats

```
MUST SUPPORT:
├── PDF (.pdf)
│   ├── Native PDF (text-based)
│   ├── Scanned PDF (needs OCR)
│   └── Encrypted PDF (needs password or rejection)
│
├── Word Documents
│   ├── DOCX (.docx) - Modern Word
│   ├── DOC (.doc) - Legacy Word
│   └── RTF (.rtf) - Rich Text
│
├── Web Content
│   ├── HTML (.html)
│   └── Direct URL fetch
│
├── Plain Text
│   ├── TXT (.txt)
│   └── Markdown (.md)
│
└── Spreadsheets (for control matrices)
    ├── XLSX (.xlsx)
    └── CSV (.csv)
```

## 2.2 Document Parser Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCUMENT PARSER                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Input File                                                 │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────┐                                       │
│   │ Format Detector │                                       │
│   └────────┬────────┘                                       │
│            │                                                 │
│   ┌────────┴────────┬─────────┬─────────┬─────────┐        │
│   ▼                 ▼         ▼         ▼         ▼        │
│ ┌─────┐         ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐     │
│ │ PDF │         │DOCX │   │HTML │   │ TXT │   │XLSX │     │
│ │Loader│        │Loader│  │Loader│  │Loader│  │Loader│     │
│ └──┬──┘         └──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘     │
│    │               │         │         │         │          │
│    └───────────────┴─────────┴─────────┴─────────┘          │
│                              │                               │
│                              ▼                               │
│                    ┌─────────────────┐                      │
│                    │ Structure       │                      │
│                    │ Extractor       │                      │
│                    │ - Sections      │                      │
│                    │ - Headers       │                      │
│                    │ - Page numbers  │                      │
│                    └────────┬────────┘                      │
│                             │                                │
│                             ▼                                │
│                    ┌─────────────────┐                      │
│                    │ Structured      │                      │
│                    │ Document        │                      │
│                    │ Output          │                      │
│                    └─────────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 2.3 Structure Extraction Logic

```
GOAL: Extract sections WITH their identifiers

INPUT (Raw text):
"3.2 Customer Due Diligence
The bank shall perform CDD on all customers...

3.2.1 Standard CDD
For low-risk customers, the following applies...

3.2.2 Enhanced CDD
For high-risk customers..."

OUTPUT (Structured):
[
  {
    "section_id": "3.2",
    "title": "Customer Due Diligence",
    "content": "The bank shall perform CDD on all customers...",
    "page": 12,
    "subsections": ["3.2.1", "3.2.2"]
  },
  {
    "section_id": "3.2.1",
    "title": "Standard CDD",
    "content": "For low-risk customers, the following applies...",
    "page": 12,
    "parent": "3.2"
  },
  ...
]
```

## 2.4 Document Ingestion Failure Modes

| Failure Mode | Cause | Impact | Mitigation |
|--------------|-------|--------|------------|
| Scanned PDF not readable | No OCR | Zero text extracted | Auto-detect, apply OCR, warn user |
| Encrypted PDF | Password protection | Cannot open | Detect early, ask for password |
| Corrupted file | Bad upload | Parse error | Validate file, show clear error |
| Wrong encoding | Non-UTF8 text | Garbled characters | Detect encoding, convert |
| Complex tables | Multi-column layout | Text order wrong | Special table handling |
| Headers/footers repeated | PDF extraction | Noise in text | Filter repeated patterns |
| Section numbers lost | Bad parsing | No citations possible | Multiple parsing strategies |
| Very large file | Memory limits | Crash or timeout | Streaming parser, size limits |
| Empty document | User error | No analysis possible | Detect, warn immediately |
| Image-only content | Charts, diagrams | Missed requirements | OCR + warn about images |

---

# 3. Agentic RAG Architecture

## 3.1 Why Agentic RAG?

```
TRADITIONAL RAG FAILURES:
═════════════════════════════════════════════════════════════

Problem 1: Single-Shot Retrieval
────────────────────────────────
Query: "beneficial owner requirements"
Retrieved: Generic paragraph about ownership
Result: Misses specific 25% threshold mentioned elsewhere

Problem 2: No Query Understanding
────────────────────────────────
Benchmark says: "UBO identification per Article 3(6)"
System searches for: "UBO identification per Article 3(6)"
Policy uses: "beneficial owner verification"
Result: No match found (different words, same meaning)

Problem 3: No Self-Correction
────────────────────────────────
LLM generates: "Policy doesn't mention sanctions screening"
Reality: Policy Section 4.5 covers it extensively
Result: False positive gap (hallucination)

Problem 4: No Reasoning
────────────────────────────────
Requirement: "Screen against EU sanctions lists"
Policy says: "Screen against all applicable sanctions"
Traditional RAG: "Exact phrase not found = Gap"
Correct analysis: "All applicable" includes EU = Compliant


AGENTIC RAG SOLUTIONS:
═════════════════════════════════════════════════════════════

Solution 1: Iterative Retrieval
────────────────────────────────
Search 1: "beneficial owner requirements" → Partial
Agent decides: Not enough, try synonyms
Search 2: "UBO" "ultimate beneficial owner" → More results
Search 3: "ownership threshold" "25 percent" → Complete
Result: Comprehensive context gathered

Solution 2: Query Transformation
────────────────────────────────
Original: "UBO identification per Article 3(6)"
Agent transforms to:
- "beneficial owner"
- "ultimate beneficial owner"  
- "ownership verification"
- "controlling persons"
Result: Finds semantically equivalent content

Solution 3: Self-Validation
────────────────────────────────
Finding generated: "No sanctions screening"
Validation agent: "Let me verify this claim"
Re-searches: "sanctions" "screening" "blocked" "prohibited"
Finds: Section 4.5 on sanctions
Result: Finding rejected, false positive avoided

Solution 4: Chain-of-Thought Reasoning
────────────────────────────────
Requirement: "Screen against EU sanctions"
Policy: "Screen against all applicable sanctions"
Agent reasons:
- "All applicable" is broader than "EU"
- EU sanctions are part of "all applicable"
- Policy is actually MORE comprehensive
- Conclusion: COMPLIANT
Result: Correct determination
```

## 3.2 Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTIC RAG SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 ORCHESTRATOR AGENT                         │  │
│  │                                                            │  │
│  │  Controls flow, manages state, decides next action         │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│       ┌────────────────────┼────────────────────┐               │
│       │                    │                    │               │
│       ▼                    ▼                    ▼               │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐           │
│  │ QUERY   │         │RETRIEVAL│         │ANALYSIS │           │
│  │ AGENT   │         │ AGENT   │         │ AGENT   │           │
│  │         │         │         │         │         │           │
│  │•Understand│       │•Search  │         │•Compare │           │
│  │•Decompose│        │•Evaluate│         │•Reason  │           │
│  │•Expand  │         │•Iterate │         │•Conclude│           │
│  └─────────┘         └─────────┘         └─────────┘           │
│       │                    │                    │               │
│       │                    │                    │               │
│       │                    ▼                    │               │
│       │              ┌─────────┐                │               │
│       │              │ VECTOR  │                │               │
│       │              │  STORE  │                │               │
│       │              │         │                │               │
│       │              │ Policy  │                │               │
│       │              │ Indexed │                │               │
│       │              └─────────┘                │               │
│       │                                         │               │
│       └─────────────────────────────────────────┘               │
│                            │                                     │
│                            ▼                                     │
│                    ┌─────────────┐                               │
│                    │ VALIDATION  │                               │
│                    │   AGENT     │                               │
│                    │             │                               │
│                    │ •Verify     │                               │
│                    │ •Check      │                               │
│                    │ •Approve/   │                               │
│                    │  Reject     │                               │
│                    └──────┬──────┘                               │
│                           │                                      │
│              ┌────────────┴────────────┐                        │
│              ▼                         ▼                        │
│         ┌────────┐               ┌────────┐                     │
│         │ VALID  │               │INVALID │                     │
│         │FINDING │               │ RETRY  │──────► Back to      │
│         └────────┘               └────────┘       Query Agent   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3.3 State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                      STATE TRANSITIONS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ┌──────────┐                                                 │
│    │  START   │                                                 │
│    └────┬─────┘                                                 │
│         │                                                        │
│         ▼                                                        │
│    ┌──────────┐      Query unclear     ┌──────────┐            │
│    │ QUERY    │─────────────────────►  │ CLARIFY  │            │
│    │UNDERSTAND│◄─────────────────────  │          │            │
│    └────┬─────┘      Clarified         └──────────┘            │
│         │                                                        │
│         │ Query ready                                            │
│         ▼                                                        │
│    ┌──────────┐      Need more    ┌──────────────┐             │
│    │ RETRIEVE │◄─────────────────►│ EXPAND QUERY │             │
│    │          │                   └──────────────┘             │
│    └────┬─────┘                                                 │
│         │                                                        │
│         │ Sufficient context                                     │
│         ▼                                                        │
│    ┌──────────┐      Uncertain    ┌──────────────┐             │
│    │ ANALYZE  │◄─────────────────►│ MORE CONTEXT │             │
│    │          │                   └──────────────┘             │
│    └────┬─────┘                                                 │
│         │                                                        │
│         │ Analysis complete                                      │
│         ▼                                                        │
│    ┌──────────┐      Invalid      ┌──────────────┐             │
│    │ VALIDATE │───────────────────►│    RETRY     │─────┐      │
│    │          │                    └──────────────┘     │      │
│    └────┬─────┘                                         │      │
│         │                              Max retries?     │      │
│         │ Valid                              │          │      │
│         ▼                                    ▼          │      │
│    ┌──────────┐                       ┌──────────┐     │      │
│    │ COMPLETE │                       │  FAILED  │◄────┘      │
│    │ (Output) │                       │(Escalate)│             │
│    └──────────┘                       └──────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. Agent Specifications

## 4.1 Requirement Extractor Agent

```
PURPOSE:
Transform raw regulatory text into discrete, searchable requirements

INPUT:
- Raw benchmark document text
- Document metadata (source, jurisdiction, domain)

OUTPUT:
- List of structured requirements

BEHAVIOR:

Step 1: Document Understanding
├── Identify document type (law, regulation, guideline)
├── Detect structure (articles, sections, recitals)
├── Find table of contents if exists
└── Map cross-references

Step 2: Requirement Extraction
├── For each article/section:
│   ├── Is this a REQUIREMENT (must/shall/required)?
│   ├── Or DEFINITION (means/refers to)?
│   ├── Or GUIDANCE (should/may/recommended)?
│   └── Or EXEMPTION (except/unless/not applicable)?
├── Extract the specific obligation
├── Preserve the exact citation
└── Link to related requirements

Step 3: Enrichment
├── Categorize (CDD, UBO, PEP, Sanctions, etc.)
├── Assess criticality (mandatory vs recommended)
├── Generate search keywords
└── Identify synonyms and related terms

EXAMPLE OUTPUT:
{
  "requirement_id": "AMLD6-Art-14-5",
  "source": "EU AMLD6",
  "citation": "Article 14(5)",
  "type": "mandatory",
  "category": "Enhanced Due Diligence",
  "text": "Member States shall require that enhanced CDD measures 
          are applied in situations which by their nature can 
          present a higher risk of money laundering...",
  "obligations": [
    "Apply enhanced CDD for high-risk situations"
  ],
  "keywords": [
    "enhanced due diligence", "EDD", "high risk", 
    "higher risk", "CDD measures"
  ],
  "cross_references": ["Article 18", "Article 18a"],
  "criticality": "high"
}
```

## 4.2 Query Understanding Agent

```
PURPOSE:
Transform requirement into optimal search strategy

INPUT:
- Single requirement object
- Domain context

OUTPUT:
- Search strategy with multiple query variants

BEHAVIOR:

Step 1: Core Concept Extraction
├── What is the SUBJECT? (e.g., beneficial owner)
├── What is the ACTION? (e.g., identify, verify)
├── What are the PARAMETERS? (e.g., 25%, government ID)
└── What is the CONTEXT? (e.g., account opening)

Step 2: Synonym Expansion
├── Legal synonyms (beneficial owner = UBO)
├── Industry terms (CDD = Know Your Customer)
├── Plain language (verify identity = ID check)
└── Abbreviations (PEP, EDD, STR)

Step 3: Query Generation
├── Exact phrase queries
├── Concept-based queries
├── Broader category queries
└── Negation queries (check for contradictions)

EXAMPLE OUTPUT:
{
  "requirement_id": "AMLD6-Art-3-6-a",
  "search_strategy": {
    "primary_queries": [
      "beneficial owner",
      "ultimate beneficial owner",
      "UBO"
    ],
    "secondary_queries": [
      "ownership threshold",
      "25 percent ownership",
      "controlling interest"
    ],
    "category_queries": [
      "customer due diligence ownership",
      "CDD beneficial ownership"
    ],
    "concepts_to_find": [
      "ownership identification process",
      "percentage threshold for ownership",
      "definition of beneficial owner"
    ]
  }
}
```

## 4.3 Adaptive Retrieval Agent

```
PURPOSE:
Find ALL relevant policy sections through iterative search

INPUT:
- Search strategy from Query Agent
- Policy vector store

OUTPUT:
- Comprehensive set of relevant policy sections
- Confidence assessment

BEHAVIOR:

Step 1: Execute Primary Searches
├── Run each primary query
├── Collect top-k results per query
├── Track which sections found
└── Deduplicate results

Step 2: Evaluate Coverage
├── Do results address the requirement?
├── Is there sufficient context?
├── Are there obvious gaps in search?
└── Should we search more?

Step 3: Iterative Expansion (if needed)
├── Run secondary queries
├── Run category queries
├── Search for related concepts
└── Continue until:
    ├── Sufficient coverage achieved, OR
    ├── All strategies exhausted, OR
    └── Max iterations reached

Step 4: Result Consolidation
├── Rank by relevance
├── Group by policy section
├── Note which queries found what
└── Assess overall confidence

DECISION LOGIC:
┌─────────────────────────────────────────────────────────┐
│                                                          │
│   Results found?                                         │
│        │                                                 │
│        ├── NO  → Run more queries                       │
│        │        └── Still nothing? → Mark as "not found"│
│        │                                                 │
│        └── YES → Relevant to requirement?               │
│                       │                                  │
│                       ├── NO  → Try different queries   │
│                       │                                  │
│                       └── YES → Sufficient depth?       │
│                                     │                    │
│                                     ├── NO  → Expand    │
│                                     │                    │
│                                     └── YES → DONE      │
│                                                          │
└─────────────────────────────────────────────────────────┘

EXAMPLE OUTPUT:
{
  "requirement_id": "AMLD6-Art-3-6-a",
  "retrieval_attempts": 3,
  "queries_executed": [
    "beneficial owner",
    "UBO",
    "ownership threshold"
  ],
  "sections_found": [
    {
      "section_id": "2.3",
      "title": "Beneficial Ownership",
      "content": "The bank identifies beneficial owners...",
      "relevance_score": 0.92,
      "found_by_query": "beneficial owner"
    },
    {
      "section_id": "2.3.1",
      "title": "Ownership Thresholds", 
      "content": "...",
      "relevance_score": 0.87,
      "found_by_query": "ownership threshold"
    }
  ],
  "coverage_assessment": "comprehensive",
  "confidence": 0.89
}
```

## 4.4 Analysis Agent

```
PURPOSE:
Determine compliance status through reasoning

INPUT:
- Requirement with context
- Retrieved policy sections

OUTPUT:
- Compliance determination with reasoning

BEHAVIOR:

Step 1: Requirement Understanding
├── What exactly is required?
├── What would compliance look like?
├── What would non-compliance look like?
└── Are there partial compliance scenarios?

Step 2: Policy Analysis
├── What does each section say?
├── Does it address the requirement?
├── How completely does it address it?
└── Are there contradictions?

Step 3: Comparison & Reasoning
├── Map requirement elements to policy coverage
├── Identify gaps between requirement and policy
├── Consider semantic equivalence
├── Account for "broader than required" scenarios

Step 4: Determination
├── COMPLIANT: Policy fully meets requirement
├── PARTIAL: Policy addresses but incompletely
├── GAP: Policy doesn't address requirement
├── CONTRADICTION: Policy conflicts with requirement
└── UNCERTAIN: Cannot determine from available info

REASONING TEMPLATE:
"""
REQUIREMENT ANALYSIS
====================
Requirement: {requirement_text}
Source: {citation}

POLICY COVERAGE
===============
Relevant sections found: {sections}

REASONING CHAIN
===============
1. The requirement mandates: {core_obligation}
2. The policy states: {policy_position}
3. Comparison:
   - {element_1}: {covered/not_covered}
   - {element_2}: {covered/not_covered}
   - ...
4. Assessment: {determination}

CONCLUSION
==========
Status: {COMPLIANT|PARTIAL|GAP|CONTRADICTION}
Confidence: {0.0-1.0}
Reasoning: {summary}
"""

EXAMPLE OUTPUT:
{
  "requirement_id": "AMLD6-Art-3-6-a",
  "status": "partial_gap",
  "confidence": 0.85,
  "reasoning_chain": [
    {
      "step": 1,
      "observation": "Requirement mandates 25% ownership threshold",
      "analysis": "This is a specific numerical requirement"
    },
    {
      "step": 2,
      "observation": "Policy Section 2.3 mentions 'identifying beneficial owners'",
      "analysis": "Concept is present in policy"
    },
    {
      "step": 3,
      "observation": "Policy does not specify any percentage threshold",
      "analysis": "Key parameter is missing"
    },
    {
      "step": 4,
      "observation": "Without threshold, scope is ambiguous",
      "analysis": "Could mean 1% or 50% - not compliant"
    }
  ],
  "gap_details": {
    "what_is_missing": "Specific 25% ownership threshold",
    "policy_has": "General beneficial owner identification",
    "policy_lacks": "Numerical threshold definition"
  },
  "recommendation": "Add to Section 2.3: 'Beneficial owner means any natural person who ultimately owns or controls more than 25% of shares or voting rights'"
}
```

## 4.5 Validation Agent

```
PURPOSE:
Verify finding accuracy before output

INPUT:
- Draft finding from Analysis Agent

OUTPUT:
- Validated finding OR rejection with reason

CHECKS:

Check 1: Citation Verification
├── Does the cited article actually exist?
├── Does the cited policy section exist?
├── Does the quoted text match the source?
└── FAIL if any citation is fabricated

Check 2: Logic Verification
├── Does the reasoning chain make sense?
├── Are there logical fallacies?
├── Is the conclusion supported by evidence?
└── FAIL if reasoning is flawed

Check 3: Completeness Verification
├── Were all relevant policy sections considered?
├── Could there be other sections we missed?
├── Is the search exhaustive?
└── RETRY if potentially incomplete

Check 4: Hallucination Detection
├── Is any claimed fact verifiable in documents?
├── Are we making assumptions stated as facts?
├── Is confidence appropriate given evidence?
└── FAIL if hallucination detected

Check 5: Actionability Verification
├── Is the recommendation specific?
├── Is it implementable?
├── Does it actually fix the gap?
└── REVISE if recommendation is vague

DECISION MATRIX:
┌─────────────────┬─────────────────────────────────────┐
│ Check Result    │ Action                              │
├─────────────────┼─────────────────────────────────────┤
│ All pass        │ APPROVE - Return finding            │
│ Citation fail   │ REJECT - Discard finding            │
│ Logic fail      │ RETRY - Re-analyze with guidance    │
│ Incomplete      │ RETRY - Search more first           │
│ Hallucination   │ REJECT - Discard finding            │
│ Vague rec.      │ REVISE - Improve recommendation     │
│ Max retries     │ ESCALATE - Flag for human review    │
└─────────────────┴─────────────────────────────────────┘
```

---

# 5. Data Flow

## 5.1 Complete Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMPLETE DATA FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER INPUTS                                                     │
│  ══════════                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   POLICY    │  │  BENCHMARK  │  │   CONFIG    │             │
│  │  Document   │  │  Document   │  │ Jurisdiction│             │
│  │ (Any format)│  │ (Any format)│  │   Domain    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         ▼                ▼                │                      │
│  ┌─────────────────────────────────┐     │                      │
│  │       DOCUMENT PARSER           │     │                      │
│  │                                 │     │                      │
│  │  • Format detection             │     │                      │
│  │  • Text extraction              │     │                      │
│  │  • Structure preservation       │     │                      │
│  │  • Section identification       │     │                      │
│  └────────┬───────────────┬────────┘     │                      │
│           │               │              │                      │
│           ▼               ▼              │                      │
│  ┌─────────────┐  ┌─────────────┐        │                      │
│  │  POLICY     │  │ BENCHMARK   │        │                      │
│  │ STRUCTURED  │  │ STRUCTURED  │        │                      │
│  │  SECTIONS   │  │   TEXT      │        │                      │
│  └──────┬──────┘  └──────┬──────┘        │                      │
│         │                │               │                      │
│         │                ▼               │                      │
│         │        ┌─────────────────┐     │                      │
│         │        │  REQUIREMENT    │     │                      │
│         │        │   EXTRACTOR     │◄────┘                      │
│         │        │     AGENT       │                            │
│         │        └────────┬────────┘                            │
│         │                 │                                      │
│         │                 ▼                                      │
│         │        ┌─────────────────┐                            │
│         │        │   25-40         │                            │
│         │        │ REQUIREMENTS    │                            │
│         │        │ with citations  │                            │
│         │        └────────┬────────┘                            │
│         │                 │                                      │
│         ▼                 │                                      │
│  ┌─────────────┐         │                                      │
│  │  VECTOR     │         │                                      │
│  │  INDEXING   │         │                                      │
│  │             │         │                                      │
│  │ Policy      │         │                                      │
│  │ sections    │         │                                      │
│  │ embedded    │         │                                      │
│  └──────┬──────┘         │                                      │
│         │                │                                      │
│         │    ┌───────────┘                                      │
│         │    │                                                   │
│         ▼    ▼                                                   │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║           FOR EACH REQUIREMENT (Loop)                      ║ │
│  ╠═══════════════════════════════════════════════════════════╣ │
│  ║                                                            ║ │
│  ║  ┌────────────────┐                                       ║ │
│  ║  │ QUERY AGENT    │                                       ║ │
│  ║  │                │                                       ║ │
│  ║  │ • Understand   │                                       ║ │
│  ║  │ • Expand       │                                       ║ │
│  ║  │ • Generate     │                                       ║ │
│  ║  │   queries      │                                       ║ │
│  ║  └───────┬────────┘                                       ║ │
│  ║          │                                                 ║ │
│  ║          ▼                                                 ║ │
│  ║  ┌────────────────┐      ┌────────────────┐              ║ │
│  ║  │ RETRIEVAL      │◄────►│ VECTOR STORE   │              ║ │
│  ║  │ AGENT          │      │                │              ║ │
│  ║  │                │      │ Policy index   │              ║ │
│  ║  │ • Search       │      └────────────────┘              ║ │
│  ║  │ • Evaluate     │                                       ║ │
│  ║  │ • Iterate      │                                       ║ │
│  ║  └───────┬────────┘                                       ║ │
│  ║          │                                                 ║ │
│  ║          ▼                                                 ║ │
│  ║  ┌────────────────┐                                       ║ │
│  ║  │ ANALYSIS       │                                       ║ │
│  ║  │ AGENT          │                                       ║ │
│  ║  │                │                                       ║ │
│  ║  │ • Compare      │                                       ║ │
│  ║  │ • Reason       │                                       ║ │
│  ║  │ • Determine    │                                       ║ │
│  ║  └───────┬────────┘                                       ║ │
│  ║          │                                                 ║ │
│  ║          ▼                                                 ║ │
│  ║  ┌────────────────┐                                       ║ │
│  ║  │ VALIDATION     │                                       ║ │
│  ║  │ AGENT          │───► Invalid? ───► RETRY (max 3)      ║ │
│  ║  │                │                                       ║ │
│  ║  │ • Verify       │                                       ║ │
│  ║  │ • Check        │                                       ║ │
│  ║  └───────┬────────┘                                       ║ │
│  ║          │                                                 ║ │
│  ║          ▼                                                 ║ │
│  ║  ┌────────────────┐                                       ║ │
│  ║  │ FINDING        │                                       ║ │
│  ║  │ (if gap found) │                                       ║ │
│  ║  └────────────────┘                                       ║ │
│  ║                                                            ║ │
│  ╚═══════════════════════════════════════════════════════════╝ │
│                    │                                             │
│                    ▼                                             │
│         ┌─────────────────────┐                                 │
│         │   ALL FINDINGS      │                                 │
│         │   (5-15 gaps)       │                                 │
│         └──────────┬──────────┘                                 │
│                    │                                             │
│                    ▼                                             │
│         ┌─────────────────────┐                                 │
│         │  REPORT GENERATOR   │                                 │
│         │                     │                                 │
│         │  • Executive summary│                                 │
│         │  • Gap details      │                                 │
│         │  • Recommendations  │                                 │
│         └──────────┬──────────┘                                 │
│                    │                                             │
│         ┌──────────┼──────────┐                                 │
│         ▼          ▼          ▼                                 │
│    ┌────────┐ ┌────────┐ ┌────────┐                            │
│    │  PDF   │ │  DOCX  │ │  JSON  │                            │
│    │ Report │ │ Report │ │ Export │                            │
│    └────────┘ └────────┘ └────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 6. Technical Failure Modes

## 6.1 LLM Failures

| Failure | Cause | Impact | Mitigation |
|---------|-------|--------|------------|
| Hallucinated citations | LLM invents article numbers | False findings | Validation agent verifies all citations |
| Context window exceeded | Too much text | Truncation, missed info | Chunking strategy, summarization |
| Inconsistent output format | LLM ignores schema | Parse errors | Structured output, retry with guidance |
| Rate limiting | Too many API calls | Process stops | Exponential backoff, queuing |
| API timeout | Slow response | Hung process | Timeouts, async processing |
| Cost overrun | Too many tokens | Expensive | Token budgeting, caching |
| Model unavailable | API down | Cannot process | Fallback models, graceful degradation |

## 6.2 Embedding/Vector Store Failures

| Failure | Cause | Impact | Mitigation |
|---------|-------|--------|------------|
| Poor retrieval | Bad embeddings | Wrong sections found | Multiple embedding models, reranking |
| Missing relevant sections | Chunking issues | False gaps | Overlapping chunks, multiple searches |
| Semantic drift | Domain-specific terms | Mismatched concepts | Domain-tuned embeddings |
| Index corruption | Storage issues | Search fails | Persistence, recovery |
| Slow search | Large index | Poor UX | Approximate search, caching |

## 6.3 Document Processing Failures

| Failure | Cause | Impact | Mitigation |
|---------|-------|--------|------------|
| OCR errors | Scanned PDF | Garbled text | Multiple OCR engines, confidence scoring |
| Layout confusion | Complex PDF | Wrong reading order | Layout analysis, manual override |
| Encoding issues | Non-UTF8 | Corrupted characters | Encoding detection, conversion |
| Lost structure | Poor parsing | No section references | Multiple parsers, structure heuristics |
| Memory overflow | Large file | Crash | Streaming, size limits |

---

# 7. Functional Failure Modes

## 7.1 Analysis Logic Failures

| Failure | Scenario | Impact | Mitigation |
|---------|----------|--------|------------|
| **FALSE POSITIVE** | Reports gap that doesn't exist | User wastes time on non-issues | Validation agent, confidence thresholds |
| **FALSE NEGATIVE** | Misses real gap | Compliance risk | Exhaustive search, multiple query strategies |
| **Wrong severity** | Critical marked as Low | Misplaced priorities | Severity reasoning chain, calibration |
| **Wrong citation** | Cites wrong article | Confusing report | Citation verification step |
| **Semantic blindness** | "KYC" ≠ "Customer Due Diligence" | False gaps | Synonym expansion, domain knowledge |
| **Over-literal matching** | Needs exact phrase | Misses equivalent language | Semantic search, reasoning |
| **Cross-reference blindness** | Misses "as per Article 5" | Incomplete analysis | Cross-reference resolution |

## 7.2 Specific Scenarios That Can Fail

### Scenario 1: Scattered Requirements

```
PROBLEM:
Benchmark says:
- Page 5: "CDD measures shall include..."
- Page 23: "...as specified in Article 5..."
- Page 45: "The measures referred to in paragraph 1..."

Current system chunks each separately.
No single chunk has complete requirement.

FAILURE:
System sees partial requirement → searches policy → 
finds partial match → declares "Compliant" →
Actually missing key element on page 45

SOLUTION:
Requirement Extractor must:
1. Resolve all cross-references
2. Assemble complete requirement
3. Then analyze as unit
```

### Scenario 2: Policy Uses Different Structure

```
PROBLEM:
Benchmark structured by regulation:
- Article 1: Definitions
- Article 2: Scope
- Article 3: CDD

Policy structured by process:
- Chapter 1: Onboarding
- Chapter 2: Monitoring
- Chapter 3: Reporting

No 1:1 mapping possible.

FAILURE:
Search for "Article 3 CDD" finds nothing →
System reports "CDD missing" →
Actually covered across Chapters 1 and 2

SOLUTION:
Search by CONCEPT not STRUCTURE:
- "customer due diligence requirements"
- "identity verification"
- "beneficial owner identification"
```

### Scenario 3: Policy Is Stricter

```
PROBLEM:
Benchmark: "Review high-risk customers annually"
Policy: "Review ALL customers quarterly"

Policy is MORE compliant than required.

FAILURE:
Keyword search for "high-risk" + "annually" →
Exact phrase not found →
System reports gap

SOLUTION:
Analysis Agent must REASON:
- Requirement: annual review for high-risk
- Policy: quarterly review for all
- All includes high-risk
- Quarterly is more frequent than annual
- CONCLUSION: Compliant (exceeds requirement)
```

### Scenario 4: Implicit Compliance

```
PROBLEM:
Benchmark: "Implement a sanctions screening program"
Policy doesn't say "sanctions screening program"
But has:
- Section 4.1: "Screen all customers against OFAC list"
- Section 4.2: "Daily screening against UN sanctions"
- Section 4.3: "Automatic alerts for matches"

FAILURE:
Search for "sanctions screening program" →
Exact phrase not found →
System reports gap

SOLUTION:
Semantic understanding:
- OFAC list = sanctions list
- UN sanctions = sanctions list  
- Daily screening = ongoing program
- CONCLUSION: Compliant (implementation exists)
```

### Scenario 5: Regulatory Updates

```
PROBLEM:
Benchmark is AMLD6 (2024)
Policy was written for AMLD5 (2018)
New requirements in AMLD6 not in policy

FAILURE:
System cannot know which requirements are NEW
May not flag as high priority

SOLUTION:
- Requirement Extractor notes effective dates
- Flags "new in AMLD6" requirements
- Higher severity for recently added requirements
```

### Scenario 6: Jurisdiction Mismatch

```
PROBLEM:
User selects: Luxembourg
Benchmark: EU AMLD (applies to all EU)
Policy: References Belgian law specifics

FAILURE:
System doesn't detect jurisdiction mismatch
Analyzes Belgian policy against EU benchmark
Results are valid but not useful

SOLUTION:
- Pre-check: Does policy mention expected jurisdiction?
- Warn if mismatch detected
- Suggest correct benchmark
```

### Scenario 7: Multiple Applicable Regulations

```
PROBLEM:
Luxembourg AML requires compliance with:
- EU AMLD6
- Luxembourg AML Law
- CSSF Regulation 12-02
- FATF Recommendations

User uploads only AMLD6 as benchmark.

FAILURE:
Policy may comply with AMLD6 but not CSSF specifics.
System gives clean report.
Actual compliance status: Unknown for local requirements.

SOLUTION:
- Detect jurisdiction
- Warn about other applicable regulations
- Suggest additional benchmarks
- Or: maintain regulation registry
```

### Scenario 8: Ambiguous Requirements

```
PROBLEM:
Benchmark: "Appropriate measures shall be taken"
What is "appropriate"? Undefined.

FAILURE:
Any policy can claim "appropriate" measures
System cannot objectively assess
May approve or reject arbitrarily

SOLUTION:
- Flag ambiguous requirements
- Note in finding: "Requirement is subjective"
- Suggest: "Consider documenting rationale for measures chosen"
```

### Scenario 9: Technical vs Legal Language

```
PROBLEM:
Benchmark (legal): "The obliged entity shall ensure..."
Policy (technical): "The system will automatically..."

Same requirement, different registers.

FAILURE:
Embedding model trained on general text
Legal and technical language don't cluster well
Poor retrieval results

SOLUTION:
- Use domain-adapted embeddings
- Query expansion for both registers
- Explicit mapping: "obliged entity" = "the bank" = "we"
```

### Scenario 10: Version Control Issues

```
PROBLEM:
User uploads policy_v3_final_FINAL_v2.docx
Is this the current policy?
Or outdated?

FAILURE:
System analyzes outdated policy
Gaps may already be fixed in newer version
Wasted effort

SOLUTION:
- Extract document metadata (date, version)
- Warn if document appears old
- Ask user to confirm version
```

---

# 8. Edge Cases & Scenarios

## 8.1 Document Edge Cases

| Case | Description | Expected Behavior |
|------|-------------|-------------------|
| Empty document | User uploads blank PDF | Error: "Document appears empty" |
| Very short policy | 1-page policy | Warning: "Policy may be incomplete" |
| Very long policy | 500+ pages | Process with progress indicator, chunking |
| Image-only PDF | Scanned without OCR | Apply OCR, warn about quality |
| Password PDF | Encrypted | Ask for password or reject |
| Corrupted file | Invalid format | Error: "File could not be read" |
| Wrong file type | .exe uploaded | Error: "Unsupported file type" |
| Multiple languages | Mixed EN/DE content | Detect, process, warn about language |
| Non-Latin script | Arabic, Chinese | Use appropriate tokenizer |
| Tables heavy | Mostly tabular data | Special table extraction |

## 8.2 Analysis Edge Cases

| Case | Description | Expected Behavior |
|------|-------------|-------------------|
| 100% compliant | No gaps found | Report with confirmation, not error |
| 100% non-compliant | Policy irrelevant | Report ALL gaps, suggest different policy |
| Conflicting sections | Policy contradicts itself | Flag contradiction, report both |
| Outdated references | Policy cites old regulation | Flag as potential issue |
| No benchmark found | AI search fails | Ask for manual upload |
| Same document twice | Policy = Benchmark | Error: "Documents appear identical" |
| Partial upload | Document cut off | Warn: "Document may be incomplete" |

## 8.3 User Behavior Edge Cases

| Case | Description | Expected Behavior |
|------|-------------|-------------------|
| Wrong jurisdiction | Select NL, upload US policy | Warn about potential mismatch |
| Wrong domain | Select AML, policy is GDPR | Warn: "Policy appears unrelated to domain" |
| Cancel mid-process | User closes browser | Save state, allow resume |
| Rapid repeated runs | Submit same docs multiple times | Cache results, show previous |
| Very long session | Hours of usage | Session persistence, don't lose work |

---

# 9. Mitigation Strategies

## 9.1 Quality Assurance Layers

```
LAYER 1: INPUT VALIDATION
├── Document format verification
├── File size limits
├── Language detection
├── Structure detection
└── Early warning for problems

LAYER 2: PROCESSING SAFEGUARDS
├── Multiple parsing strategies
├── Fallback options
├── Progress tracking
├── Timeout handling
└── Error recovery

LAYER 3: ANALYSIS VERIFICATION
├── Multi-agent validation
├── Citation verification
├── Confidence scoring
├── Retry mechanisms
└── Human escalation option

LAYER 4: OUTPUT QUALITY
├── Completeness check
├── Actionability check
├── Consistency check
├── Format verification
└── User confirmation
```

## 9.2 Confidence Scoring System

```
CONFIDENCE CALCULATION:
═══════════════════════

For each finding:

Base confidence from retrieval:
├── High (0.9+): Multiple relevant sections found
├── Medium (0.7-0.9): Some relevant sections
├── Low (0.5-0.7): Weak matches only
└── Very Low (<0.5): No good matches

Adjusted by analysis:
├── +0.1: Clear requirement-policy mismatch
├── +0.1: Specific text evidence cited
├── -0.1: Semantic interpretation required
├── -0.1: Ambiguous requirement
└── -0.2: Cross-reference complexity

Final thresholds:
├── > 0.8: Include in report
├── 0.6-0.8: Include with "moderate confidence" flag
├── 0.4-0.6: Include with "low confidence - verify"
└── < 0.4: Exclude, log for review
```

## 9.3 Human-in-the-Loop Points

```
INTERVENTION POINTS:
═══════════════════════

1. AFTER REQUIREMENT EXTRACTION
   "We found 35 requirements. Review before analysis?"
   
2. FOR LOW-CONFIDENCE FINDINGS
   "We're unsure about this gap. Please verify."
   
3. FOR CRITICAL FINDINGS
   "Critical gap detected. Confirm before including?"
   
4. AFTER COMPLETE ANALYSIS
   "Analysis complete. Review findings before report?"
   
5. FOR AMBIGUOUS SITUATIONS
   "Policy could be interpreted either way. Your judgment?"
```

---

# 10. Project Structure

```
compliance-oracle/
│
├── README.md
├── requirements.txt
├── pyproject.toml
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
│
├── app.py                          # Streamlit entry point
│
├── src/
│   ├── __init__.py
│   │
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py             # Environment, constants
│   │   ├── prompts.py              # All LLM prompts
│   │   └── regulations.py          # Regulatory source registry
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── documents.py            # Document, Section, Chunk
│   │   ├── requirements.py         # Requirement, Obligation
│   │   ├── findings.py             # Finding, Gap, Recommendation
│   │   └── state.py                # Workflow state
│   │
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── base.py                 # Abstract parser
│   │   ├── pdf_parser.py           # PDF handling
│   │   ├── docx_parser.py          # Word handling
│   │   ├── html_parser.py          # Web/HTML handling
│   │   ├── text_parser.py          # Plain text
│   │   └── structure_extractor.py  # Section identification
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── embeddings.py           # Embedding generation
│   │   ├── vector_store.py         # Vector DB operations
│   │   └── llm_client.py           # LLM API wrapper
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base.py                 # Base agent class
│   │   ├── requirement_extractor.py
│   │   ├── query_agent.py
│   │   ├── retrieval_agent.py
│   │   ├── analysis_agent.py
│   │   └── validation_agent.py
│   │
│   ├── workflow/
│   │   ├── __init__.py
│   │   ├── graph.py                # LangGraph definition
│   │   ├── nodes.py                # Node functions
│   │   └── conditions.py           # Edge conditions
│   │
│   ├── reporting/
│   │   ├── __init__.py
│   │   ├── pdf_generator.py
│   │   ├── docx_generator.py
│   │   └── json_exporter.py
│   │
│   └── utils/
│       ├── __init__.py
│       ├── text.py                 # Text processing
│       ├── decorators.py           # Retry, timing, etc.
│       └── logging.py              # Structured logging
│
├── ui/
│   ├── __init__.py
│   ├── styles.py                   # All CSS
│   ├── components/
│   │   ├── __init__.py
│   │   ├── header.py
│   │   ├── sidebar.py
│   │   ├── file_upload.py
│   │   ├── progress.py
│   │   └── findings_display.py
│   └── pages/
│       ├── __init__.py
│       ├── home.py
│       ├── analysis.py
│       └── results.py
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # Fixtures
│   ├── test_parsers/
│   ├── test_agents/
│   ├── test_workflow/
│   └── fixtures/
│       ├── sample_policy.pdf
│       ├── sample_policy.docx
│       └── sample_benchmark.pdf
│
└── scripts/
    ├── setup_dev.sh
    └── run_tests.sh
```

---

# 11. Implementation Phases

## Phase 1: Foundation (Week 1)
```
├── Project structure setup
├── Document parsers (PDF, DOCX)
├── Basic text extraction
├── Structure extraction
└── Unit tests for parsers
```

## Phase 2: Core Agents (Week 2)
```
├── Requirement Extractor Agent
├── Query Understanding Agent
├── Basic retrieval (single-shot first)
├── Vector store integration
└── Agent unit tests
```

## Phase 3: Agentic Loop (Week 3)
```
├── Adaptive Retrieval Agent (iterative)
├── Analysis Agent with reasoning
├── Validation Agent
├── LangGraph workflow
└── Integration tests
```

## Phase 4: UI & Reporting (Week 4)
```
├── Streamlit interface
├── Progress tracking
├── PDF/DOCX report generation
├── Error handling & UX
└── End-to-end tests
```

## Phase 5: Polish & Deploy (Week 5)
```
├── Edge case handling
├── Performance optimization
├── Documentation
├── Deployment setup
└── User testing
```

---

# Summary

This document outlines a complete redesign of the Compliance Oracle using Agentic RAG principles. Key improvements:

1. **Multi-format document support** (not just PDF)
2. **Intelligent requirement extraction** (not dumb chunking)
3. **Iterative retrieval** (not single-shot)
4. **Reasoning-based analysis** (not keyword matching)
5. **Self-validation** (not blind output)
6. **Comprehensive failure mode coverage**

The system is designed to handle real-world complexity while providing actionable, well-cited compliance gap findings.
# Compliance Oracle v3.0 - Complete Specification (Part 2)
## Configuration, Implementation & Deployment

---

# 15. Configuration Files

## 15.1 requirements.txt

```
# Core
streamlit>=1.28.0
python-dotenv>=1.0.0
pydantic>=2.0.0
pydantic-settings>=2.0.0

# LLM & AI
langchain>=0.1.0
langchain-openai>=0.0.5
langchain-anthropic>=0.1.0
langchain-community>=0.0.10
langchain-chroma>=0.1.0
langgraph>=0.0.20
openai>=1.0.0
anthropic>=0.18.0

# Document Processing
pypdf>=3.0.0
python-docx>=0.8.11
beautifulsoup4>=4.12.0
striprtf>=0.0.26
openpyxl>=3.1.0

# OCR (optional)
pytesseract>=0.3.10
pdf2image>=1.16.0

# NLP & Language
langdetect>=1.0.9
deep-translator>=1.11.0

# Vector Store
chromadb>=0.4.0
sentence-transformers>=2.2.0

# Reporting
reportlab>=4.0.0
pandas>=2.0.0

# Utilities
aiohttp>=3.9.0
tenacity>=8.2.0
structlog>=23.0.0
cryptography>=3.1
```

## 15.2 .env.example

```bash
# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AZURE_OPENAI_KEY=
AZURE_OPENAI_ENDPOINT=

# Default Configuration
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o-mini
DEFAULT_TEMPERATURE=0.2

# Feature Flags
ENABLE_OCR=true
ENABLE_TRANSLATION=true
ENABLE_CACHING=true

# Limits
MAX_FILE_SIZE_MB=50
MAX_PAGES=500
MAX_REQUIREMENTS=100

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
```

## 15.3 Multilingual Keywords Configuration (keywords.py)

```python
MULTILINGUAL_KEYWORDS = {
    "AML": {
        "name": {
            "en": "Anti-Money Laundering",
            "de": "Geldwäscheprävention", 
            "fr": "Lutte contre le blanchiment",
            "nl": "Anti-witwassen",
            "lu": "Géigewäschbekämpfung"
        },
        "keywords": {
            "en": [
                "anti-money laundering", "AML", "money laundering",
                "ML/TF", "financial crime", "proceeds of crime",
                "laundering", "illicit funds"
            ],
            "de": [
                "Geldwäsche", "GwG", "Geldwäschegesetz",
                "Geldwäschebekämpfung", "Geldwäscheprävention",
                "Terrorismusfinanzierung"
            ],
            "fr": [
                "blanchiment", "LCB-FT", "lutte contre le blanchiment",
                "blanchiment de capitaux", "LAB", "blanchiment d'argent"
            ],
            "nl": [
                "witwassen", "Wwft", "anti-witwassen",
                "witwasbestrijding", "witwaswet", "witwaspraktijken"
            ],
            "lu": [
                "Blanchiment", "blanchiment d'argent", "LBC"
            ]
        },
        "regulations": {
            "EU": ["AMLD4", "AMLD5", "AMLD6", "2015/849", "2018/843", "2024/1640"],
            "DE": ["GwG", "Geldwäschegesetz"],
            "FR": ["Code monétaire et financier", "L561"],
            "NL": ["Wwft", "Wet ter voorkoming van witwassen"],
            "LU": ["Loi AML", "Loi du 12 novembre 2004"]
        }
    },
    
    "KYC": {
        "name": {
            "en": "Know Your Customer",
            "de": "Kenne deinen Kunden",
            "fr": "Connaissance du client",
            "nl": "Ken uw klant",
            "lu": "Connaissance du client"
        },
        "keywords": {
            "en": [
                "know your customer", "KYC", "customer identification",
                "CIP", "identity verification", "customer onboarding",
                "ID verification", "identity check"
            ],
            "de": [
                "Kundenidentifizierung", "KYC", "Identifizierung",
                "Legitimationsprüfung", "Kundenkenntnis", "Identitätsprüfung"
            ],
            "fr": [
                "connaissance client", "KYC", "identification client",
                "vérification d'identité", "identification du client"
            ],
            "nl": [
                "cliëntidentificatie", "KYC", "ken uw klant",
                "cliëntenonderzoek", "identificatie", "identiteitsverificatie"
            ],
            "lu": [
                "identification client", "KYC", "connaissance client"
            ]
        }
    },
    
    "CDD": {
        "name": {
            "en": "Customer Due Diligence",
            "de": "Kundensorgfaltspflichten",
            "fr": "Devoir de vigilance",
            "nl": "Cliëntenonderzoek",
            "lu": "Vigilance client"
        },
        "keywords": {
            "en": [
                "customer due diligence", "CDD", "due diligence",
                "standard due diligence", "SDD", "simplified due diligence",
                "ongoing due diligence", "ongoing monitoring"
            ],
            "de": [
                "Sorgfaltspflichten", "CDD", "Kundensorgfaltspflichten",
                "verstärkte Sorgfaltspflichten", "vereinfachte Sorgfaltspflichten",
                "allgemeine Sorgfaltspflichten"
            ],
            "fr": [
                "vigilance", "obligation de vigilance", "mesures de vigilance",
                "vigilance simplifiée", "vigilance renforcée", "devoir de vigilance"
            ],
            "nl": [
                "cliëntenonderzoek", "CDD", "verscherpt cliëntenonderzoek",
                "vereenvoudigd cliëntenonderzoek", "doorlopend cliëntenonderzoek"
            ],
            "lu": [
                "vigilance", "diligence", "mesures de vigilance"
            ]
        }
    },
    
    "EDD": {
        "name": {
            "en": "Enhanced Due Diligence",
            "de": "Verstärkte Sorgfaltspflichten",
            "fr": "Vigilance renforcée",
            "nl": "Verscherpt cliëntenonderzoek",
            "lu": "Vigilance renforcée"
        },
        "keywords": {
            "en": [
                "enhanced due diligence", "EDD", "enhanced measures",
                "high risk customer", "high-risk", "enhanced scrutiny"
            ],
            "de": [
                "verstärkte Sorgfaltspflichten", "EDD", "erhöhte Sorgfalt",
                "Hochrisiko-Kunde", "erhöhtes Risiko", "verstärkte Maßnahmen"
            ],
            "fr": [
                "vigilance renforcée", "mesures renforcées",
                "client à haut risque", "risque élevé", "vigilance accrue"
            ],
            "nl": [
                "verscherpt cliëntenonderzoek", "EDD", "verhoogd risico",
                "hoog-risico klant", "verscherpte maatregelen"
            ],
            "lu": [
                "vigilance renforcée", "risque élevé", "mesures renforcées"
            ]
        }
    },
    
    "UBO": {
        "name": {
            "en": "Ultimate Beneficial Owner",
            "de": "Wirtschaftlich Berechtigter",
            "fr": "Bénéficiaire effectif",
            "nl": "Uiteindelijk belanghebbende",
            "lu": "Bénéficiaire effectif"
        },
        "keywords": {
            "en": [
                "beneficial owner", "UBO", "ultimate beneficial owner",
                "beneficial ownership", "controlling person", "25%",
                "ownership structure", "control structure"
            ],
            "de": [
                "wirtschaftlich Berechtigter", "UBO", "wirtschaftliche Berechtigung",
                "Begünstigter", "25%", "25 Prozent", "Eigentümerstruktur"
            ],
            "fr": [
                "bénéficiaire effectif", "UBO", "propriétaire effectif",
                "ayant droit économique", "25%", "structure de propriété"
            ],
            "nl": [
                "uiteindelijk belanghebbende", "UBO", "uiteindelijke begunstigde",
                "25%", "eigendomsstructuur"
            ],
            "lu": [
                "bénéficiaire effectif", "ayant droit économique", "25%"
            ]
        }
    },
    
    "PEP": {
        "name": {
            "en": "Politically Exposed Person",
            "de": "Politisch exponierte Person",
            "fr": "Personne politiquement exposée",
            "nl": "Politiek prominent persoon",
            "lu": "Personne politiquement exposée"
        },
        "keywords": {
            "en": [
                "politically exposed person", "PEP", "PEPs",
                "senior political figure", "domestic PEP", "foreign PEP",
                "family member of PEP", "close associate"
            ],
            "de": [
                "politisch exponierte Person", "PEP", "PeP",
                "politisch exponiert", "inländische PEP", "ausländische PEP"
            ],
            "fr": [
                "personne politiquement exposée", "PPE", "PEP",
                "personne exposée politiquement", "PPE nationale"
            ],
            "nl": [
                "politiek prominent persoon", "PEP", "politiek prominente persoon",
                "binnenlandse PEP", "buitenlandse PEP"
            ],
            "lu": [
                "personne politiquement exposée", "PPE"
            ]
        }
    },
    
    "SANCTIONS": {
        "name": {
            "en": "Sanctions Compliance",
            "de": "Sanktions-Compliance",
            "fr": "Conformité aux sanctions",
            "nl": "Sanctie-compliance",
            "lu": "Conformité aux sanctions"
        },
        "keywords": {
            "en": [
                "sanctions", "sanctions screening", "OFAC", "SDN list",
                "embargo", "restricted party", "blocked person", 
                "sanctions list", "EU sanctions", "UN sanctions"
            ],
            "de": [
                "Sanktionen", "Sanktionsprüfung", "Embargo",
                "Sanktionsliste", "Finanzsanktionen", "EU-Sanktionen",
                "UN-Sanktionen", "Sanktionslistenprüfung"
            ],
            "fr": [
                "sanctions", "gel des avoirs", "embargo",
                "liste des sanctions", "mesures restrictives",
                "sanctions européennes", "sanctions ONU"
            ],
            "nl": [
                "sancties", "sanctiescreening", "embargo",
                "sanctielijst", "bevriezing van tegoeden",
                "EU-sancties", "VN-sancties"
            ],
            "lu": [
                "sanctions", "embargo", "gel des avoirs", "mesures restrictives"
            ]
        }
    },
    
    "STR": {
        "name": {
            "en": "Suspicious Transaction Reporting",
            "de": "Verdachtsmeldung",
            "fr": "Déclaration de soupçon",
            "nl": "Ongebruikelijke transactie melding",
            "lu": "Déclaration de soupçon"
        },
        "keywords": {
            "en": [
                "suspicious transaction report", "STR", "SAR",
                "suspicious activity report", "reporting obligation",
                "FIU", "financial intelligence unit", "unusual transaction"
            ],
            "de": [
                "Verdachtsmeldung", "Verdachtsanzeige", "SAR",
                "Geldwäscheverdacht", "FIU", "Zentralstelle",
                "Meldepflicht", "verdächtige Transaktion"
            ],
            "fr": [
                "déclaration de soupçon", "DOS", "TRACFIN",
                "obligation de déclaration", "cellule de renseignement",
                "transaction suspecte"
            ],
            "nl": [
                "ongebruikelijke transactie", "MOT", "FIU-Nederland",
                "meldplicht", "verdachte transactie", "meldingsplicht"
            ],
            "lu": [
                "déclaration de soupçon", "CRF", "cellule de renseignement"
            ]
        }
    }
}
```

## 15.4 Model Registry Configuration (models.py)

```python
MODEL_REGISTRY = {
    "openai": {
        "models": {
            "gpt-4o": {
                "display_name": "GPT-4o",
                "description": "Most capable OpenAI model",
                "cost_per_1k_input": 0.005,
                "cost_per_1k_output": 0.015,
                "speed_rating": 3,
                "quality_rating": 5,
                "context_window": 128000,
                "recommended_for": ["critical_audit", "complex_analysis"]
            },
            "gpt-4o-mini": {
                "display_name": "GPT-4o Mini",
                "description": "Best balance of cost and quality",
                "cost_per_1k_input": 0.00015,
                "cost_per_1k_output": 0.0006,
                "speed_rating": 5,
                "quality_rating": 4,
                "context_window": 128000,
                "recommended_for": ["standard_analysis"],
                "is_default": True
            },
            "gpt-4-turbo": {
                "display_name": "GPT-4 Turbo",
                "description": "High capability, large context",
                "cost_per_1k_input": 0.01,
                "cost_per_1k_output": 0.03,
                "speed_rating": 3,
                "quality_rating": 5,
                "context_window": 128000,
                "recommended_for": ["large_documents"]
            },
            "gpt-3.5-turbo": {
                "display_name": "GPT-3.5 Turbo",
                "description": "Fast and cheap, lower accuracy",
                "cost_per_1k_input": 0.0005,
                "cost_per_1k_output": 0.0015,
                "speed_rating": 5,
                "quality_rating": 3,
                "context_window": 16385,
                "recommended_for": ["testing", "development"],
                "warning": "Not recommended for production"
            }
        }
    },
    "anthropic": {
        "models": {
            "claude-3-5-sonnet-20241022": {
                "display_name": "Claude 3.5 Sonnet",
                "description": "Excellent reasoning, good for legal text",
                "cost_per_1k_input": 0.003,
                "cost_per_1k_output": 0.015,
                "speed_rating": 4,
                "quality_rating": 5,
                "context_window": 200000,
                "recommended_for": ["legal_analysis", "complex_reasoning"]
            },
            "claude-3-opus-20240229": {
                "display_name": "Claude 3 Opus",
                "description": "Best reasoning, highest accuracy",
                "cost_per_1k_input": 0.015,
                "cost_per_1k_output": 0.075,
                "speed_rating": 1,
                "quality_rating": 5,
                "context_window": 200000,
                "recommended_for": ["highest_accuracy"]
            },
            "claude-3-haiku-20240307": {
                "display_name": "Claude 3 Haiku",
                "description": "Fast and affordable",
                "cost_per_1k_input": 0.00025,
                "cost_per_1k_output": 0.00125,
                "speed_rating": 5,
                "quality_rating": 3,
                "context_window": 200000,
                "recommended_for": ["testing", "simple_tasks"]
            }
        }
    },
    "ollama": {
        "models": {
            "llama3.1:70b": {
                "display_name": "Llama 3.1 70B",
                "description": "Large local model, requires GPU",
                "cost_per_1k_input": 0,
                "cost_per_1k_output": 0,
                "speed_rating": 2,
                "quality_rating": 4,
                "context_window": 131072,
                "recommended_for": ["offline", "privacy"],
                "requirements": "Requires 48GB+ VRAM"
            },
            "llama3.1:8b": {
                "display_name": "Llama 3.1 8B",
                "description": "Small local model",
                "cost_per_1k_input": 0,
                "cost_per_1k_output": 0,
                "speed_rating": 4,
                "quality_rating": 3,
                "context_window": 131072,
                "recommended_for": ["testing", "local"]
            }
        }
    }
}
```

## 15.5 Jurisdiction Configuration (jurisdictions.py)

```python
JURISDICTION_REGISTRY = {
    "EU": {
        "name": "European Union",
        "flag": "🇪🇺",
        "primary_language": "en",
        "supported_languages": ["en", "de", "fr", "nl"],
        "is_supranational": True,
        "benchmarks": {
            "AML": {
                "primary": {
                    "name": "AMLD6",
                    "full_name": "6th Anti-Money Laundering Directive",
                    "citation": "Directive (EU) 2024/1640",
                    "url": "https://eur-lex.europa.eu/eli/dir/2024/1640/oj"
                },
                "secondary": [
                    {
                        "name": "AMLD5",
                        "citation": "Directive (EU) 2018/843",
                        "url": "https://eur-lex.europa.eu/eli/dir/2018/843/oj"
                    }
                ]
            },
            "GDPR": {
                "primary": {
                    "name": "GDPR",
                    "full_name": "General Data Protection Regulation",
                    "citation": "Regulation (EU) 2016/679",
                    "url": "https://eur-lex.europa.eu/eli/reg/2016/679/oj"
                }
            },
            "SANCTIONS": {
                "primary": {
                    "name": "EU Sanctions Framework",
                    "full_name": "EU Restrictive Measures",
                    "url": "https://www.sanctionsmap.eu/"
                }
            }
        }
    },
    
    "LU": {
        "name": "Luxembourg",
        "flag": "🇱🇺",
        "primary_language": "fr",
        "supported_languages": ["fr", "de", "lu", "en"],
        "inherit_from": "EU",
        "benchmarks": {
            "AML": {
                "primary": {
                    "name": "Luxembourg AML Law",
                    "full_name": "Loi du 12 novembre 2004",
                    "citation": "Loi du 12 novembre 2004",
                    "url": "https://legilux.public.lu/eli/etat/leg/loi/2004/11/12/n1/jo"
                },
                "secondary": [
                    {
                        "name": "CSSF Regulation 12-02",
                        "citation": "CSSF Reg. 12-02",
                        "url": "https://www.cssf.lu/en/Document/cssf-regulation-n-12-02/"
                    },
                    {
                        "name": "Grand-Ducal Regulation",
                        "citation": "RGD 1 février 2010",
                        "url": "https://legilux.public.lu/eli/etat/leg/rgd/2010/02/01/n1/jo"
                    }
                ]
            }
        },
        "regulator": {
            "name": "CSSF",
            "full_name": "Commission de Surveillance du Secteur Financier",
            "url": "https://www.cssf.lu/"
        }
    },
    
    "NL": {
        "name": "Netherlands",
        "flag": "🇳🇱",
        "primary_language": "nl",
        "supported_languages": ["nl", "en"],
        "inherit_from": "EU",
        "benchmarks": {
            "AML": {
                "primary": {
                    "name": "Wwft",
                    "full_name": "Wet ter voorkoming van witwassen en financieren van terrorisme",
                    "citation": "Wwft",
                    "url": "https://wetten.overheid.nl/BWBR0024282/"
                },
                "secondary": [
                    {
                        "name": "DNB Guidance",
                        "citation": "DNB Leidraad Wwft",
                        "url": "https://www.dnb.nl/en/sector-information/"
                    }
                ]
            }
        },
        "regulator": {
            "name": "DNB",
            "full_name": "De Nederlandsche Bank",
            "url": "https://www.dnb.nl/"
        }
    },
    
    "DE": {
        "name": "Germany",
        "flag": "🇩🇪",
        "primary_language": "de",
        "supported_languages": ["de", "en"],
        "inherit_from": "EU",
        "benchmarks": {
            "AML": {
                "primary": {
                    "name": "GwG",
                    "full_name": "Geldwäschegesetz",
                    "citation": "GwG",
                    "url": "https://www.gesetze-im-internet.de/gwg_2017/"
                },
                "secondary": [
                    {
                        "name": "BaFin AML Guidelines",
                        "citation": "BaFin Auslegungs- und Anwendungshinweise",
                        "url": "https://www.bafin.de/"
                    }
                ]
            }
        },
        "regulator": {
            "name": "BaFin",
            "full_name": "Bundesanstalt für Finanzdienstleistungsaufsicht",
            "url": "https://www.bafin.de/"
        }
    },
    
    "FR": {
        "name": "France",
        "flag": "🇫🇷",
        "primary_language": "fr",
        "supported_languages": ["fr", "en"],
        "inherit_from": "EU",
        "benchmarks": {
            "AML": {
                "primary": {
                    "name": "CMF AML",
                    "full_name": "Code monétaire et financier - LCB-FT",
                    "citation": "CMF L561-1 et seq.",
                    "url": "https://www.legifrance.gouv.fr/"
                }
            }
        },
        "regulator": {
            "name": "ACPR",
            "full_name": "Autorité de contrôle prudentiel et de résolution",
            "url": "https://acpr.banque-france.fr/"
        }
    },
    
    "UK": {
        "name": "United Kingdom",
        "flag": "🇬🇧",
        "primary_language": "en",
        "supported_languages": ["en"],
        "inherit_from": None,
        "benchmarks": {
            "AML": {
                "primary": {
                    "name": "MLR 2017",
                    "full_name": "Money Laundering Regulations 2017",
                    "citation": "MLR 2017",
                    "url": "https://www.legislation.gov.uk/uksi/2017/692/"
                },
                "secondary": [
                    {
                        "name": "FCA Guidance",
                        "citation": "FCA FC Guide",
                        "url": "https://www.fca.org.uk/publication/finalised-guidance/fg-final-guidance-financial-crime-guide.pdf"
                    }
                ]
            }
        },
        "regulator": {
            "name": "FCA",
            "full_name": "Financial Conduct Authority",
            "url": "https://www.fca.org.uk/"
        }
    },
    
    "US": {
        "name": "United States",
        "flag": "🇺🇸",
        "primary_language": "en",
        "supported_languages": ["en"],
        "inherit_from": None,
        "benchmarks": {
            "AML": {
                "primary": {
                    "name": "BSA/AML",
                    "full_name": "Bank Secrecy Act / Anti-Money Laundering",
                    "citation": "31 USC 5311 et seq.",
                    "url": "https://www.fincen.gov/resources/statutes-and-regulations"
                },
                "secondary": [
                    {
                        "name": "FinCEN CDD Rule",
                        "citation": "31 CFR 1010.230",
                        "url": "https://www.fincen.gov/resources/statutes-regulations/guidance/"
                    },
                    {
                        "name": "FFIEC BSA/AML Manual",
                        "citation": "FFIEC Manual",
                        "url": "https://bsaaml.ffiec.gov/manual"
                    }
                ]
            },
            "SANCTIONS": {
                "primary": {
                    "name": "OFAC Regulations",
                    "full_name": "Office of Foreign Assets Control Regulations",
                    "citation": "31 CFR Chapter V",
                    "url": "https://ofac.treasury.gov/"
                }
            }
        },
        "regulator": {
            "name": "FinCEN",
            "full_name": "Financial Crimes Enforcement Network",
            "url": "https://www.fincen.gov/"
        }
    }
}
```

---

# 16. Implementation Checklist

## 16.1 Pre-Implementation Verification

```
BEFORE CODING, CONFIRM:
═══════════════════════════════════════════════════════════

DOCUMENT SUPPORT:
☑ PDF (native) - PyMuPDF
☑ PDF (scanned) - Tesseract OCR
☑ DOCX - python-docx
☑ DOC - LibreOffice conversion
☑ TXT - Native
☑ HTML - BeautifulSoup
☑ URL fetch - requests

LANGUAGE SUPPORT:
☑ English (full)
☑ German (full)
☑ French (full)
☑ Dutch (full)
☑ Luxembourgish (basic)
☑ Auto-detection
☑ Translation fallback

DOMAIN SUPPORT:
☑ Single selection
☑ Multi-selection (checkboxes)
☑ Custom domain input
☑ Auto-detection from documents

JURISDICTION SUPPORT:
☑ EU (supranational)
☑ Luxembourg
☑ Netherlands
☑ Germany
☑ France
☑ UK
☑ US
☑ Inheritance (local + EU)

MODEL SUPPORT:
☑ OpenAI (GPT-4o, GPT-4o-mini, GPT-3.5)
☑ Anthropic (Claude 3.5 Sonnet, Opus, Haiku)
☑ Ollama (local models)
☑ Dropdown selection (not text input)
☑ Cost estimation
☑ API key validation

UI REQUIREMENTS:
☑ Provider dropdown
☑ Model dropdown
☑ Jurisdiction dropdown with flags
☑ Domain checkboxes
☑ Language auto-detect + override
☑ Progress indicator
☑ Live log
☑ Results filtering
☑ Export buttons

AGENTIC RAG:
☑ Query Understanding Agent
☑ Adaptive Retrieval Agent
☑ Analysis Agent with reasoning
☑ Validation Agent
☑ Iterative search
☑ Self-correction
☑ Citation verification

OUTPUT:
☑ PDF report
☑ DOCX report
☑ JSON export
☑ Excel export
☑ Findings by domain
☑ Findings by severity
☑ Recommendations
```

---

# 17. Summary

This specification document provides complete requirements for Compliance Oracle v3.0:

1. **Multi-format document support** (PDF, DOCX, HTML, TXT)
2. **Multilingual support** (EN, DE, FR, NL, LU with auto-detection)
3. **Multi-domain analysis** (checkbox selection + custom)
4. **Multi-jurisdiction support** (with inheritance from EU)
5. **Agentic RAG architecture** (iterative, self-correcting)
6. **Complete UI specification** (dropdowns, not text inputs)
7. **Comprehensive configuration files** (keywords, models, jurisdictions)
8. **Failure mode analysis** (with mitigations)
9. **Implementation phases** (6 weeks)
10. **Testing strategy** (unit, integration, E2E)

**Total specification: ~100 pages of requirements**

Ready for implementation.
