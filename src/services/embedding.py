"""Embedding service using sentence-transformers."""

from typing import List, Optional, Union
import numpy as np
import structlog

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False


logger = structlog.get_logger()


class EmbeddingService:
    """
    Embedding service for generating text embeddings.

    Uses sentence-transformers for high-quality multilingual embeddings.
    Supports caching for improved performance.
    """

    DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    MODELS = {
        "multilingual": "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
        "english": "sentence-transformers/all-mpnet-base-v2",
        "fast": "sentence-transformers/all-MiniLM-L6-v2",
        "legal": "nlpaueb/legal-bert-base-uncased",
    }

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        cache_folder: Optional[str] = None
    ):
        """
        Initialize embedding service.

        Args:
            model_name: Model name or key from MODELS dict
            device: Device to use ("cuda", "cpu", or None for auto-detect)
            cache_folder: Folder to cache model downloads
        """
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise ImportError(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )

        # Resolve model name
        if model_name is None:
            model_name = self.DEFAULT_MODEL
        elif model_name in self.MODELS:
            model_name = self.MODELS[model_name]

        self.model_name = model_name
        self.device = device
        self.cache_folder = cache_folder

        # Load model
        logger.info(
            "Loading embedding model",
            model=self.model_name,
            device=self.device or "auto"
        )

        self.model = SentenceTransformer(
            self.model_name,
            device=self.device,
            cache_folder=self.cache_folder
        )

        self.embedding_dim = self.model.get_sentence_embedding_dimension()

        logger.info(
            "Embedding model loaded",
            model=self.model_name,
            dimension=self.embedding_dim
        )

        # Cache for embeddings
        self._cache: dict = {}

    def embed(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 32,
        show_progress_bar: bool = False,
        normalize: bool = True,
        use_cache: bool = True
    ) -> np.ndarray:
        """
        Generate embeddings for text(s).

        Args:
            texts: Single text or list of texts
            batch_size: Batch size for encoding
            show_progress_bar: Show progress bar for large batches
            normalize: Normalize embeddings to unit length
            use_cache: Use cached embeddings if available

        Returns:
            Numpy array of embeddings (shape: [n_texts, embedding_dim])
        """
        # Handle single text
        if isinstance(texts, str):
            texts = [texts]
            single = True
        else:
            single = False

        # Check cache
        if use_cache:
            embeddings = []
            uncached_texts = []
            uncached_indices = []

            for i, text in enumerate(texts):
                if text in self._cache:
                    embeddings.append(self._cache[text])
                else:
                    uncached_texts.append(text)
                    uncached_indices.append(i)

            # Generate embeddings for uncached texts
            if uncached_texts:
                new_embeddings = self.model.encode(
                    uncached_texts,
                    batch_size=batch_size,
                    show_progress_bar=show_progress_bar,
                    normalize_embeddings=normalize,
                    convert_to_numpy=True
                )

                # Update cache
                for text, embedding in zip(uncached_texts, new_embeddings):
                    self._cache[text] = embedding

                # Merge cached and new embeddings
                result = np.zeros((len(texts), self.embedding_dim))
                cached_idx = 0
                uncached_idx = 0

                for i in range(len(texts)):
                    if i in uncached_indices:
                        result[i] = new_embeddings[uncached_idx]
                        uncached_idx += 1
                    else:
                        result[i] = embeddings[cached_idx]
                        cached_idx += 1

                embeddings = result
            else:
                embeddings = np.array(embeddings)

        else:
            # No caching - generate all embeddings
            embeddings = self.model.encode(
                texts,
                batch_size=batch_size,
                show_progress_bar=show_progress_bar,
                normalize_embeddings=normalize,
                convert_to_numpy=True
            )

        # Return single embedding if input was single text
        if single:
            return embeddings[0]

        return embeddings

    def embed_query(self, query: str, normalize: bool = True) -> np.ndarray:
        """
        Embed a search query.

        Args:
            query: Query text
            normalize: Normalize embedding

        Returns:
            Query embedding vector
        """
        return self.embed(query, normalize=normalize, use_cache=True)

    def embed_documents(
        self,
        documents: List[str],
        batch_size: int = 32,
        show_progress_bar: bool = True,
        normalize: bool = True
    ) -> np.ndarray:
        """
        Embed multiple documents.

        Args:
            documents: List of document texts
            batch_size: Batch size
            show_progress_bar: Show progress
            normalize: Normalize embeddings

        Returns:
            Document embeddings matrix
        """
        return self.embed(
            documents,
            batch_size=batch_size,
            show_progress_bar=show_progress_bar,
            normalize=normalize,
            use_cache=False  # Don't cache large document sets
        )

    def similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray,
        metric: str = "cosine"
    ) -> float:
        """
        Calculate similarity between two embeddings.

        Args:
            embedding1: First embedding
            embedding2: Second embedding
            metric: Similarity metric ("cosine", "euclidean", "dot")

        Returns:
            Similarity score
        """
        if metric == "cosine":
            # Cosine similarity
            return float(np.dot(embedding1, embedding2) / (
                np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
            ))
        elif metric == "dot":
            # Dot product (assumes normalized embeddings)
            return float(np.dot(embedding1, embedding2))
        elif metric == "euclidean":
            # Negative euclidean distance (higher = more similar)
            return float(-np.linalg.norm(embedding1 - embedding2))
        else:
            raise ValueError(f"Unknown metric: {metric}")

    def batch_similarity(
        self,
        query_embedding: np.ndarray,
        document_embeddings: np.ndarray,
        metric: str = "cosine"
    ) -> np.ndarray:
        """
        Calculate similarity between query and multiple documents.

        Args:
            query_embedding: Query embedding (1D array)
            document_embeddings: Document embeddings (2D array)
            metric: Similarity metric

        Returns:
            Array of similarity scores
        """
        if metric == "cosine":
            # Normalize if needed
            query_norm = query_embedding / np.linalg.norm(query_embedding)
            doc_norms = document_embeddings / np.linalg.norm(
                document_embeddings, axis=1, keepdims=True
            )
            return np.dot(doc_norms, query_norm)
        elif metric == "dot":
            return np.dot(document_embeddings, query_embedding)
        elif metric == "euclidean":
            return -np.linalg.norm(
                document_embeddings - query_embedding,
                axis=1
            )
        else:
            raise ValueError(f"Unknown metric: {metric}")

    def clear_cache(self):
        """Clear the embedding cache."""
        self._cache.clear()
        logger.info("Embedding cache cleared")

    def get_cache_size(self) -> int:
        """Get number of cached embeddings."""
        return len(self._cache)

    def __repr__(self) -> str:
        """String representation."""
        return f"EmbeddingService(model={self.model_name}, dim={self.embedding_dim})"
