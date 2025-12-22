"""Vector store service using ChromaDB."""

from typing import List, Optional, Dict, Any, Tuple
import uuid
import structlog

try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

from .embedding import EmbeddingService
from ..models.documents import DocumentSection as Section, DocumentChunk as Chunk


logger = structlog.get_logger()


class VectorStore:
    """
    Vector store for semantic search using ChromaDB.

    Stores document sections with:
    - Original text
    - Translated text (for multilingual support)
    - Metadata (section_id, page, language, etc.)
    """

    def __init__(
        self,
        collection_name: str = "policy_sections",
        persist_directory: Optional[str] = None,
        embedding_service: Optional[EmbeddingService] = None
    ):
        """
        Initialize vector store.

        Args:
            collection_name: Name of the collection
            persist_directory: Directory to persist data (None = in-memory)
            embedding_service: Embedding service to use
        """
        if not CHROMADB_AVAILABLE:
            raise ImportError(
                "chromadb not installed. "
                "Install with: pip install chromadb"
            )

        self.collection_name = collection_name
        self.persist_directory = persist_directory

        # Initialize ChromaDB client
        if persist_directory:
            self.client = chromadb.PersistentClient(
                path=persist_directory,
                settings=Settings(anonymized_telemetry=False)
            )
        else:
            self.client = chromadb.Client(
                settings=Settings(anonymized_telemetry=False)
            )

        # Initialize embedding service
        if embedding_service is None:
            embedding_service = EmbeddingService()
        self.embedding_service = embedding_service

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}  # Use cosine similarity
        )

        logger.info(
            "Vector store initialized",
            collection=collection_name,
            persist_directory=persist_directory,
            count=self.collection.count()
        )

    def add_sections(
        self,
        sections: List[Section],
        language: Optional[str] = None,
        translated_texts: Optional[List[str]] = None,
        batch_size: int = 100
    ) -> int:
        """
        Add document sections to the vector store.

        Args:
            sections: List of sections to add
            language: Language of the sections
            translated_texts: Translated versions (for multilingual)
            batch_size: Batch size for adding

        Returns:
            Number of sections added
        """
        if not sections:
            return 0

        logger.info(
            "Adding sections to vector store",
            count=len(sections),
            language=language
        )

        # Prepare data
        ids = []
        documents = []
        metadatas = []
        embeddings_to_generate = []

        for i, section in enumerate(sections):
            # Generate unique ID
            section_uuid = str(uuid.uuid4())
            ids.append(section_uuid)

            # Store original text as document
            documents.append(section.content)

            # Prepare metadata
            metadata = {
                "section_id": section.section_id,
                "title": section.title or "",
                "page": section.page or 0,
                "language": language or "unknown",
                "parent_section_id": section.parent_section_id or "",
                "level": section.level,
            }

            # Add translated text to metadata if available
            if translated_texts and i < len(translated_texts):
                metadata["translated_text"] = translated_texts[i]
                # Use translated text for embedding (better multilingual search)
                embeddings_to_generate.append(translated_texts[i])
            else:
                embeddings_to_generate.append(section.content)

            # Add custom metadata
            for key, value in section.metadata.items():
                if isinstance(value, (str, int, float, bool)):
                    metadata[f"custom_{key}"] = value

            metadatas.append(metadata)

        # Generate embeddings
        logger.info("Generating embeddings", count=len(embeddings_to_generate))
        embeddings = self.embedding_service.embed_documents(
            embeddings_to_generate,
            batch_size=batch_size,
            show_progress_bar=True
        )

        # Add to collection in batches
        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]
            batch_docs = documents[i:i + batch_size]
            batch_meta = metadatas[i:i + batch_size]
            batch_emb = embeddings[i:i + batch_size].tolist()

            self.collection.add(
                ids=batch_ids,
                documents=batch_docs,
                metadatas=batch_meta,
                embeddings=batch_emb
            )

        logger.info(
            "Sections added to vector store",
            count=len(sections),
            total_in_store=self.collection.count()
        )

        return len(sections)

    def search(
        self,
        query: str,
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
        where_document: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant sections.

        Args:
            query: Search query
            n_results: Number of results to return
            where: Metadata filter (e.g., {"language": "en"})
            where_document: Document content filter

        Returns:
            List of results with sections and scores
        """
        # Generate query embedding
        query_embedding = self.embedding_service.embed_query(query)

        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=n_results,
            where=where,
            where_document=where_document
        )

        # Format results
        formatted_results = []
        for i in range(len(results["ids"][0])):
            result = {
                "id": results["ids"][0][i],
                "section_id": results["metadatas"][0][i].get("section_id"),
                "title": results["metadatas"][0][i].get("title"),
                "content": results["documents"][0][i],
                "page": results["metadatas"][0][i].get("page"),
                "distance": results["distances"][0][i],
                "score": 1 - results["distances"][0][i],  # Convert distance to similarity
                "metadata": results["metadatas"][0][i]
            }
            formatted_results.append(result)

        return formatted_results

    def search_multiple(
        self,
        queries: List[str],
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Search with multiple queries and return combined results.

        Args:
            queries: List of search queries
            n_results: Number of results per query
            where: Metadata filter

        Returns:
            Dictionary mapping queries to their results
        """
        results = {}

        for query in queries:
            query_results = self.search(
                query=query,
                n_results=n_results,
                where=where
            )
            results[query] = query_results

        return results

    def search_combined(
        self,
        queries: List[str],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search with multiple queries and return deduplicated, ranked results.

        Args:
            queries: List of search queries
            n_results: Total number of results to return
            where: Metadata filter

        Returns:
            Combined and ranked results
        """
        all_results = {}

        # Search with each query
        for query in queries:
            query_results = self.search(
                query=query,
                n_results=n_results * 2,  # Get more to ensure coverage
                where=where
            )

            # Merge results, keeping best score per section
            for result in query_results:
                section_id = result["section_id"]
                if section_id not in all_results or result["score"] > all_results[section_id]["score"]:
                    all_results[section_id] = result
                    all_results[section_id]["found_by_query"] = query

        # Sort by score and return top N
        ranked_results = sorted(
            all_results.values(),
            key=lambda x: x["score"],
            reverse=True
        )

        return ranked_results[:n_results]

    def get_by_section_id(self, section_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a section by its section_id.

        Args:
            section_id: Section identifier

        Returns:
            Section data or None
        """
        results = self.collection.get(
            where={"section_id": section_id}
        )

        if not results["ids"]:
            return None

        return {
            "id": results["ids"][0],
            "section_id": results["metadatas"][0].get("section_id"),
            "title": results["metadatas"][0].get("title"),
            "content": results["documents"][0],
            "page": results["metadatas"][0].get("page"),
            "metadata": results["metadatas"][0]
        }

    def delete_all(self):
        """Delete all documents from the collection."""
        # Get all IDs
        all_data = self.collection.get()
        if all_data["ids"]:
            self.collection.delete(ids=all_data["ids"])
        logger.info("All documents deleted from vector store")

    def count(self) -> int:
        """Get count of documents in store."""
        return self.collection.count()

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store."""
        count = self.count()

        # Get language distribution
        all_data = self.collection.get()
        languages = {}
        pages = set()

        for metadata in all_data["metadatas"]:
            lang = metadata.get("language", "unknown")
            languages[lang] = languages.get(lang, 0) + 1

            page = metadata.get("page")
            if page:
                pages.add(page)

        return {
            "total_sections": count,
            "languages": languages,
            "unique_pages": len(pages),
            "collection_name": self.collection_name
        }

    def __repr__(self) -> str:
        """String representation."""
        return f"VectorStore(collection={self.collection_name}, count={self.count()})"
