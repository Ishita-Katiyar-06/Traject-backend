import logging
from pathlib import Path
import threading
import time
from typing import Mapping, Sequence

from app.ml.sentiment.inference import (
    EnglishSentimentModel,
    MultilingualSentimentModel,
    SentimentModelAdapter,
)
from app.ml.topics.embeddings import SentenceEmbeddingAdapter

logger = logging.getLogger("traject.ml.pipeline.lifecycle")

DEFAULT_ENGLISH_SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
DEFAULT_MULTILINGUAL_SENTIMENT_MODEL = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class ModelLifecycleManager:
    """Thread-safe, singleton-capable model lifecycle and registry manager.
    
    Invariants:
    - Loads each pretrained model at most once per process.
    - Reuses loaded model instances across multiple batch inferences.
    - Keeps track of distinct cold-start load times vs warm execution.
    - Avoids reloading models between batches or inside per-message loops.
    - Preserves CPU compatibility and existing model identifiers.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._sentiment_adapters: dict[str, SentimentModelAdapter] = {}
        self._embedding_adapters: dict[str, SentenceEmbeddingAdapter] = {}
        self._load_times: dict[str, float] = {}

    def get_sentiment_adapter(
        self,
        model_id: str | None = None,
        device: str | None = None,
        max_length: int = 512,
    ) -> SentimentModelAdapter:
        """Retrieve an initialized sentiment model adapter, loading it if not yet cached.
        
        Args:
            model_id: Hugging Face model repository or local directory path.
            device: 'cpu', 'cuda', or None for automatic CPU default.
            max_length: Maximum sequence length for truncation.
            
        Returns:
            SentimentModelAdapter: Singleton model adapter instance for this process.
        """
        eff_model_id = model_id or DEFAULT_ENGLISH_SENTIMENT_MODEL
        cache_key = f"{eff_model_id}::{device or 'auto'}::{max_length}"

        with self._lock:
            if cache_key in self._sentiment_adapters:
                logger.debug("Reusing cached sentiment adapter for %s", eff_model_id)
                return self._sentiment_adapters[cache_key]

            logger.info("Initializing sentiment adapter for %s (cold start)...", eff_model_id)
            t_start = time.perf_counter()

            if "xlm" in eff_model_id.lower():
                adapter = MultilingualSentimentModel(
                    model_id=eff_model_id,
                    device=device,
                    max_length=max_length,
                )
            else:
                adapter = EnglishSentimentModel(
                    model_id=eff_model_id,
                    device=device,
                    max_length=max_length,
                )

            load_time = time.perf_counter() - t_start
            self._sentiment_adapters[cache_key] = adapter
            self._load_times[f"sentiment::{eff_model_id}"] = round(load_time, 4)
            logger.info("Sentiment adapter for %s loaded in %.3f s", eff_model_id, load_time)
            return adapter

    def get_embedding_adapter(
        self,
        model_id: str | None = None,
        device: str | None = None,
        batch_size: int = 32,
    ) -> SentenceEmbeddingAdapter:
        """Retrieve an initialized sentence embedding adapter, loading it if not yet cached.
        
        Args:
            model_id: SentenceTransformers model repository or local directory path.
            device: 'cpu', 'cuda', or None for automatic CPU default.
            batch_size: Default mini-batch size for encoding.
            
        Returns:
            SentenceEmbeddingAdapter: Singleton embedding adapter instance for this process.
        """
        eff_model_id = model_id or DEFAULT_EMBEDDING_MODEL
        cache_key = f"{eff_model_id}::{device or 'cpu'}::{batch_size}"

        with self._lock:
            if cache_key in self._embedding_adapters:
                logger.debug("Reusing cached embedding adapter for %s", eff_model_id)
                return self._embedding_adapters[cache_key]

            logger.info("Initializing embedding adapter for %s (cold start)...", eff_model_id)
            t_start = time.perf_counter()

            adapter = SentenceEmbeddingAdapter(
                model_id=eff_model_id,
                device=device or "cpu",
                batch_size=batch_size,
            )

            load_time = time.perf_counter() - t_start
            self._embedding_adapters[cache_key] = adapter
            self._load_times[f"embedding::{eff_model_id}"] = round(load_time, 4)
            logger.info("Embedding adapter for %s loaded in %.3f s", eff_model_id, load_time)
            return adapter

    def preload_models(
        self,
        sentiment_model_id: str | None = None,
        embedding_model_id: str | None = None,
        device: str | None = None,
    ) -> None:
        """Eagerly preload model weights to isolate cold-start loading from inference latency."""
        with self._lock:
            self.get_sentiment_adapter(model_id=sentiment_model_id, device=device)
            self.get_embedding_adapter(model_id=embedding_model_id, device=device)

    def get_load_times(self) -> dict[str, float]:
        """Return recorded cold-start model loading times in seconds."""
        with self._lock:
            return dict(self._load_times)

    def is_sentiment_loaded(self, model_id: str | None = None) -> bool:
        """Check if a specific sentiment model adapter is already loaded in memory."""
        eff_model_id = model_id or DEFAULT_ENGLISH_SENTIMENT_MODEL
        with self._lock:
            return any(k.startswith(eff_model_id) for k in self._sentiment_adapters)

    def is_embedding_loaded(self, model_id: str | None = None) -> bool:
        """Check if a specific sentence embedding adapter is already loaded in memory."""
        eff_model_id = model_id or DEFAULT_EMBEDDING_MODEL
        with self._lock:
            return any(k.startswith(eff_model_id) for k in self._embedding_adapters)

    def clear(self) -> None:
        """Clear all cached model references and release resources."""
        with self._lock:
            self._sentiment_adapters.clear()
            self._embedding_adapters.clear()
            self._load_times.clear()
            logger.debug("ModelLifecycleManager cleared all cached adapters.")


# Global default lifecycle instance
_GLOBAL_LIFECYCLE_MANAGER: ModelLifecycleManager | None = None
_GLOBAL_LOCK = threading.Lock()


def get_shared_lifecycle_manager() -> ModelLifecycleManager:
    """Retrieve the process-level singleton ModelLifecycleManager instance."""
    global _GLOBAL_LIFECYCLE_MANAGER
    if _GLOBAL_LIFECYCLE_MANAGER is None:
        with _GLOBAL_LOCK:
            if _GLOBAL_LIFECYCLE_MANAGER is None:
                _GLOBAL_LIFECYCLE_MANAGER = ModelLifecycleManager()
    return _GLOBAL_LIFECYCLE_MANAGER
