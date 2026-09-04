import logging
import os
from pathlib import Path
from typing import Sequence

import numpy as np

logger = logging.getLogger("traject.ml.topics.embeddings")


class SentenceEmbeddingAdapter:
    """Reusable, CPU-optimized sentence embedding adapter backed by sentence-transformers."""

    DEFAULT_MODEL_ID = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    DEFAULT_DIMENSION = 384

    def __init__(
        self,
        model_id: str | None = None,
        device: str | None = None,
        batch_size: int = 32,
    ) -> None:
        """Initialize sentence embedding adapter with deterministic configuration.
        
        Args:
            model_id: Model repository ID or local path.
            device: 'cpu', 'cuda', or None for automatic CPU default.
            batch_size: Default batch size for sequence encoding.
        """
        self.model_id = model_id or self.DEFAULT_MODEL_ID
        self.batch_size = batch_size
        self.device = device or "cpu"

        from sentence_transformers import SentenceTransformer

        # Resolve local directory if present
        load_path = self.model_id
        is_local = False
        if Path(self.model_id).is_dir():
            load_path = str(Path(self.model_id).resolve())
            is_local = True
        else:
            for parent in Path(__file__).resolve().parents:
                candidate = parent / "models" / self.model_id
                if candidate.is_dir():
                    load_path = str(candidate.resolve())
                    is_local = True
                    break

        logger.info("Loading SentenceTransformer from %s (local=%s, device=%s)", load_path, is_local, self.device)
        self.model = SentenceTransformer(
            model_name_or_path=load_path,
            device=self.device,
            local_files_only=is_local,
        )
        dim_fn = getattr(self.model, "get_embedding_dimension", None) or getattr(self.model, "get_sentence_embedding_dimension")
        self._embedding_dimension = dim_fn() or self.DEFAULT_DIMENSION

    @property
    def embedding_dimension(self) -> int:
        """Return the vector dimensionality of output embeddings."""
        return self._embedding_dimension

    def encode(
        self,
        texts: Sequence[str],
        batch_size: int | None = None,
        normalize_embeddings: bool = True,
        show_progress_bar: bool = False,
    ) -> np.ndarray:
        """Encode a sequence of texts into fixed-dimension normalized embedding vectors.
        
        Args:
            texts: Sequence of raw or normalized strings.
            batch_size: Optional override for inference batch size.
            normalize_embeddings: Whether to L2-normalize vectors (essential for cosine distance).
            show_progress_bar: Whether to display a progress bar.
            
        Returns:
            np.ndarray: 2D float32 numpy array of shape (len(texts), embedding_dimension).
        """
        if not texts:
            return np.empty((0, self.embedding_dimension), dtype=np.float32)

        eff_batch_size = batch_size or self.batch_size
        vectors = self.model.encode(
            list(texts),
            batch_size=eff_batch_size,
            normalize_embeddings=normalize_embeddings,
            show_progress_bar=show_progress_bar,
            convert_to_numpy=True,
        )

        return np.asarray(vectors, dtype=np.float32)

