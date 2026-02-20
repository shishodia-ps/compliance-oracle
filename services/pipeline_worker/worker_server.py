"""
FastAPI worker server for the Dutch Legal AI Pipeline.
Runs on http://localhost:8001
"""
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from settings import get_settings
from paths import MatterPaths, get_matter_paths, sanitize_path_component
from jobs import (
    JobManager, Job, JobStatus, get_job_manager,
    PipelineStep
)
from pipeline_core import run_pipeline, query_legal_ai, clear_query_cache


# -------------------------
# Pydantic Models
# -------------------------
class IngestRequest(BaseModel):
    orgId: str
    matterId: str
    documentIds: Optional[List[str]] = None
    options: Dict[str, Any] = Field(default_factory=dict)


class IngestResponse(BaseModel):
    jobId: str


class JobStatusResponse(BaseModel):
    id: str
    orgId: str
    matterId: str
    status: str
    step: str
    progress: float
    documentIds: Optional[List[str]]
    options: Dict[str, Any]
    createdAt: str
    startedAt: Optional[str]
    finishedAt: Optional[str]
    error: Optional[str]
    logPath: Optional[str]
    artifacts: List[Dict[str, Any]]


class QueryRequest(BaseModel):
    orgId: str
    matterId: str
    question: str
    topK: int = 5


class QueryResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    reasoning: str
    mock: Optional[bool] = None


class ArtifactInfo(BaseModel):
    type: str
    name: str
    path: str
    size: int
    createdAt: str


# -------------------------
# FastAPI App
# -------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    settings = get_settings()
    
    # Ensure data directory exists
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"Pipeline Worker starting on {settings.HOST}:{settings.PORT}")
    print(f"Data directory: {settings.DATA_DIR}")
    print(f"Mock mode: {settings.AI_MOCK_MODE}")
    
    yield
    
    # Shutdown
    print("Pipeline Worker shutting down")


app = FastAPI(
    title="Legal AI Pipeline Worker",
    description="Dutch Legal AI Pipeline - LlamaCloud + PageIndex + OpenAI",
    version="1.0.0",
    lifespan=lifespan
)


# -------------------------
# Endpoints
# -------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    settings = get_settings()
    return {
        "status": "healthy",
        "mockMode": settings.AI_MOCK_MODE,
        "version": "1.0.0"
    }


@app.post("/jobs/ingest", response_model=IngestResponse)
async def create_ingest_job(
    request: IngestRequest,
    background_tasks: BackgroundTasks
):
    """
    Create and start a new ingest job.
    
    - Extracts documents using LlamaCloud
    - Indexes with PageIndex
    - Enriches with OpenAI
    - Merges into master index
    """
    # Validate and sanitize inputs
    org_id = sanitize_path_component(request.orgId)
    matter_id = sanitize_path_component(request.matterId)
    
    if not org_id or not matter_id:
        raise HTTPException(status_code=400, detail="Invalid orgId or matterId")
    
    # Create job
    job_manager = get_job_manager()
    job = job_manager.create_job(
        org_id=org_id,
        matter_id=matter_id,
        document_ids=request.documentIds,
        options=request.options
    )
    
    # Get paths
    paths = get_matter_paths(org_id, matter_id)
    
    # Start job in background
    logger = job_manager.get_logger(job.id)
    background_tasks.add_task(
        job_manager.run_job,
        job.id,
        run_pipeline,
        paths
    )
    
    return IngestResponse(jobId=job.id)


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the status of a job."""
    job_manager = get_job_manager()
    job = job_manager.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(**job.to_dict())


@app.get("/jobs/{job_id}/logs")
async def get_job_logs(job_id: str, lines: int = Query(default=50, le=500)):
    """Get the log tail for a job."""
    job_manager = get_job_manager()
    job = job_manager.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    logs = job_manager.get_job_logs(job_id, lines)
    return {"logs": logs}


@app.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    """
    Query the legal AI pipeline.
    
    Returns answer, sources, and reasoning.
    """
    # Validate and sanitize inputs
    org_id = sanitize_path_component(request.orgId)
    matter_id = sanitize_path_component(request.matterId)
    
    if not org_id or not matter_id:
        raise HTTPException(status_code=400, detail="Invalid orgId or matterId")
    
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    
    # Get paths
    paths = get_matter_paths(org_id, matter_id)
    
    # Check if master index exists
    if not paths.master_index_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Master index not found. Run ingest first."
        )
    
    try:
        result = await query_legal_ai(
            paths=paths,
            question=request.question,
            top_k=request.topK
        )
        return QueryResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.get("/artifacts/download")
async def download_artifact(
    orgId: str = Query(...),
    matterId: str = Query(...),
    path: str = Query(...)
):
    """
    Download an artifact file securely.
    
    Only allows paths inside /data/org_{orgId}/matter_{matterId}/...
    Prevents path traversal attacks.
    """
    # Validate and sanitize inputs
    org_id = sanitize_path_component(orgId)
    matter_id = sanitize_path_component(matterId)
    
    if not org_id or not matter_id:
        raise HTTPException(status_code=400, detail="Invalid orgId or matterId")
    
    # Get paths
    paths = get_matter_paths(org_id, matter_id)
    
    # Resolve the requested path
    try:
        requested_path = Path(path).resolve()
    except (OSError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid path")
    
    # Security check: ensure path is within matter's directory
    if not paths.validate_path(requested_path):
        raise HTTPException(status_code=403, detail="Access denied: path outside matter scope")
    
    # Check if file exists
    if not requested_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not requested_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    # Return file
    return FileResponse(
        path=requested_path,
        filename=requested_path.name,
        media_type="application/json"
    )


@app.get("/artifacts")
async def list_artifacts(
    orgId: str = Query(...),
    matterId: str = Query(...)
):
    """List all artifacts for a matter."""
    # Validate and sanitize inputs
    org_id = sanitize_path_component(orgId)
    matter_id = sanitize_path_component(matterId)
    
    if not org_id or not matter_id:
        raise HTTPException(status_code=400, detail="Invalid orgId or matterId")
    
    # Get paths
    paths = get_matter_paths(org_id, matter_id)
    
    artifacts = []
    
    # List parse JSON files
    if paths.indexes_dir.exists():
        for file_path in paths.indexes_dir.glob("*_parse.json"):
            stat = file_path.stat()
            artifacts.append({
                "type": "PARSE_JSON",
                "name": file_path.name,
                "path": str(file_path),
                "size": stat.st_size,
                "createdAt": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
        
        # List tree JSON files
        for file_path in paths.indexes_dir.glob("*_tree.json"):
            stat = file_path.stat()
            artifacts.append({
                "type": "TREE_JSON",
                "name": file_path.name,
                "path": str(file_path),
                "size": stat.st_size,
                "createdAt": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    
    # List master JSON
    if paths.master_index_path.exists():
        stat = paths.master_index_path.stat()
        artifacts.append({
            "type": "MASTER_JSON",
            "name": paths.master_index_path.name,
            "path": str(paths.master_index_path),
            "size": stat.st_size,
            "createdAt": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    
    return {"artifacts": artifacts}


@app.post("/cache/clear")
async def clear_cache(orgId: Optional[str] = None, matterId: Optional[str] = None):
    """Clear the query cache."""
    if orgId and matterId:
        org_id = sanitize_path_component(orgId)
        matter_id = sanitize_path_component(matterId)
        clear_query_cache(org_id, matter_id)
    else:
        clear_query_cache()
    
    return {"message": "Cache cleared"}


@app.get("/jobs")
async def list_jobs(
    orgId: Optional[str] = None,
    matterId: Optional[str] = None,
    status: Optional[str] = None
):
    """List jobs with optional filters."""
    job_manager = get_job_manager()
    
    # Convert status string to enum if provided
    status_enum = None
    if status:
        try:
            status_enum = JobStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    # Sanitize inputs
    org_id = sanitize_path_component(orgId) if orgId else None
    matter_id = sanitize_path_component(matterId) if matterId else None
    
    jobs = job_manager.list_jobs(
        org_id=org_id,
        matter_id=matter_id,
        status=status_enum
    )
    
    return {"jobs": [job.to_dict() for job in jobs]}


# -------------------------
# Main Entry Point
# -------------------------
if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "worker_server:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
        log_level="info"
    )
