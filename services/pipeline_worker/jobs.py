"""
Job runner with progress reporting for the Legal AI Pipeline.
"""
import asyncio
import uuid
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
import json

from logging_utils import StructuredLogHandler, PipelineStep, LogLevel
from paths import MatterPaths


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    """Pipeline job definition."""
    id: str
    org_id: str
    matter_id: str
    status: JobStatus
    step: PipelineStep
    progress: float  # 0-100
    document_ids: Optional[List[str]] = None
    options: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    log_path: Optional[str] = None
    artifacts: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "orgId": self.org_id,
            "matterId": self.matter_id,
            "status": self.status.value,
            "step": self.step.value,
            "progress": self.progress,
            "documentIds": self.document_ids,
            "options": self.options,
            "createdAt": self.created_at,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
            "error": self.error,
            "logPath": self.log_path,
            "artifacts": self.artifacts,
        }


class JobManager:
    """
    Manages pipeline jobs with in-memory storage.
    In production, this would be backed by a database.
    """
    
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._loggers: Dict[str, StructuredLogHandler] = {}
    
    def create_job(
        self,
        org_id: str,
        matter_id: str,
        document_ids: Optional[List[str]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Job:
        """Create a new pipeline job."""
        job_id = str(uuid.uuid4())
        
        # Setup paths
        paths = MatterPaths(org_id, matter_id)
        log_path = paths.get_log_path(job_id)
        
        job = Job(
            id=job_id,
            org_id=org_id,
            matter_id=matter_id,
            status=JobStatus.PENDING,
            step=PipelineStep.IDLE,
            progress=0.0,
            document_ids=document_ids,
            options=options or {},
            log_path=str(log_path),
        )
        
        self._jobs[job_id] = job
        
        # Create logger
        self._loggers[job_id] = StructuredLogHandler(log_path)
        
        return job
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get a job by ID."""
        return self._jobs.get(job_id)
    
    def get_logger(self, job_id: str) -> Optional[StructuredLogHandler]:
        """Get the logger for a job."""
        return self._loggers.get(job_id)
    
    def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        step: Optional[PipelineStep] = None,
        progress: Optional[float] = None,
        error: Optional[str] = None,
        artifacts: Optional[List[Dict[str, Any]]] = None
    ):
        """Update job status."""
        job = self._jobs.get(job_id)
        if not job:
            return
        
        if status:
            job.status = status
            if status == JobStatus.RUNNING and not job.started_at:
                job.started_at = datetime.utcnow().isoformat()
            if status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
                job.finished_at = datetime.utcnow().isoformat()
        
        if step:
            job.step = step
        
        if progress is not None:
            job.progress = progress
        
        if error:
            job.error = error
        
        if artifacts:
            job.artifacts.extend(artifacts)
    
    def get_job_logs(self, job_id: str, lines: int = 50) -> List[Dict[str, Any]]:
        """Get job log tail."""
        logger = self._loggers.get(job_id)
        if logger:
            return logger.get_tail(lines)
        return []
    
    async def run_job(
        self,
        job_id: str,
        pipeline_func: Callable,
        *args,
        **kwargs
    ):
        """Run a pipeline job asynchronously."""
        job = self._jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        self.update_job(job_id, status=JobStatus.RUNNING, step=PipelineStep.IDLE)
        logger = self._loggers.get(job_id)
        
        try:
            # Run the pipeline
            await pipeline_func(job, logger, *args, **kwargs)
            
            self.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                step=PipelineStep.COMPLETE,
                progress=100.0
            )
            
            if logger:
                logger.info(PipelineStep.COMPLETE, "Pipeline completed successfully", 100.0)
                
        except Exception as e:
            error_msg = str(e)
            self.update_job(
                job_id,
                status=JobStatus.FAILED,
                step=PipelineStep.ERROR,
                error=error_msg
            )
            
            if logger:
                logger.error(PipelineStep.ERROR, f"Pipeline failed: {error_msg}")
        
        finally:
            # Cleanup logger
            if logger:
                logger.close()
            if job_id in self._loggers:
                del self._loggers[job_id]
            if job_id in self._running_tasks:
                del self._running_tasks[job_id]
    
    def start_job(
        self,
        job_id: str,
        pipeline_func: Callable,
        *args,
        **kwargs
    ) -> asyncio.Task:
        """Start a job in the background."""
        task = asyncio.create_task(
            self.run_job(job_id, pipeline_func, *args, **kwargs)
        )
        self._running_tasks[job_id] = task
        return task
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        task = self._running_tasks.get(job_id)
        if task and not task.done():
            task.cancel()
            self.update_job(job_id, status=JobStatus.CANCELLED)
            return True
        return False
    
    def list_jobs(
        self,
        org_id: Optional[str] = None,
        matter_id: Optional[str] = None,
        status: Optional[JobStatus] = None
    ) -> List[Job]:
        """List jobs with optional filters."""
        jobs = self._jobs.values()
        
        if org_id:
            jobs = [j for j in jobs if j.org_id == org_id]
        
        if matter_id:
            jobs = [j for j in jobs if j.matter_id == matter_id]
        
        if status:
            jobs = [j for j in jobs if j.status == status]
        
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)


# Global job manager instance
_job_manager: Optional[JobManager] = None


def get_job_manager() -> JobManager:
    """Get or create the global job manager."""
    global _job_manager
    if _job_manager is None:
        _job_manager = JobManager()
    return _job_manager


def compute_file_hash(file_path: Path) -> str:
    """Compute SHA256 hash of a file for idempotency checks."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()
