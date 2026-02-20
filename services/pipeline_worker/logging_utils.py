"""
Structured logging utilities for the pipeline worker.
"""
import json
import logging
import logging.handlers
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class PipelineStep(str, Enum):
    IDLE = "idle"
    EXTRACT = "extract"
    INDEX = "index"
    ENRICH = "enrich"
    MERGE = "merge"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class LogEntry:
    """Structured log entry."""
    timestamp: str
    level: str
    step: str
    message: str
    progress: Optional[float] = None
    details: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "timestamp": self.timestamp,
            "level": self.level,
            "step": self.step,
            "message": self.message,
        }
        if self.progress is not None:
            result["progress"] = self.progress
        if self.details:
            result["details"] = self.details
        return result
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)


class StructuredLogHandler:
    """
    Handles structured logging for pipeline jobs.
    Writes both to file and maintains an in-memory tail buffer.
    """
    
    def __init__(self, log_path: Path, max_tail_lines: int = 100):
        self.log_path = log_path
        self.max_tail_lines = max_tail_lines
        self.tail_buffer: list[LogEntry] = []
        self._file_handler: Optional[logging.FileHandler] = None
        self._logger: Optional[logging.Logger] = None
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup the file logger."""
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._logger = logging.getLogger(f"pipeline_{self.log_path.stem}")
        self._logger.setLevel(logging.DEBUG)
        
        # Clear any existing handlers
        self._logger.handlers.clear()
        
        # File handler with rotation
        self._file_handler = logging.handlers.RotatingFileHandler(
            self.log_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8"
        )
        self._file_handler.setLevel(logging.DEBUG)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        )
        self._file_handler.setFormatter(formatter)
        self._logger.addHandler(self._file_handler)
    
    def log(
        self,
        level: LogLevel,
        step: PipelineStep,
        message: str,
        progress: Optional[float] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log a structured entry."""
        entry = LogEntry(
            timestamp=datetime.utcnow().isoformat(),
            level=level.value,
            step=step.value,
            message=message,
            progress=progress,
            details=details
        )
        
        # Add to tail buffer
        self.tail_buffer.append(entry)
        if len(self.tail_buffer) > self.max_tail_lines:
            self.tail_buffer.pop(0)
        
        # Write to file
        if self._logger:
            log_msg = entry.to_json()
            if level == LogLevel.DEBUG:
                self._logger.debug(log_msg)
            elif level == LogLevel.INFO:
                self._logger.info(log_msg)
            elif level == LogLevel.WARNING:
                self._logger.warning(log_msg)
            elif level == LogLevel.ERROR:
                self._logger.error(log_msg)
            elif level == LogLevel.CRITICAL:
                self._logger.critical(log_msg)
    
    def get_tail(self, lines: int = 50) -> list[Dict[str, Any]]:
        """Get the last N log entries."""
        return [entry.to_dict() for entry in self.tail_buffer[-lines:]]
    
    def info(self, step: PipelineStep, message: str, progress: Optional[float] = None, details: Optional[Dict[str, Any]] = None):
        """Convenience method for INFO level."""
        self.log(LogLevel.INFO, step, message, progress, details)
    
    def debug(self, step: PipelineStep, message: str, progress: Optional[float] = None, details: Optional[Dict[str, Any]] = None):
        """Convenience method for DEBUG level."""
        self.log(LogLevel.DEBUG, step, message, progress, details)
    
    def warning(self, step: PipelineStep, message: str, progress: Optional[float] = None, details: Optional[Dict[str, Any]] = None):
        """Convenience method for WARNING level."""
        self.log(LogLevel.WARNING, step, message, progress, details)
    
    def error(self, step: PipelineStep, message: str, progress: Optional[float] = None, details: Optional[Dict[str, Any]] = None):
        """Convenience method for ERROR level."""
        self.log(LogLevel.ERROR, step, message, progress, details)
    
    def close(self):
        """Close the log handler."""
        if self._file_handler:
            self._file_handler.close()


def create_job_logger(log_path: Path) -> StructuredLogHandler:
    """Factory function to create a job logger."""
    return StructuredLogHandler(log_path)
