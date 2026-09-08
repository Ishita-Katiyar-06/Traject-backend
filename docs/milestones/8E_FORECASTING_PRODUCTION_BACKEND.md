# Milestone 8E — Emerging Trend Forecasting Production Backend (STOP BEFORE FRONTEND)

**Status**: COMPLETED & VALIDATED  
**Date**: 2026-09-08  
**Scope**: Production Backend Product Boundary for Emerging Trend Forecasting  
**Boundary**: Strict Backend Milestone (STOPPED BEFORE FRONTEND)

---

## 1. Executive Summary & Architecture

Milestone 8E establishes the production backend serving architecture for Emerging Trend Forecasting in TRAJECT. It operationalizes the validated and frozen forecasting strategy from Milestone 8D.1 (`volume_velocity_hybrid`), exposing precomputed forecasts and subsystem operational status via high-performance, typed FastAPI endpoints.

### End-to-End Pipeline Architecture

```
+-------------------------------------------------------------+
| Immutable Disk Artifact                                     |
| data/processed/telegram/emerging_trend_forecasts.json       |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| ForecastArtifactRepository (Thread-Safe, mtime-cached)      |
| - Memory cache invalidation on file modification            |
| - Fast zero-copy object serving                             |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| EmergingTrendForecastService                                |
| - Query parameter validation (horizons [24, 6], bounds)     |
| - Canonical rank sorting & filtering                        |
| - Envelope assembly (ForecastArtifactSummary + Forecasts)   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| FastAPI Endpoints (app/api/v1/forecasting.py)               |
| - GET /api/v1/forecasting/emerging-trends                   |
| - GET /api/v1/forecasting/status                            |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Frontend-Ready API Contract (EmergingTrendsApiResponse)     |
+-------------------------------------------------------------+
```

### Zero-Runtime-Inference Guarantee
Serving forecast requests performs **zero** runtime clustering (`sklearn.cluster.HDBSCAN`), text vectorization (`TfidfVectorizer`), or feature computation. Endpoints serve exclusively from validated, precomputed batch artifacts, guaranteeing sub-millisecond response latency and absolute isolation from analytical training pipelines.

---

## 2. Frozen Forecasting Strategy & Scores (from 8D.1)

All forecasting scores served by the production backend strictly conform to the frozen contract established in Milestone 8D.1:

| Attribute | Specification |
| :--- | :--- |
| **Forecasting Strategy** | `volume_velocity_hybrid` |
| **Strategy Version** | `8D.1_production_freeze` |
| **Score Version** | `8D.1_vol_vel_hybrid_v1` |
| **Primary Horizon** | $H = 24\text{ hours}$ |
| **Auxiliary Horizon** | $H = 6\text{ hours}$ |
| **Score Formula** | $\text{Score} = 0.50 \cdot \text{Percentile}(messages\_24h) + 0.50 \cdot \text{Percentile}(velocity\_6h)$ |

### Validated Walk-Forward Performance (6 Cutoffs, $H=24\text{h}$)
- **ROC-AUC**: `0.7171` (outperforms volume baseline 0.7106 and velocity baseline 0.6798)
- **PR-AUC**: `0.3544` (highest across all tested baselines)
- **F1 Score**: `0.4186` (highest across all tested baselines)
- **Precision@5**: `0.8000` (80% of top 5 recommendations achieve prominence)
- **Precision@10**: `0.8000` (80% of top 10 recommendations achieve prominence)
- **Recall@10**: `0.1860`

---

## 3. Production API Contracts

### Endpoint 1: Retrieve Emerging Trends
- **Route**: `GET /api/v1/forecasting/emerging-trends`
- **Description**: Returns precomputed emerging trend forecasts sorted in canonical priority rank order.
- **Query Parameters**:
  - `horizon_hours` (`int`, default `24`): Forecast horizon in hours. Must be `24` (primary) or `6` (auxiliary). Unsupported values return HTTP 422 (`UNSUPPORTED_HORIZON`).
  - `min_score` (`float`, default `0.0`, range `[0.0, 1.0]`): Minimum forecast score threshold.
  - `tier` (`ForecastTier`, optional): Filter by emergence tier (`STRONG_EMERGENCE`, `MODERATE_EMERGENCE`, `EARLY_SIGNAL`, `LOW_MOMENTUM`).
  - `limit` (`int`, default `50`, range `[1, 200]`): Maximum number of ranked forecasts to return.

#### Response Envelope: `EmergingTrendsApiResponse`
```json
{
  "artifact": {
    "artifact_id": "forecast_20260905_1200_h24",
    "generated_at_utc": "2026-09-08T20:03:41.393164Z",
    "cutoff_at_utc": "2026-09-05T12:00:00Z",
    "horizon_hours": 24,
    "forecasting_strategy": "volume_velocity_hybrid",
    "forecasting_strategy_version": "8D.1_production_freeze",
    "score_version": "8D.1_vol_vel_hybrid_v1",
    "total_candidate_topics": 132,
    "returned_topics_count": 50,
    "metadata": {
      "forecasting_strategy": "volume_velocity_hybrid",
      "forecasting_strategy_version": "8D.1_production_freeze",
      "score_formula": "0.50 * within_cutoff_percentile(messages_24h) + 0.50 * within_cutoff_percentile(velocity_6h)"
    }
  },
  "forecasts": [
    {
      "topic_id": "causal_20260905_1200_062",
      "cutoff_at": "2026-09-05T12:00:00Z",
      "horizon_hours": 24,
      "forecast_score": 1.0,
      "forecast_rank": 1,
      "forecast_tier": "STRONG_EMERGENCE",
      "trajectory_phase": "GROWING",
      "confidence_tier": "LOW",
      "historical_message_count": 18,
      "recent_message_count": 18,
      "messages_24h": 18,
      "baseline_message_count": 0,
      "growth_velocity": 3.0,
      "velocity_6h": 3.0,
      "acceleration_factor": null,
      "persistence_score": 0.1667,
      "channel_diffusion_rate": 0.042,
      "domain_diffusion_rate": 0.0417,
      "burstiness_index": 0.3659,
      "publication_kinetics_available": true,
      "acceleration_available": false,
      "engagement_signal_available": false,
      "generated_at": "2026-09-08T20:03:41.391418Z"
    }
  ]
}
```

### Endpoint 2: Forecasting Subsystem Status
- **Route**: `GET /api/v1/forecasting/status`
- **Description**: Returns operational health, artifact availability, provenance timestamps, and supported horizons. Always returns HTTP 200 to allow graceful frontend degradation.

#### Response Schema: `ForecastingStatusResponse`
```json
{
  "status": "healthy",
  "artifact_available": true,
  "artifact_id": "forecast_20260905_1200_h24",
  "cutoff_at_utc": "2026-09-05T12:00:00Z",
  "generated_at_utc": "2026-09-08T20:03:41.393164Z",
  "total_candidate_topics": 132,
  "total_forecasts": 132,
  "forecasting_strategy": "volume_velocity_hybrid",
  "forecasting_strategy_version": "8D.1_production_freeze",
  "score_version": "8D.1_vol_vel_hybrid_v1",
  "horizon_hours": 24,
  "supported_horizons": [24, 6],
  "last_modified_utc": "2026-09-08T20:03:41.402000Z"
}
```

---

## 4. Error Handling Matrix

| Scenario | HTTP Status | Error Code | Detail Message / Behavior |
| :--- | :--- | :--- | :--- |
| **Unsupported Horizon** | `422` | `UNSUPPORTED_HORIZON` | `Unsupported horizon_hours: 12. Supported horizons: [24, 6]` |
| **Invalid Parameter Bounds** | `400` / `422` | `INVALID_QUERY_PARAMETER` | `Request validation failed: query -> min_score: ...` |
| **Missing Artifact File** | `503` | `FORECAST_ARTIFACT_NOT_FOUND` | Precomputed forecast artifact does not exist on disk |
| **Corrupted Artifact File** | `500` | `FORECAST_ARTIFACT_CORRUPT` | JSON parse error or Pydantic validation failure |
| **Status with Missing Artifact**| `200` | N/A | `{"status": "degraded", "artifact_available": false, ...}` |

---

## 5. Repository Layer & In-Memory Caching (`ForecastArtifactRepository`)

The `ForecastArtifactRepository` operates with an mtime-based thread-safe cache:
1. **Thread-Safe**: Uses `threading.Lock` to coordinate concurrent access during reload.
2. **mtime Detection**: Compares `artifact_path.stat().st_mtime` with cached mtime. If unchanged, returns the existing in-memory `EmergingTrendForecastArtifact` instance directly (zero disk I/O, zero JSON parsing).
3. **Hot Reload**: When batch background jobs overwrite `emerging_trend_forecasts.json`, the repository detects the altered mtime on the next request and reloads seamlessly without requiring server restart.

---

## 6. Frontend Integration Contract (Preparation for Future UI)

When the frontend milestone is initiated, the UI should consume this backend contract as follows:

1. **Header & Freshness**:
   - Query `GET /api/v1/forecasting/status`.
   - Display `cutoff_at_utc` as the forecasting observation cutoff.
   - If `artifact_available == false`, render an informative empty state (*"Forecasting model running initial batch..."*).
2. **Main Forecast Table / Cards**:
   - Query `GET /api/v1/forecasting/emerging-trends?horizon_hours=24&limit=20`.
   - Primary metric: `forecast_score` formatted as percentage or decimal with rank badge (`forecast_rank`).
   - Signals: Display `messages_24h` (Volume) and `velocity_6h` (Momentum).
   - Categorical badges: `forecast_tier` (`STRONG_EMERGENCE`, `MODERATE_EMERGENCE`) and `trajectory_phase` (`GROWING`, `ACCELERATING`).
3. **Interactive Controls**:
   - Horizon toggle between `24h` (primary) and `6h` (tactical momentum).
   - Minimum score threshold slider (`0.0` to `1.0`).
   - Tier selector filter.
