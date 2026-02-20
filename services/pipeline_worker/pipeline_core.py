"""
Core Dutch Legal AI Pipeline implementation.
- LlamaCloud: one-time extraction (paid)
- PageIndex (VectifyAI): indexing + querying (uses OpenAI model)
- Enrichment: OpenAI summaries added AFTER indexing (PageIndex node summaries disabled)
- Produces a portable master JSON after one-time run
"""
import os
import asyncio
import json
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import concurrent.futures

import tqdm
import tqdm.asyncio
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential

from settings import get_settings
from paths import MatterPaths, get_matter_paths
from logging_utils import StructuredLogHandler, PipelineStep
from jobs import Job, compute_file_hash

# Try to import optional dependencies - handle mock mode gracefully
try:
    from llama_cloud import LlamaCloud
    LLAMA_CLOUD_AVAILABLE = True
except ImportError:
    LLAMA_CLOUD_AVAILABLE = False

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from pageindex import PageIndex
    PAGEINDEX_AVAILABLE = True
    import pageindex
    print(f"PageIndex version: {pageindex.__version__}")
except ImportError:
    PAGEINDEX_AVAILABLE = False


# Global query cache: matter_id -> PageIndex instance
_PI_CACHE: Dict[str, Any] = {}

# Global clients
_client_openai: Optional[Any] = None
_client_llama: Optional[Any] = None


def get_openai_client():
    """Get or create OpenAI client."""
    global _client_openai
    if _client_openai is None and OPENAI_AVAILABLE:
        settings = get_settings()
        _client_openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client_openai


def get_llama_client():
    """Get or create LlamaCloud client."""
    global _client_llama
    if _client_llama is None and LLAMA_CLOUD_AVAILABLE:
        settings = get_settings()
        _client_llama = LlamaCloud(api_key=settings.LLAMA_CLOUD_API_KEY)
    return _client_llama


# -------------------------
# SECTION 1: Extraction (LlamaCloud) - Async, Upload Once, Retry Parse Only
# -------------------------
async def extract_document(
    pdf_path: Path,
    paths: MatterPaths,
    logger: Optional[StructuredLogHandler] = None
) -> Dict[str, Any]:
    """
    Extract text from a PDF using LlamaCloud.
    Uploads once, retries parse only.
    """
    settings = get_settings()
    
    # Compute file hash for idempotency
    if logger:
        logger.debug(PipelineStep.EXTRACT, f"Computing hash for {pdf_path.name}")
    
    file_hash = compute_file_hash(pdf_path)
    output_path = paths.get_parse_path(pdf_path.name)
    
    # Check if already extracted
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("hash") == file_hash:
                if logger:
                    logger.info(PipelineStep.EXTRACT, f"Skipping extraction (cached): {pdf_path.name}", details={"hash": file_hash[:8]})
                return data
        except (json.JSONDecodeError, KeyError):
            # Corrupted cache, re-extract
            pass
    
    if settings.AI_MOCK_MODE:
        # Mock extraction for testing
        if logger:
            logger.info(PipelineStep.EXTRACT, f"Mock extraction: {pdf_path.name}")
        
        data: Dict[str, Any] = {
            "path": str(pdf_path),
            "hash": file_hash,
            "created_at": datetime.utcnow().isoformat(),
            "markdown": f"# Mock Document: {pdf_path.name}\n\nThis is mock content for testing purposes.",
            "text": f"Mock Document: {pdf_path.name}\n\nThis is mock content for testing purposes.",
            "items": [],
            "mock": True,
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return data
    
    if not LLAMA_CLOUD_AVAILABLE:
        raise RuntimeError("LlamaCloud not available and not in mock mode")
    
    client_llama = get_llama_client()
    if not client_llama:
        raise RuntimeError("Failed to initialize LlamaCloud client")
    
    if logger:
        logger.info(PipelineStep.EXTRACT, f"Uploading to LlamaCloud: {pdf_path.name}")
    
    # Upload ONCE (outside retry)
    with open(pdf_path, "rb") as f:
        file_obj = await client_llama.files.create(file=f, purpose="parse")
    
    if logger:
        logger.info(PipelineStep.EXTRACT, f"Parsing with LlamaCloud: {pdf_path.name}")
    
    # Retry ONLY parse
    result = None
    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(settings.RETRY_ATTEMPTS),
        wait=wait_exponential(min=2, max=10),
        reraise=True,
    ):
        with attempt:
            result = await client_llama.parsing.parse(
                file_id=file_obj.id,
                tier=settings.LLAMA_PARSE_TIER,
                version=settings.LLAMA_PARSE_VERSION,
                processing_options={"ocr_parameters": {"languages": settings.LLAMA_OCR_LANGUAGES}},
                output_options={"markdown": {"tables": {"output_tables_as_markdown": True}}},
                expand=["text", "markdown", "items"],
                parsing_instruction=(
                    "Extract as hierarchical Markdown with sections/subsections preserved. "
                    "Preserve tables exactly. Keep clause numbering intact (e.g., 1, 1.1, 1.1.1). "
                    "Retain definitions, obligations, exceptions, case references, and footnotes."
                ),
            )
            break
    
    if result is None:
        raise RuntimeError(f"Extraction failed after retries: {pdf_path}")
    
    data = {
        "path": str(pdf_path),
        "hash": file_hash,
        "created_at": datetime.utcnow().isoformat(),
        "markdown": getattr(result, "markdown", "") or "",
        "text": getattr(result, "text", "") or "",
        "items": getattr(result, "items", []) or [],
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    if logger:
        logger.info(PipelineStep.EXTRACT, f"Extraction complete: {pdf_path.name}", details={"hash": file_hash[:8]})
    
    return data


async def extract_all(
    paths: MatterPaths,
    document_ids: Optional[List[str]] = None,
    logger: Optional[StructuredLogHandler] = None,
    max_concurrent: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Extract all PDFs in the matter's uploads directory.
    If document_ids is provided, only extract those documents.
    """
    settings = get_settings()
    max_concurrent = max_concurrent or settings.MAX_CONCURRENT
    
    # Get PDFs to process
    if document_ids:
        pdfs = []
        for doc_id in document_ids:
            pdf_path = paths.uploads_dir / doc_id
            if pdf_path.exists():
                pdfs.append(pdf_path)
            else:
                # Try with .pdf extension
                pdf_path = paths.uploads_dir / f"{doc_id}.pdf"
                if pdf_path.exists():
                    pdfs.append(pdf_path)
    else:
        pdfs = paths.list_pdfs()
    
    if not pdfs:
        if logger:
            logger.warning(PipelineStep.EXTRACT, "No PDFs found to extract")
        return []
    
    if logger:
        logger.info(PipelineStep.EXTRACT, f"Starting extraction of {len(pdfs)} documents")
    
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def bounded_extract(pdf: Path):
        async with semaphore:
            return await extract_document(pdf, paths, logger)
    
    tasks = [asyncio.create_task(bounded_extract(pdf)) for pdf in pdfs]
    extracted: List[Dict[str, Any]] = []
    
    for i, fut in enumerate(tqdm.asyncio.tqdm.as_completed(tasks, desc="Extracting", disable=logger is not None)):
        try:
            result = await fut
            extracted.append(result)
            if logger:
                progress = ((i + 1) / len(tasks)) * 25  # 25% of total pipeline
                logger.info(PipelineStep.EXTRACT, f"Extracted {result.get('path', 'unknown')}", progress)
        except Exception as e:
            if logger:
                logger.error(PipelineStep.EXTRACT, f"Extraction failed: {e}")
            raise
    
    return extracted


# -------------------------
# SECTION 2: Indexing (PageIndex) - ThreadPool, Node summaries disabled
# -------------------------
def index_document(
    extracted: Dict[str, Any],
    paths: MatterPaths,
    logger: Optional[StructuredLogHandler] = None
) -> Path:
    """
    Index a document using PageIndex.
    Node summaries are disabled to avoid double cost with OpenAI enrichment.
    """
    settings = get_settings()
    
    doc_name = Path(extracted["path"]).name
    out_path = paths.get_tree_path(doc_name)
    
    # Check if already indexed
    if out_path.exists():
        # Verify hash matches
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                tree_dict = json.load(f)
            stored_hash = tree_dict.get("metadata", {}).get("hash")
            if stored_hash == extracted.get("hash"):
                if logger:
                    logger.info(PipelineStep.INDEX, f"Skipping indexing (cached): {doc_name}")
                return out_path
        except (json.JSONDecodeError, KeyError):
            pass
    
    if settings.AI_MOCK_MODE:
        # Mock indexing
        if logger:
            logger.info(PipelineStep.INDEX, f"Mock indexing: {doc_name}")
        
        tree_dict = {
            "root": {
                "title": doc_name,
                "content": extracted.get("markdown", ""),
                "summary": "Mock summary",
                "metadata": {
                    "original_path": extracted["path"],
                    "hash": extracted["hash"],
                    "title": doc_name,
                    "created_at": extracted["created_at"],
                    "mock": True,
                },
                "nodes": [],
            },
            "mock": True,
        }
        
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(tree_dict, f, ensure_ascii=False, indent=2)
        
        return out_path
    
    if not PAGEINDEX_AVAILABLE:
        raise RuntimeError("PageIndex not available and not in mock mode")
    
    if logger:
        logger.info(PipelineStep.INDEX, f"Indexing with PageIndex: {doc_name}")
    
    pi = PageIndex()
    tree = pi.from_text(
        text=extracted.get("markdown", "") or "",
        model=settings.LLM_MODEL,
        max_pages_per_node=10,
        max_tokens_per_node=20000,
        add_node_summary=False,  # <-- Key fix: avoid duplicate summaries
        add_node_id=True,
        add_doc_description=True
    )
    
    tree_dict = tree.to_dict()
    tree_dict["metadata"] = {
        "original_path": extracted["path"],
        "hash": extracted["hash"],
        "title": doc_name,
        "created_at": extracted["created_at"]
    }
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(tree_dict, f, ensure_ascii=False, indent=2)
    
    if logger:
        logger.info(PipelineStep.INDEX, f"Indexing complete: {doc_name}")
    
    return out_path


def index_all(
    extracted_list: List[Dict[str, Any]],
    paths: MatterPaths,
    logger: Optional[StructuredLogHandler] = None,
    max_concurrent: Optional[int] = None
) -> List[Path]:
    """Index all extracted documents."""
    settings = get_settings()
    
    if not extracted_list:
        if logger:
            logger.warning(PipelineStep.INDEX, "No documents to index")
        return []
    
    if logger:
        logger.info(PipelineStep.INDEX, f"Starting indexing of {len(extracted_list)} documents")
    
    # Use threadpool for CPU-bound indexing
    max_workers = max_concurrent or settings.MAX_CONCURRENT
    
    def index_with_logging(extracted: Dict[str, Any]) -> Path:
        result = index_document(extracted, paths, logger)
        return result
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        indexed_paths = list(
            tqdm.tqdm(
                executor.map(index_with_logging, extracted_list),
                total=len(extracted_list),
                desc="Indexing",
                disable=logger is not None
            )
        )
    
    if logger:
        logger.info(PipelineStep.INDEX, f"Indexing complete for {len(indexed_paths)} documents", progress=50.0)
    
    return indexed_paths


# -------------------------
# SECTION 3: Enrichment (OpenAI) - Adds summaries, depth metadata
# -------------------------
async def enrich_node(
    node: Dict[str, Any],
    depth: int = 0,
    max_depth: int = 6,
    min_length: int = 500,
    logger: Optional[StructuredLogHandler] = None
):
    """
    Recursively enrich a node with OpenAI summaries.
    Only adds summary if missing (supports incremental runs).
    """
    settings = get_settings()
    
    if depth > max_depth:
        return
    
    content = node.get("content")
    if isinstance(content, str) and len(content) >= min_length:
        # Only add if missing to support incremental runs
        if not node.get("summary"):
            if settings.AI_MOCK_MODE:
                node["summary"] = f"Mock summary for node at depth {depth}"
            else:
                try:
                    client = get_openai_client()
                    if client:
                        response = await client.chat.completions.create(
                            model=settings.LLM_MODEL,
                            messages=[
                                {"role": "system", "content": "Summarize this legal node in 1-2 sentences, preserving key terms/references."},
                                {"role": "user", "content": content[:2000]},
                            ],
                            temperature=0.2,
                        )
                        node["summary"] = response.choices[0].message.content.strip()
                except Exception as e:
                    if logger:
                        logger.warning(PipelineStep.ENRICH, f"Enrichment error: {e}")
                    # Continue without summary
                    pass
    
    node.setdefault("metadata", {})["depth"] = depth
    
    # Normalize children key ('nodes' or 'children')
    kids = node.get("nodes") or node.get("children") or []
    if isinstance(kids, list):
        for child in kids:
            if isinstance(child, dict):
                await enrich_node(child, depth + 1, max_depth, min_length, logger)


async def enrich_document(
    tree_path: Path,
    paths: MatterPaths,
    logger: Optional[StructuredLogHandler] = None
):
    """Enrich a single document's tree."""
    with open(tree_path, "r", encoding="utf-8") as f:
        tree_dict = json.load(f)
    
    root = tree_dict.get("root", tree_dict)
    await enrich_node(root, logger=logger)
    
    with open(tree_path, "w", encoding="utf-8") as f:
        json.dump(tree_dict, f, ensure_ascii=False, indent=2)


async def enrich_all(
    indexed_paths: List[Path],
    paths: MatterPaths,
    logger: Optional[StructuredLogHandler] = None,
    max_concurrent: Optional[int] = None
):
    """Enrich all indexed documents."""
    settings = get_settings()
    max_concurrent = max_concurrent or settings.MAX_CONCURRENT
    
    if not indexed_paths:
        if logger:
            logger.warning(PipelineStep.ENRICH, "No documents to enrich")
        return
    
    if logger:
        logger.info(PipelineStep.ENRICH, f"Starting enrichment of {len(indexed_paths)} documents")
    
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def bounded_enrich(path: Path):
        async with semaphore:
            await enrich_document(path, paths, logger)
    
    tasks = [asyncio.create_task(bounded_enrich(p)) for p in indexed_paths]
    
    for i, _ in enumerate(await tqdm.asyncio.tqdm.gather(*tasks, desc="Enriching", disable=logger is not None)):
        if logger:
            progress = 50.0 + ((i + 1) / len(tasks)) * 25  # 50-75% of total
            logger.info(PipelineStep.ENRICH, f"Enriched document {i+1}/{len(tasks)}", progress)
    
    if logger:
        logger.info(PipelineStep.ENRICH, f"Enrichment complete", progress=75.0)


# -------------------------
# SECTION 4: Merge into Master JSON
# -------------------------
def merge_indexes(
    indexed_paths: List[Path],
    paths: MatterPaths,
    logger: Optional[StructuredLogHandler] = None
) -> Dict[str, Any]:
    """Merge all indexed documents into a master index."""
    if logger:
        logger.info(PipelineStep.MERGE, f"Merging {len(indexed_paths)} indexes")
    
    master: Dict[str, Any] = {
        "root": {
            "title": "Dutch Legal Corpus",
            "nodes": [],
            "metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "document_count": len(indexed_paths),
            },
        }
    }
    
    for path in indexed_paths:
        with open(path, "r", encoding="utf-8") as f:
            tree_dict = json.load(f)
        
        book_root = tree_dict.get("root", tree_dict)
        book_root.setdefault("metadata", {})["book_title"] = tree_dict.get("metadata", {}).get("title", Path(path).stem)
        master["root"]["nodes"].append(book_root)
    
    return master


def save_master(
    master: Dict[str, Any],
    paths: MatterPaths,
    logger: Optional[StructuredLogHandler] = None
) -> Path:
    """Save the master index to disk."""
    master_path = paths.master_index_path
    
    with open(master_path, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)
    
    if logger:
        logger.info(PipelineStep.MERGE, f"Master index saved: {master_path}", progress=100.0)
    
    return master_path


# -------------------------
# SECTION 5: Querying (OpenAI API via PageIndex) - Cached Index
# -------------------------
async def load_pageindex_for_matter(paths: MatterPaths) -> Any:
    """Load or get cached PageIndex for a matter."""
    global _PI_CACHE
    
    cache_key = f"{paths.org_id}/{paths.matter_id}"
    
    if cache_key in _PI_CACHE:
        return _PI_CACHE[cache_key]
    
    if not paths.master_index_path.exists():
        raise FileNotFoundError(f"Master index not found: {paths.master_index_path}")
    
    with open(paths.master_index_path, "r", encoding="utf-8") as f:
        master_tree = json.load(f)
    
    if not PAGEINDEX_AVAILABLE:
        raise RuntimeError("PageIndex not available")
    
    pi = PageIndex()
    pi.from_tree(master_tree)
    
    _PI_CACHE[cache_key] = pi
    return pi


def clear_query_cache(org_id: Optional[str] = None, matter_id: Optional[str] = None):
    """Clear the query cache. If org/matter specified, clear only that entry."""
    global _PI_CACHE
    
    if org_id and matter_id:
        cache_key = f"{org_id}/{matter_id}"
        if cache_key in _PI_CACHE:
            del _PI_CACHE[cache_key]
    else:
        _PI_CACHE.clear()


async def query_legal_ai(
    paths: MatterPaths,
    question: str,
    top_k: int = 5,
    max_depth: int = 5
) -> Dict[str, Any]:
    """
    Query the legal AI pipeline.
    Uses cached PageIndex instance for performance.
    """
    settings = get_settings()
    
    if settings.AI_MOCK_MODE:
        return {
            "answer": f"This is a mock answer to: {question}",
            "sources": [
                {"title": "Mock Source 1", "content": "Mock content 1"},
                {"title": "Mock Source 2", "content": "Mock content 2"},
            ],
            "reasoning": "Mock reasoning process for the answer.",
            "mock": True,
        }
    
    pi = await load_pageindex_for_matter(paths)
    
    result = await pi.query(
        question=question,
        top_k=top_k,
        reasoning_steps=True,
        model=settings.LLM_MODEL,
    )
    
    return {
        "answer": result.get("answer", "No answer"),
        "sources": result.get("sources", []),
        "reasoning": result.get("reasoning", ""),
    }


# -------------------------
# SECTION 6: Full Pipeline Runner
# -------------------------
async def run_pipeline(
    job: Job,
    logger: StructuredLogHandler,
    paths: MatterPaths
):
    """
    Run the complete pipeline for a matter.
    This is the main entry point called by the job runner.
    """
    settings = get_settings()
    
    logger.info(PipelineStep.IDLE, "Starting Legal AI Pipeline", 0.0, {
        "orgId": job.org_id,
        "matterId": job.matter_id,
        "mockMode": settings.AI_MOCK_MODE,
    })
    
    # Step 1: Extract
    logger.info(PipelineStep.EXTRACT, "Starting document extraction")
    extracted = await extract_all(
        paths,
        document_ids=job.document_ids,
        logger=logger,
        max_concurrent=job.options.get("maxConcurrent", settings.MAX_CONCURRENT)
    )
    
    if not extracted:
        logger.warning(PipelineStep.EXTRACT, "No documents extracted")
        return
    
    # Step 2: Index
    logger.info(PipelineStep.INDEX, "Starting document indexing", 25.0)
    indexed_paths = index_all(
        extracted,
        paths,
        logger=logger,
        max_concurrent=job.options.get("maxConcurrent", settings.MAX_CONCURRENT)
    )
    
    # Step 3: Enrich
    logger.info(PipelineStep.ENRICH, "Starting document enrichment", 50.0)
    await enrich_all(
        indexed_paths,
        paths,
        logger=logger,
        max_concurrent=job.options.get("maxConcurrent", settings.MAX_CONCURRENT)
    )
    
    # Step 4: Merge
    logger.info(PipelineStep.MERGE, "Starting index merge", 75.0)
    master = merge_indexes(indexed_paths, paths, logger)
    master_path = save_master(master, paths, logger)
    
    # Clear query cache to ensure fresh index on next query
    clear_query_cache(job.org_id, job.matter_id)
    
    # Record artifacts
    job.artifacts = [
        {
            "type": "MASTER_JSON",
            "path": str(master_path),
            "name": "master_index.json",
        }
    ]
    
    for path in indexed_paths:
        parse_path = paths.get_parse_path(path.stem.replace("_tree", ""))
        job.artifacts.append({
            "type": "TREE_JSON",
            "path": str(path),
            "name": path.name,
        })
        if parse_path.exists():
            job.artifacts.append({
                "type": "PARSE_JSON",
                "path": str(parse_path),
                "name": parse_path.name,
            })
    
    logger.info(PipelineStep.COMPLETE, "Pipeline completed successfully", 100.0)
