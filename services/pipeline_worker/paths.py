"""
Matter-scoped path utilities for offline-first storage.
All pipeline IO uses: /data/org_{orgId}/matter_{matterId}/
"""
from pathlib import Path
from typing import Optional
from settings import get_settings


class MatterPaths:
    """
    Matter-scoped directory layout for pipeline artifacts.
    
    Structure:
    /data/org_{orgId}/matter_{matterId}/
        uploads/    (PDFs already uploaded by the web app)
        indexes/    (*_parse.json and *_tree.json)
        master/     (master_index.json)
        logs/       (job log files)
    """
    
    def __init__(self, org_id: str, matter_id: str):
        self.org_id = org_id
        self.matter_id = matter_id
        self.base_dir = self._get_base_dir()
        
    def _get_base_dir(self) -> Path:
        """Get the base directory for this org/matter."""
        settings = get_settings()
        return settings.DATA_DIR / f"org_{self.org_id}" / f"matter_{self.matter_id}"
    
    @property
    def uploads_dir(self) -> Path:
        """Directory for uploaded PDFs (populated by web app)."""
        path = self.base_dir / "uploads"
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @property
    def indexes_dir(self) -> Path:
        """Directory for parse JSON and tree JSON files."""
        path = self.base_dir / "indexes"
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @property
    def master_dir(self) -> Path:
        """Directory for master index JSON."""
        path = self.base_dir / "master"
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @property
    def logs_dir(self) -> Path:
        """Directory for job log files."""
        path = self.base_dir / "logs"
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    @property
    def master_index_path(self) -> Path:
        """Path to the master index JSON file."""
        return self.master_dir / "master_index.json"
    
    def get_parse_path(self, document_name: str) -> Path:
        """Get the parse JSON path for a document."""
        # Remove .pdf extension if present and add _parse.json
        stem = Path(document_name).stem
        return self.indexes_dir / f"{stem}_parse.json"
    
    def get_tree_path(self, document_name: str) -> Path:
        """Get the tree JSON path for a document."""
        stem = Path(document_name).stem
        return self.indexes_dir / f"{stem}_tree.json"
    
    def get_log_path(self, job_id: str) -> Path:
        """Get the log file path for a job."""
        return self.logs_dir / f"job_{job_id}.log"
    
    def list_pdfs(self) -> list[Path]:
        """List all PDF files in the uploads directory."""
        return list(self.uploads_dir.glob("*.pdf"))
    
    def validate_path(self, path: Path) -> bool:
        """
        Security check: ensure path is within this matter's directory.
        Prevents path traversal attacks.
        """
        try:
            # Resolve to absolute paths
            requested = path.resolve()
            allowed_base = self.base_dir.resolve()
            
            # Check if requested path is within allowed base
            return str(requested).startswith(str(allowed_base))
        except (OSError, ValueError):
            return False


def get_matter_paths(org_id: str, matter_id: str) -> MatterPaths:
    """Factory function to get MatterPaths instance."""
    return MatterPaths(org_id, matter_id)


def sanitize_path_component(value: str) -> str:
    """Sanitize a path component to prevent directory traversal."""
    # Remove any path separators and dangerous characters
    return "".join(c for c in value if c.isalnum() or c in "_-").strip()
