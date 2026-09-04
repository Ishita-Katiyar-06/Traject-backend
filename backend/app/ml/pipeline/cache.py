import hashlib
import json
import logging
from pathlib import Path
import sqlite3
import threading
import time
from typing import Any, Sequence

import numpy as np

from app.ml.sentiment.models import SentimentLabel, SentimentPrediction

logger = logging.getLogger("traject.ml.pipeline.cache")

DEFAULT_CACHE_DIR = Path("data/cache")
DEFAULT_CACHE_FILE = "ml_inference_cache.db"
DEFAULT_PIPELINE_VERSION = "4h.v1"


def compute_cache_key(
    namespace: str,
    input_id: str,
    normalized_text: str,
    model_id: str,
    model_revision: str = "default",
    pipeline_version: str = DEFAULT_PIPELINE_VERSION,
) -> str:
    """Deterministically compute a cryptographic SHA-256 cache key.
    
    Invariants:
    - Incorporates pipeline version, model ID, model revision, canonical message ID,
      and normalized text string.
    - Any alteration in normalization logic, model identifier, or revision
      naturally invalidates the cache key without stale collisions.
    - Does not store or expose secrets.
    """
    raw_key = (
        f"{namespace}:{pipeline_version}:{model_id}:{model_revision}:"
        f"{input_id}:{normalized_text}"
    )
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


class InferenceCache:
    """Thread-safe, deterministic SQLite-backed local inference cache.
    
    Capabilities:
    - Caches sentiment predictions (label, confidence, scores) and embedding vectors.
    - Zero external service dependency (pure Python standard library sqlite3).
    - In-memory (:memory:) mode for unit tests and stateless execution.
    - Accurate hit/miss tracking and hit-rate telemetry.
    """

    def __init__(self, db_path: Path | str | None = None) -> None:
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

        if db_path == ":memory:":
            self.db_path = ":memory:"
            self._conn = sqlite3.connect(":memory:", check_same_thread=False)
        else:
            resolved_path = Path(db_path or (DEFAULT_CACHE_DIR / DEFAULT_CACHE_FILE)).resolve()
            resolved_path.parent.mkdir(parents=True, exist_ok=True)
            self.db_path = str(resolved_path)
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False)

        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sentiment_cache (
                        cache_key TEXT PRIMARY KEY,
                        label TEXT NOT NULL,
                        confidence REAL NOT NULL,
                        scores_json TEXT NOT NULL,
                        model_id TEXT NOT NULL,
                        created_at REAL NOT NULL
                    )
                    """
                )
                self._conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS embedding_cache (
                        cache_key TEXT PRIMARY KEY,
                        vector_blob BLOB NOT NULL,
                        dimension INTEGER NOT NULL,
                        model_id TEXT NOT NULL,
                        created_at REAL NOT NULL
                    )
                    """
                )

    def get_sentiment(self, cache_key: str) -> SentimentPrediction | None:
        """Look up a single cached sentiment prediction."""
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                "SELECT label, confidence, scores_json, model_id FROM sentiment_cache WHERE cache_key = ?",
                (cache_key,),
            )
            row = cur.fetchone()
            if row:
                self._hits += 1
                label_str, confidence, scores_json, model_id = row
                return SentimentPrediction(
                    label=SentimentLabel(label_str),
                    confidence=float(confidence),
                    scores=json.loads(scores_json),
                    model_id=model_id,
                )
            self._misses += 1
            return None

    def set_sentiment(self, cache_key: str, prediction: SentimentPrediction) -> None:
        """Store a sentiment prediction into cache."""
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    INSERT OR REPLACE INTO sentiment_cache
                    (cache_key, label, confidence, scores_json, model_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        cache_key,
                        prediction.label.value,
                        float(prediction.confidence),
                        json.dumps(prediction.scores),
                        prediction.model_id,
                        time.time(),
                    ),
                )

    def get_sentiment_batch(
        self, cache_keys: Sequence[str]
    ) -> list[SentimentPrediction | None]:
        """Batch-lookup sentiment predictions preserving input sequence order."""
        return [self.get_sentiment(k) for k in cache_keys]

    def set_sentiment_batch(
        self, items: Sequence[tuple[str, SentimentPrediction]]
    ) -> None:
        """Batch-insert sentiment predictions atomically."""
        if not items:
            return
        with self._lock:
            with self._conn:
                self._conn.executemany(
                    """
                    INSERT OR REPLACE INTO sentiment_cache
                    (cache_key, label, confidence, scores_json, model_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            key,
                            pred.label.value,
                            float(pred.confidence),
                            json.dumps(pred.scores),
                            pred.model_id,
                            time.time(),
                        )
                        for key, pred in items
                    ],
                )

    def get_embedding(self, cache_key: str) -> np.ndarray | None:
        """Look up a single cached embedding vector."""
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                "SELECT vector_blob, dimension FROM embedding_cache WHERE cache_key = ?",
                (cache_key,),
            )
            row = cur.fetchone()
            if row:
                self._hits += 1
                blob, dim = row
                vec = np.frombuffer(blob, dtype=np.float32)
                return vec.copy()
            self._misses += 1
            return None

    def set_embedding(
        self, cache_key: str, vector: np.ndarray, model_id: str = "sentence-transformer"
    ) -> None:
        """Store an embedding vector into cache."""
        vec_f32 = np.asarray(vector, dtype=np.float32)
        dim = int(vec_f32.shape[-1])
        blob = vec_f32.tobytes()

        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    INSERT OR REPLACE INTO embedding_cache
                    (cache_key, vector_blob, dimension, model_id, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (cache_key, blob, dim, model_id, time.time()),
                )

    def get_embedding_batch(
        self, cache_keys: Sequence[str]
    ) -> list[np.ndarray | None]:
        """Batch-lookup embedding vectors preserving input sequence order."""
        return [self.get_embedding(k) for k in cache_keys]

    def set_embedding_batch(
        self, items: Sequence[tuple[str, np.ndarray]], model_id: str = "sentence-transformer"
    ) -> None:
        """Batch-insert embedding vectors atomically."""
        if not items:
            return
        records = []
        now = time.time()
        for key, vec in items:
            vec_f32 = np.asarray(vec, dtype=np.float32)
            records.append((key, vec_f32.tobytes(), int(vec_f32.shape[-1]), model_id, now))

        with self._lock:
            with self._conn:
                self._conn.executemany(
                    """
                    INSERT OR REPLACE INTO embedding_cache
                    (cache_key, vector_blob, dimension, model_id, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    records,
                )

    @property
    def hits(self) -> int:
        return self._hits

    @property
    def misses(self) -> int:
        return self._misses

    @property
    def hit_rate(self) -> float:
        total = self._hits + self._misses
        return round(self._hits / total, 4) if total > 0 else 0.0

    def get_metrics(self) -> dict[str, Any]:
        """Return cache accounting diagnostics."""
        with self._lock:
            return {
                "cache_hits": self._hits,
                "cache_misses": self._misses,
                "cache_hit_rate": self.hit_rate,
                "db_path": self.db_path,
            }

    def reset_metrics(self) -> None:
        """Reset hit and miss counters."""
        with self._lock:
            self._hits = 0
            self._misses = 0

    def clear(self) -> None:
        """Clear all entries in both tables."""
        with self._lock:
            with self._conn:
                self._conn.execute("DELETE FROM sentiment_cache")
                self._conn.execute("DELETE FROM embedding_cache")
            self.reset_metrics()

    def close(self) -> None:
        """Close SQLite database connection cleanly."""
        with self._lock:
            self._conn.close()


class CachedSentimentModelAdapter:
    """Wrapper around SentimentModelAdapter providing transparent deterministic caching."""

    def __init__(
        self,
        adapter: Any,
        cache: InferenceCache | None = None,
        model_revision: str = "default",
        pipeline_version: str = DEFAULT_PIPELINE_VERSION,
    ) -> None:
        self.adapter = adapter
        self.cache = cache
        self.model_revision = model_revision
        self.pipeline_version = pipeline_version
        self.model_id = getattr(adapter, "model_id", "sentiment-model")
        self.device = getattr(adapter, "device", "cpu")
        self.idx_to_label = getattr(adapter, "idx_to_label", {})
        self.max_length = getattr(adapter, "max_length", 512)

    def predict_batch(
        self,
        texts: Sequence[str],
        batch_size: int = 16,
        input_ids: Sequence[str] | None = None,
    ) -> list[SentimentPrediction]:
        text_list = list(texts)
        if not text_list:
            return []

        if self.cache is None:
            return self.adapter.predict_batch(text_list, batch_size=batch_size)

        ids = (
            list(input_ids)
            if input_ids is not None and len(input_ids) == len(text_list)
            else [f"text_{hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]}" for t in text_list]
        )

        keys = [
            compute_cache_key(
                namespace="sentiment",
                input_id=ids[i],
                normalized_text=text_list[i],
                model_id=self.model_id,
                model_revision=self.model_revision,
                pipeline_version=self.pipeline_version,
            )
            for i in range(len(text_list))
        ]

        cached_results = self.cache.get_sentiment_batch(keys)
        miss_indices: list[int] = []
        miss_texts: list[str] = []

        for idx, item in enumerate(cached_results):
            if item is None:
                miss_indices.append(idx)
                miss_texts.append(text_list[idx])

        if miss_texts:
            computed_preds = self.adapter.predict_batch(miss_texts, batch_size=batch_size)
            items_to_cache = [
                (keys[miss_idx], computed_preds[k])
                for k, miss_idx in enumerate(miss_indices)
            ]
            self.cache.set_sentiment_batch(items_to_cache)

            for k, miss_idx in enumerate(miss_indices):
                cached_results[miss_idx] = computed_preds[k]

        return [res for res in cached_results if res is not None]


class CachedSentenceEmbeddingAdapter:
    """Wrapper around SentenceEmbeddingAdapter providing transparent deterministic caching."""

    def __init__(
        self,
        adapter: Any,
        cache: InferenceCache | None = None,
        model_revision: str = "default",
        pipeline_version: str = DEFAULT_PIPELINE_VERSION,
    ) -> None:
        self.adapter = adapter
        self.cache = cache
        self.model_revision = model_revision
        self.pipeline_version = pipeline_version
        self.model_id = getattr(adapter, "model_id", "sentence-transformer")
        self.device = getattr(adapter, "device", "cpu")
        self.batch_size = getattr(adapter, "batch_size", 32)
        self._embedding_dimension = getattr(adapter, "embedding_dimension", 384)

    @property
    def embedding_dimension(self) -> int:
        return self._embedding_dimension

    def encode(
        self,
        texts: Sequence[str],
        batch_size: int | None = None,
        normalize_embeddings: bool = True,
        show_progress_bar: bool = False,
        input_ids: Sequence[str] | None = None,
    ) -> np.ndarray:
        text_list = list(texts)
        if not text_list:
            return np.empty((0, self.embedding_dimension), dtype=np.float32)

        if self.cache is None:
            return self.adapter.encode(
                text_list,
                batch_size=batch_size,
                normalize_embeddings=normalize_embeddings,
                show_progress_bar=show_progress_bar,
            )

        ids = (
            list(input_ids)
            if input_ids is not None and len(input_ids) == len(text_list)
            else [f"text_{hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]}" for t in text_list]
        )

        keys = [
            compute_cache_key(
                namespace="embedding",
                input_id=ids[i],
                normalized_text=text_list[i],
                model_id=self.model_id,
                model_revision=self.model_revision,
                pipeline_version=self.pipeline_version,
            )
            for i in range(len(text_list))
        ]

        cached_vectors = self.cache.get_embedding_batch(keys)
        miss_indices: list[int] = []
        miss_texts: list[str] = []

        for idx, item in enumerate(cached_vectors):
            if item is None:
                miss_indices.append(idx)
                miss_texts.append(text_list[idx])

        if miss_texts:
            eff_batch_size = batch_size or self.batch_size
            computed_vectors = self.adapter.encode(
                miss_texts,
                batch_size=eff_batch_size,
                normalize_embeddings=normalize_embeddings,
                show_progress_bar=show_progress_bar,
            )
            items_to_cache = [
                (keys[miss_idx], computed_vectors[k])
                for k, miss_idx in enumerate(miss_indices)
            ]
            self.cache.set_embedding_batch(items_to_cache, model_id=self.model_id)

            for k, miss_idx in enumerate(miss_indices):
                cached_vectors[miss_idx] = computed_vectors[k]

        return np.asarray(cached_vectors, dtype=np.float32)
