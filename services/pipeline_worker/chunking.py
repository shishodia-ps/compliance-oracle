"""
Chunk extraction and persistence to database.
Emits normalized chunks from PageIndex tree for hybrid search.
"""
import hashlib
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from logging_utils import StructuredLogHandler, PipelineStep


@dataclass
class Chunk:
    """Normalized document chunk for search indexing."""
    chunk_id: str
    parent_chunk_id: Optional[str]
    document_id: str
    matter_id: str
    org_id: str
    page: Optional[int]
    section_path: str
    section_number: Optional[str]
    text: str
    chunk_type: str  # clause, section, paragraph
    clause_type: Optional[str]  # termination, indemnity, payment, etc.
    language: str
    level: int
    path: List[str]
    tree_node_id: Optional[str]
    hash: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunkId": self.chunk_id,
            "parentChunkId": self.parent_chunk_id,
            "documentId": self.document_id,
            "matterId": self.matter_id,
            "orgId": self.org_id,
            "page": self.page,
            "sectionPath": self.section_path,
            "sectionNumber": self.section_number,
            "text": self.text,
            "chunkType": self.chunk_type,
            "clauseType": self.clause_type,
            "language": self.language,
            "level": self.level,
            "path": self.path,
            "treeNodeId": self.tree_node_id,
            "hash": self.hash,
        }


class ChunkExtractor:
    """Extract normalized chunks from PageIndex tree structure."""
    
    # Dutch-English legal term mappings
    DUTCH_LEGAL_TERMS = {
        # Liability
        "aansprakelijkheid": "liability",
        "beperking aansprakelijkheid": "limitation of liability",
        "wettelijke aansprakelijkheid": "statutory liability",
        "contractuele aansprakelijkheid": "contractual liability",
        
        # Termination
        "ontbinding": "termination",
        "opzegging": "termination",
        "beeindiging": "termination",
        "tussentijdse ontbinding": "early termination",
        
        # Damages
        "schadevergoeding": "damages",
        "schade": "damage",
        "vergoeding": "compensation",
        "directe schade": "direct damages",
        "indirecte schade": "indirect damages",
        
        # Indemnity
        "vrijwaring": "indemnity",
        "schadeloosstelling": "indemnification",
        
        # Confidentiality
        "vertrouwelijkheid": "confidentiality",
        "geheimhouding": "non-disclosure",
        
        # Payment
        "betaling": "payment",
        "vergoeding": "fee",
        "tarief": "rate",
        "factuur": "invoice",
        
        # IP
        "intellectueel eigendom": "intellectual property",
        "auteursrecht": "copyright",
        "octrooi": "patent",
        
        # Force majeure
        "overmacht": "force majeure",
        
        # Governing law
        "toepasselijk recht": "governing law",
        "bevoegde rechter": "competent court",
        "jurisdictie": "jurisdiction",
    }
    
    CLAUSE_TYPE_KEYWORDS = {
        "termination": ["terminate", "termination", "ontbind", "opzeg", "beeindig"],
        "indemnity": ["indemnif", "indemnity", "vrijwar", "schadeloos"],
        "liability": ["liability", "aansprakelijk", "schadevergoeding"],
        "confidentiality": ["confidential", "vertrouwelijk", "geheimhouding"],
        "payment": ["payment", "fee", "compensat", "betaling", "vergoeding"],
        "ip": ["intellectual property", "copyright", "auteursrecht", "eigendom"],
        "force_majeure": ["force majeure", "overmacht"],
        "governing_law": ["governing law", "applicable law", "toepasselijk recht"],
        "jurisdiction": ["jurisdiction", "jurisdictie", "bevoegde rechter"],
        "assignment": ["assign", "overdracht", "cession"],
        "warranty": ["warrant", "garantie", "garanderen"],
        "entire_agreement": ["entire agreement", "volledige overeenkomst"],
        "amendment": ["amend", "wijziging", "aanpassing"],
        "notice": ["notice", "kennisgeving", "schriftelijk"],
    }
    
    def __init__(self, org_id: str, matter_id: str, document_id: str):
        self.org_id = org_id
        self.matter_id = matter_id
        self.document_id = document_id
        
    def detect_language(self, text: str) -> str:
        """Detect if text is primarily Dutch or English."""
        text_lower = text.lower()
        dutch_words = [
            "de", "het", "een", "van", "en", "voor", "op", "met", "als", "bij",
            "aansprakelijkheid", "overeenkomst", "artikel", "wet", "art",
        ]
        english_words = [
            "the", "a", "an", "of", "and", "for", "on", "with", "as", "at",
            "liability", "agreement", "article", "section", "pursuant",
        ]
        
        dutch_count = sum(1 for word in dutch_words if word in text_lower)
        english_count = sum(1 for word in english_words if word in text_lower)
        
        if dutch_count > english_count:
            return "nl"
        elif english_count > dutch_count:
            return "en"
        return "unknown"
    
    def detect_clause_type(self, text: str, section_path: str) -> Optional[str]:
        """Detect clause type from content and path."""
        text_lower = text.lower()
        combined = f"{section_path} {text_lower}"[:500]  # First 500 chars
        
        scores = {}
        for clause_type, keywords in self.CLAUSE_TYPE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in combined)
            if score > 0:
                scores[clause_type] = score
        
        if scores:
            return max(scores, key=scores.get)
        return None
    
    def compute_chunk_hash(self, text: str) -> str:
        """Compute hash for chunk content versioning."""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
    
    def normalize_term(self, term: str, language: str) -> str:
        """Normalize Dutch term to English equivalent if applicable."""
        if language == "nl":
            term_lower = term.lower()
            return self.DUTCH_LEGAL_TERMS.get(term_lower, term)
        return term
    
    def extract_page_number(self, node: Dict[str, Any]) -> Optional[int]:
        """Extract page number from node metadata or content."""
        # Try metadata first
        metadata = node.get("metadata", {})
        if "page" in metadata:
            return metadata["page"]
        
        # Try to find in text
        text = node.get("content", "")
        import re
        # Look for "Page X" or "Pagina X"
        match = re.search(r'(?:page|pagina)\s*(\d+)', text, re.IGNORECASE)
        if match:
            return int(match.group(1))
        
        return None
    
    def extract_section_number(self, path: str) -> Optional[str]:
        """Extract section number from path (e.g., '2.1 Liability' -> '2.1')."""
        import re
        match = re.match(r'^(\d+(?:\.\d+)*)', path)
        if match:
            return match.group(1)
        return None
    
    def traverse_tree(
        self,
        node: Dict[str, Any],
        parent_path: List[str] = None,
        level: int = 0,
        parent_chunk_id: Optional[str] = None,
        chunks: List[Chunk] = None
    ) -> List[Chunk]:
        """Recursively traverse PageIndex tree and extract chunks."""
        if chunks is None:
            chunks = []
        if parent_path is None:
            parent_path = []
        
        node_id = node.get("id") or f"node_{len(chunks)}"
        content = node.get("content", "") or node.get("text", "")
        title = node.get("title", "")
        
        # Build section path
        current_path = parent_path + [title] if title else parent_path
        section_path = " → ".join(current_path) if current_path else "Root"
        
        # Only create chunk if there's content
        if content and len(content.strip()) > 20:
            language = self.detect_language(content)
            clause_type = self.detect_clause_type(content, section_path)
            
            chunk = Chunk(
                chunk_id=f"{self.document_id}_{node_id}",
                parent_chunk_id=parent_chunk_id,
                document_id=self.document_id,
                matter_id=self.matter_id,
                org_id=self.org_id,
                page=self.extract_page_number(node),
                section_path=section_path,
                section_number=self.extract_section_number(section_path),
                text=content.strip(),
                chunk_type="clause" if clause_type else "section" if level < 3 else "paragraph",
                clause_type=clause_type,
                language=language,
                level=level,
                path=current_path,
                tree_node_id=node_id,
                hash=self.compute_chunk_hash(content),
            )
            chunks.append(chunk)
            current_chunk_id = chunk.chunk_id
        else:
            current_chunk_id = parent_chunk_id
        
        # Process children
        children = node.get("nodes") or node.get("children") or []
        for child in children:
            if isinstance(child, dict):
                self.traverse_tree(
                    child,
                    current_path,
                    level + 1,
                    current_chunk_id,
                    chunks
                )
        
        return chunks
    
    def extract_from_tree_json(self, tree_path: Path) -> List[Chunk]:
        """Extract chunks from a PageIndex tree JSON file."""
        with open(tree_path, "r", encoding="utf-8") as f:
            tree = json.load(f)
        
        root = tree.get("root", tree)
        return self.traverse_tree(root)


class ChunkPersistence:
    """Persist chunks to database for search indexing."""
    
    def __init__(self, db_connection_string: Optional[str] = None):
        self.db_connection_string = db_connection_string
        self._chunks_buffer: List[Chunk] = []
    
    def add_chunks(self, chunks: List[Chunk]):
        """Add chunks to buffer for batch insertion."""
        self._chunks_buffer.extend(chunks)
    
    def persist_to_db(
        self,
        chunks: List[Chunk],
        logger: Optional[StructuredLogHandler] = None
    ) -> int:
        """
        Persist chunks to database.
        Returns number of chunks persisted.
        """
        if not chunks:
            return 0
        
        if logger:
            logger.info(PipelineStep.MERGE, f"Persisting {len(chunks)} chunks to database")
        
        # In production, this would use the actual database connection
        # For now, we return the count for tracking
        return len(chunks)
    
    def generate_embeddings(self, chunks: List[Chunk]) -> List[List[float]]:
        """
        Generate embeddings for chunks.
        In production, this would call OpenAI or similar API.
        """
        # Mock embeddings for now - would use text-embedding-3-small
        import random
        return [[random.random() for _ in range(1536)] for _ in chunks]


def extract_and_persist_chunks(
    tree_path: Path,
    org_id: str,
    matter_id: str,
    document_id: str,
    logger: Optional[StructuredLogHandler] = None
) -> int:
    """
    Extract chunks from tree and persist to database.
    Returns number of chunks processed.
    """
    extractor = ChunkExtractor(org_id, matter_id, document_id)
    persister = ChunkPersistence()
    
    # Extract chunks
    chunks = extractor.extract_from_tree_json(tree_path)
    
    if logger:
        logger.info(PipelineStep.MERGE, f"Extracted {len(chunks)} chunks from {tree_path.name}")
    
    # Generate embeddings (optional, can be done async)
    # embeddings = persister.generate_embeddings(chunks)
    
    # Persist to database
    count = persister.persist_to_db(chunks, logger)
    
    return count
