"""
Dutch Legal AI Pipeline Worker

A production-grade pipeline for processing Dutch legal documents:
- Extraction: LlamaCloud (upload once, retry parse only)
- Indexing: PageIndex with add_node_summary=False (no double cost)
- Enrichment: OpenAI summaries added after indexing
- Query: Cached PageIndex with OpenAI
"""

__version__ = "1.0.0"
