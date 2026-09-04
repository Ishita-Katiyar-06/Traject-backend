import logging
from typing import Any

import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.metrics import silhouette_score

from app.ml.topics.models import ClusteringConfig

logger = logging.getLogger("traject.ml.topics.clustering")


def cluster_embeddings(
    embeddings: np.ndarray,
    config: ClusteringConfig | None = None,
) -> tuple[np.ndarray, float | None]:
    """Execute HDBSCAN density-based clustering over semantic sentence embeddings.
    
    Args:
        embeddings: 2D numpy array of shape (N, D), typically L2-normalized.
        config: Clustering hyperparameters. Defaults to ClusteringConfig().
        
    Returns:
        tuple[np.ndarray, float | None]:
            - labels: 1D integer array of shape (N,), where -1 represents noise/outliers
              and 0, 1, 2, ... represent discovered dense clusters.
            - silhouette: Optional float silhouette score computed over valid non-noise clusters.
    """
    cfg = config or ClusteringConfig()
    n_samples = len(embeddings)

    if n_samples < cfg.min_cluster_size:
        logger.warning(
            "Input sample count (%d) is smaller than min_cluster_size (%d); marking all samples as noise.",
            n_samples,
            cfg.min_cluster_size,
        )
        return np.full(n_samples, -1, dtype=int), None

    hdb = HDBSCAN(
        min_cluster_size=cfg.min_cluster_size,
        min_samples=cfg.min_samples,
        metric=cfg.metric,
        cluster_selection_method=cfg.cluster_selection_method,
        copy=True,
    )

    labels = hdb.fit_predict(embeddings)

    # Calculate silhouette score if at least 2 distinct valid clusters exist
    valid_mask = labels != -1
    unique_clusters = set(labels[valid_mask])

    sil_score = None
    if len(unique_clusters) >= 2 and np.sum(valid_mask) > len(unique_clusters):
        try:
            sil_score = round(float(silhouette_score(embeddings[valid_mask], labels[valid_mask])), 4)
        except Exception as exc:
            logger.debug("Could not compute silhouette score: %s", exc)
            sil_score = None

    return labels, sil_score
