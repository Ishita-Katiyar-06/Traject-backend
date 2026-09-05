# Milestone 5A: Backend Analytics API Specification & Handoff Contract
**TRAJECT — Social Media Narrative Intelligence Engine**  
**Document Status:** FROZEN IMPLEMENTATION SPECIFICATION (P0 Engineering Contract)  
**Target Milestone:** 5A (Backend Analytics API Foundation)  
**Upstream Milestones (FROZEN):** 3A–3C (Storage/Quality/Replay), 4A–4H (ML Pipeline & Productionization)  
**Target Audience:** Backend API Engineer, Frontend Integration Engineer, ML Team Lead  
**Document Author:** TRAJECT Architecture & Systems Team  

---

## Table of Contents
1. [Executive Summary & Scope Definition](#1-executive-summary--scope-definition)
2. [Current Codebase Reality & Inspection Findings](#2-current-codebase-reality--inspection-findings)
3. [Upstream Frozen ML Contract (Milestones 4A–4H)](#3-upstream-frozen-ml-contract-milestones-4a4h)
4. [High-Level Architecture & Layer Separation](#4-high-level-architecture--layer-separation)
5. [Technology Stack & Dependency Additions](#5-technology-stack--dependency-additions)
6. [API Versioning & Base URL Scheme](#6-api-versioning--base-url-scheme)
7. [API Response Envelope & Protocol Standards](#7-api-response-envelope--protocol-standards)
8. [Unified Error Handling Contract](#8-unified-error-handling-contract)
9. [Artifact Ingestion, Caching, & Provenance Architecture](#9-artifact-ingestion-caching--provenance-architecture)
10. [Detailed Endpoint Specifications (The 29 Contract Elements)](#10-detailed-endpoint-specifications-the-29-contract-elements)
    * 10.1 `GET /api/v1/health`
    * 10.2 `GET /api/v1/analytics`
    * 10.3 `GET /api/v1/narratives`
    * 10.4 `GET /api/v1/narratives/{narrative_id}`
    * 10.5 `GET /api/v1/topics`
    * 10.6 `GET /api/v1/topics/{topic_id}`
    * 10.7 `GET /api/v1/messages`
    * 10.8 `GET /api/v1/messages/{message_id}`
    * 10.9 `GET /api/v1/pipeline/status`
    * 10.10 `GET /api/v1/pipeline/metrics`
11. [Priority Score Contract & 4G Semantic Guardrails](#11-priority-score-contract--4g-semantic-guardrails)
12. [Topic Representation & HDBSCAN Noise Semantics](#12-topic-representation--hdbscan-noise-semantics)
13. [Canonical Message ID Semantics & Platform Abstraction](#13-canonical-message-id-semantics--platform-abstraction)
14. [Pagination, Filtering, and Sorting Contracts](#14-pagination-filtering-and-sorting-contracts)
15. [Data Consistency, Edge Cases, & Empty Data Behavior](#15-data-consistency-edge-cases--empty-data-behavior)
16. [Security, CORS, Configuration, & Observability](#16-security-cors-configuration--observability)
17. [Frontend Consumption Contract & Integration Guide](#17-frontend-consumption-contract--integration-guide)
18. [Internal Architecture & Proposed File Structure](#18-internal-architecture--proposed-file-structure)
19. [Testing Contract & Real-Data Smoke Test Protocol](#19-testing-contract--real-data-smoke-test-protocol)
20. [Prohibited Changes & Strict Invariants](#20-prohibited-changes--strict-invariants)
21. [Step-by-Step Implementation Sequence](#21-step-by-step-implementation-sequence)
22. [Milestone 5A Acceptance Criteria & Definition of Done](#22-milestone-5a-acceptance-criteria--definition-of-done)
23. [Architectural Decision Records (ADRs)](#23-architectural-decision-records-adrs)
24. [Upstream-to-API Traceability Matrix](#24-upstream-to-api-traceability-matrix)
25. ["Do Not Guess" Unresolved Decisions Log](#25-do-not-guess-unresolved-decisions-log)
26. [Final Engineering Handoff](#26-final-engineering-handoff)

---

## 1. Executive Summary & Scope Definition

Milestone 5A establishes the **Backend Analytics API Foundation** for TRAJECT. It introduces a high-performance, typed, versioned HTTP serving layer using **FastAPI** to expose processed intelligence to the downstream user interface.

### The Immutable Boundary: Serving Layer vs. Computation Layer
```
=============================================================================
                       OFFLINE / ASYNCHRONOUS PIPELINE
=============================================================================
 Raw Data Ingestion (JSONL)
        ↓
 Telegram / Platform Normalizers (app.normalizers)
        ↓
 Quality Validation & Deduplication (app.quality)
        ↓
 Parquet Columnar Storage (app.storage.parquet) ──→ [ data/processed/*.parquet ]
        ↓
 Unified ML Pipeline Orchestrator (app.ml.pipeline.orchestrator)
    - Language Identification & Safe Normalization (app.ml.dataset)
    - Cached Sentence Embeddings (MiniLM-L12-v2)
    - HDBSCAN Density Topic Discovery (app.ml.topics)
    - Contextual Feature Enrichment: Spread, Engagement, Temporal (app.ml.features)
    - Batched Sentiment Fusion & Priority Scoring (app.ml.narratives)
        ↓
 Precomputed Analytics Artifacts ───────────────→ [ data/processed/*.json ]
=============================================================================
                       MILESTONE 5A SERVING LAYER
=============================================================================
 Artifact Repositories & In-Memory Indexers
        ↓
 Internal Service Layer (Querying, Filtering, Slicing, Sorting)
        ↓
 Versioned FastAPI HTTP Routers (/api/v1)
        ↓
 Pydantic v2 Response Serialization & Error Handling
        ↓
 TRAJECT Analyst Dashboard (Frontend)
```

### Core Directive: API MUST NOT BECOME AN ML LAYER
The backend API is strictly a **read-heavy serving engine**. Normal GET requests against analytics, narratives, topics, or messages **MUST NEVER** execute transformer inference, fit clustering algorithms, calculate embedding vectors, or invoke heavy ML routines. The API reads, validates, filters, and serves **precomputed analytics artifacts** produced upstream by Milestone 4H.

---

## 2. Current Codebase Reality & Inspection Findings

A thorough empirical inspection of the repository (`backend/`, `pyproject.toml`, `.env.example`, `app/`, `tests/`) reveals the exact system foundation on which Milestone 5A is built:

| Subsystem | Location | Current State | Notes for Milestone 5A |
| :--- | :--- | :--- | :--- |
| **Project Dependencies** | `backend/pyproject.toml` | `pydantic>=2.6.0`, `pyarrow>=15.0.0`, `torch`, `transformers`, `sentence-transformers`, `scikit-learn` | **FastAPI and Uvicorn are NOT yet installed.** They must be added to `dependencies`. |
| **Environment Configuration** | `backend/app/core/config.py`, `.env.example` | Root-finding logic (`find_repo_root()`) and `load_project_env()` exist. `.env.example` already defines `API_HOST=127.0.0.1`, `API_PORT=8000`, `API_PREFIX=/api/v1`, `API_CORS_ORIGINS`. | Milestone 5A must implement a typed `APISettings` class integrating with `app.core.config`. |
| **Canonical Message Contract** | `backend/app/schemas/canonical_message.py` | Complete Pydantic v2 model (`CanonicalMessage`), `Platform` enum (`telegram`, `x`), `AuthorType` enum (`channel`, `group`, `user`, `unknown`). | Telegram IDs are chat-scoped: `telegram:{chat_id}:{native_id}`. X IDs are `x:{native_id}`. |
| **Parquet Storage Engine** | `backend/app/storage/parquet.py` | Apache Arrow schema (`CANONICAL_MESSAGE_ARROW_SCHEMA`), `read_canonical_messages()`, `read_parquet_metadata()`. | Storage is immutable. Reading Parquet reconstructs validated `CanonicalMessage` objects. |
| **Data Quality & Audit** | `backend/app/quality/validation.py` | `QualityReport`, `process_quality()`, deduplication audit log. | Accompanies Parquet datasets as `<name>.quality.json`. |
| **Unified ML Pipeline Orchestrator** | `backend/app/ml/pipeline/orchestrator.py` | Produces `MLPipelineResult` containing `metrics`, `topics`, `enriched_topics`, `narrative_report`. Saves JSON via `save_analytics_artifact()`. | **This JSON artifact is the primary data source for the Analytics API.** |
| **Topic Discovery Contract** | `backend/app/ml/topics/models.py` | `TopicDiscoveryResult`, `TopicRecord`, `TopicKeyword`, `ClusteringConfig`. | Topics have numeric labels (`cluster_label >= 0`), noise is `-1`. Representative keywords have c-TF-IDF scores. |
| **Feature Enrichment Contract** | `backend/app/ml/features/models.py` | `TopicEnrichmentResult`, `EnrichedTopicCandidate`, `TopicEngagementFeatures`, `TopicPropagationFeatures`, `TopicTemporalFeatures`. | Contains verified cross-channel spread, uncredited syndication, arrival burstiness, velocity. |
| **Narrative Assessment Contract** | `backend/app/ml/narratives/models.py` | `NarrativeAssessmentReport`, `NarrativeCandidate`, `NarrativeSubScores`, `PotentialCoordinationSignals`, `NarrativeDataCoverage`. | Precomputed priority scores ($[0.0, 1.0]$), priority tiers (`CRITICAL`, `HIGH`, `ELEVATED`, `ROUTINE`). |
| **Existing Test Suite** | `backend/tests/` | 180 passing tests spanning 4A–4H (`tests/test_ml_pipeline.py`, `tests/test_narratives.py`, `tests/test_topic_features.py`). | Complete test isolation, synthetic JSONL fixtures, fast offline execution. |

---

## 3. Upstream Frozen ML Contract (Milestones 4A–4H)

The API engineer must treat the existing ML modules as **frozen upstream contracts**. No API work may alter their signatures, configurations, thresholds, or mathematical formulations.

### Upstream Component Invariants
1. **Milestone 4A (Dataset Boundary)**: Ingests only processed Parquet. Filters media-only messages (`text_content=""`, `has_media=True`) out of NLP modeling without deleting them from storage.
2. **Milestone 4B (Language & Normalization)**: `langdetect` with pinned seed 0. Safe NFC text normalization preserving URLs, handles, hashtags, and emojis.
3. **Milestone 4C & 4D (Sentiment Baseline & Multilingual)**: English routed to `cardiffnlp/twitter-roberta-base-sentiment-latest`; multilingual routed to `cardiffnlp/twitter-xlm-roberta-base-sentiment`.
4. **Milestone 4E (Topic Discovery)**: Frozen `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384-dim, L2-normalized). HDBSCAN density clustering (`min_cluster_size=2`, `min_samples=1`). Class-based TF-IDF (`c-TF-IDF`) keyword weighting. Centroid distance message selection.
5. **Milestone 4F (Feature Enrichment)**: Deterministic entity extraction (hashtags, handles, domains, multilingual gazetteers). Engagement metrics and safe zero-division ratios. Propagation tracking (`cross_channel_observed_spread`, `uncredited_syndication_count`). Temporal metrics (burstiness index $B \in [-1, 1]$, channel entry velocity).
6. **Milestone 4G (Narrative Priority Scoring)**: Explainable 4-component weighted priority score ($[0.0, 1.0]$), discrete triage tiers, potential coordination signal flags, observational evidence density grading (`HIGH`, `MODERATE`, `SPARSE`).
7. **Milestone 4H (Productionization & Artifact Generation)**: Thread-safe SQLite caching (`InferenceCache`), singleton model lifecycle manager (`ModelLifecycleManager`), unified CLI producing `MLPipelineResult` serialized as JSON.

---

## 4. High-Level Architecture & Layer Separation

The TRAJECT backend follows a strict layered separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (FastAPI Routers)                       │
│  - HTTP Route Matching & Parameter Parsing (Path, Query, Headers)           │
│  - Request Validation & Bounds Checking (Pydantic v2)                       │
│  - HTTP Status Code & Error Envelope Mapping                                │
│  - Dependency Injection (Settings, Repositories, Services)                  │
│  - OpenAPI Schema Generation & Serialization                                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Calls
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER (Orchestration)                     │
│  - Business Logic, Filtering, Sorting, Slicing, Pagination                  │
│  - Cross-Entity Joining (e.g., Narrative -> Topic -> Canonical Messages)    │
│  - In-Memory Index Lookups & Aggregations                                   │
│  - Read-Only Analytics Compilation                                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Calls
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REPOSITORY LAYER (Artifact & Storage Access)            │
│  - Artifact Discovery & Lazy/Startup Loading                                │
│  - In-Memory Thread-Safe Artifact Caching                                   │
│  - Parquet Message Deserialization (app.storage.parquet)                    │
│  - JSON Precomputed Analytics Deserialization (MLPipelineResult)            │
│  - File Watcher / Cache Invalidation Hooks                                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Reads
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (Immutable Filesystem Storage)              │
│  - Parquet Columnar Datasets: data/processed/<dataset>.parquet              │
│  - Quality Audit Reports: data/processed/<dataset>.quality.json             │
│  - Precomputed Analytics: data/processed/<dataset>-analytics-artifact.json  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Explicit Responsibilities by Layer
* **Dataset Layer (`/api/v1/messages`)**: Exposes normalized raw and canonical social media posts directly from Parquet datasets. Provides message-level drill-down.
* **Analytics Layer (`/api/v1/analytics`, `/api/v1/narratives`, `/api/v1/topics`)**: Exposes ML-synthesized clusterings, features, framing, coordination indicators, sentiment profiles, and prioritized narrative triage queues.
* **Pipeline Layer (`/api/v1/pipeline/status`, `/api/v1/pipeline/metrics`)**: Exposes system observability, execution timestamps, stage latencies, memory footprint, cache hit rates, and dataset provenance.
* **API Layer**: Exclusively handles HTTP serialization, deserialization, status codes, CORS headers, parameter validation, and documentation generation. **No computational ML algorithms reside here.**

---

## 5. Technology Stack & Dependency Additions

### Runtime Frameworks
* **Web Framework:** `FastAPI` (>=0.110.0) — High-performance, async-native, built-in Pydantic v2 integration, automatic OpenAPI 3.1 generation.
* **ASGI Server:** `Uvicorn` (>=0.28.0) — Production-ready standard ASGI server with lifespan support.
* **Schema Validation & Settings:** `Pydantic` (>=2.6.0, already present), `pydantic-settings` (>=2.2.0) — For type-safe environment variable management.
* **Columnar Storage:** `PyArrow` (>=15.0.0, already present) — Fast columnar Parquet deserialization.

### Dependency Update Specification for `pyproject.toml`
The teammate implementing Milestone 5A must update `backend/pyproject.toml` dependencies to include:
```toml
dependencies = [
    "pydantic>=2.6.0",
    "pydantic-settings>=2.2.0",
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.28.0",
    "telethon>=1.36.0",
    "python-dotenv>=1.0.0",
    "pyarrow>=15.0.0",
    "tzdata; sys_platform == 'win32'",
    "langdetect>=1.0.9",
    "torch>=2.2.0",
    "transformers>=4.40.0",
    "sentencepiece>=0.2.0",
    "protobuf>=4.25.0",
    "sentence-transformers>=3.0.0",
    "scikit-learn>=1.3.0",
]

[project.optional-dependencies]
test = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",  # Required for FastAPI TestClient
]
```

### Prohibited Infrastructure
Do **NOT** introduce:
* Redis, Memcached (Process memory and local SQLite caching are sufficient for single-node Milestone 5A).
* Celery, RabbitMQ, Kafka (Asynchronous messaging is out of scope for Milestone 5A).
* Docker, Kubernetes, Helm (Single-node Python package architecture).
* PostgreSQL, MySQL, MongoDB, SQLite ORMs (Serving reads Parquet and JSON files directly).

---

## 6. API Versioning & Base URL Scheme

### URI Prefix
All externally exposed API endpoints reside under the `/api/v1` prefix:
```
http://{host}:{port}/api/v1/{resource}
```

### Versioning Rationale
1. **Contract Stability:** The frontend dashboard will be developed against this contract. Changes to ML features or canonical schemas must not break deployed frontends.
2. **Parallel Evolutionary Path:** Future milestones introducing real-time streaming (e.g. WebSocket feeds or SSE in v2) can coexist alongside the static batch-serving endpoints in v1.
3. **Deprecation Grace Period:** Allows backward compatibility when schema revisions occur.

---

## 7. API Response Envelope & Protocol Standards

### Single Resource Envelope
Direct object serialization with consistent top-level fields:
```json
{
  "data": { ... }
}
```

### Collection / List Resource Envelope
All paginated list endpoints return a strict two-key structure (`data` and `meta`):
```json
{
  "data": [ ... ],
  "meta": {
    "total": 128,
    "page": 1,
    "page_size": 20,
    "total_pages": 7,
    "has_next": true,
    "has_prev": false
  }
}
```

### Field Naming Convention
* Strictly **snake_case** for all JSON keys (`canonical_id`, `published_at`, `priority_signal_score`).
* Datetimes are strictly serialized as ISO-8601 strings with timezone offset in UTC (`YYYY-MM-DDTHH:MM:SSZ` or `+00:00`).
* Numeric floats are rounded to 4 decimal places where appropriate (matching 4F/4G/4H outputs).

---

## 8. Unified Error Handling Contract

All error responses (4xx and 5xx) return a standardized error envelope:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Narrative candidate with ID 'narrative_999' was not found.",
    "details": {
      "resource_type": "narrative",
      "identifier": "narrative_999"
    },
    "timestamp_utc": "2026-09-05T08:30:00Z"
  }
}
```

### Standard Error Codes & HTTP Mapping
| HTTP Status | Error Code | Trigger Condition |
| :--- | :--- | :--- |
| **400 Bad Request** | `INVALID_QUERY_PARAMETER` | Parameter failed validation (e.g. `page < 1`, invalid sort field). |
| **400 Bad Request** | `INVALID_FILTER_VALUE` | Filter value unrecognized (e.g. `priority_tier=extreme`). |
| **404 Not Found** | `RESOURCE_NOT_FOUND` | Message, Topic, or Narrative ID does not exist in loaded dataset. |
| **503 Service Unavailable** | `ARTIFACT_NOT_FOUND` | Configured precomputed analytics JSON or Parquet file is missing. |
| **500 Internal Server Error**| `ARTIFACT_CORRUPTED` | Artifact file exists but failed JSON parsing or Pydantic validation. |
| **500 Internal Server Error**| `INTERNAL_SERVER_ERROR`| Unhandled server exception (stack trace logged internally, never leaked).|

---

## 9. Artifact Ingestion, Caching, & Provenance Architecture

### Authoritative Sources of Truth
1. **Message Data**: Primary source is `data/processed/<dataset>.parquet` (reconstructed via `app.storage.parquet.read_canonical_messages`).
2. **Analytics Overview & Stage Metrics**: Primary source is the top-level keys (`metrics`, `created_at_utc`, `dataset_source`) of `data/processed/<dataset>-analytics-artifact.json` (`MLPipelineResult`).
3. **Topics**: Source is `topics` (`TopicDiscoveryResult`) and `enriched_topics` (`TopicEnrichmentResult`) inside the analytics artifact.
4. **Narratives**: Source is `narrative_report` (`NarrativeAssessmentReport`) inside the analytics artifact.

### Lifecycle & In-Memory Indexing
To guarantee sub-millisecond response times without re-reading disks on every HTTP request:
* **Startup Initialization (Lifespan):** During FastAPI startup (`@asynccontextmanager` lifespan), the `ArtifactRepository` loads the active Parquet dataset and precomputed analytics JSON.
* **In-Memory Indices:** The repository constructs lookup hash tables:
  - `dict[canonical_id, CanonicalMessage]`
  - `dict[topic_id, TopicRecord]`
  - `dict[topic_id, EnrichedTopicCandidate]`
  - `dict[narrative_id, NarrativeCandidate]`
  - Sorted index of narratives by `priority_signal_score DESC`.
* **Read-Only Invariant:** In-memory indices are immutable during request handling. Concurrent reads are 100% thread-safe.
* **Hot Reloading:** A background task or management hook can reload artifacts if the file timestamp updates, without restarting the process.

---

## 10. Detailed Endpoint Specifications (The 29 Contract Elements)

Each endpoint specification below provides the full 29 contract criteria required for deterministic, error-free implementation.

---

### 10.1 `GET /api/v1/health`

1. **Purpose:** Provide operational readiness and liveness status of the backend API and indicate whether required precomputed analytics artifacts are loaded and ready to serve.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/health`
4. **Authentication:** None (Public).
5. **Query Parameters:** None.
6. **Path Parameters:** None.
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `HealthResponse`
10. **Required Response Fields:** `status` (str), `version` (str), `artifacts_loaded` (bool), `timestamp_utc` (str).
11. **Optional Response Fields:** `dataset_source` (str | None), `active_records_count` (int | None), `active_narratives_count` (int | None).
12. **Field Types:**
    * `status`: `str` (`"healthy"` | `"degraded"`)
    * `version`: `str`
    * `artifacts_loaded`: `bool`
    * `timestamp_utc`: `str` (ISO-8601)
    * `dataset_source`: `str | None`
    * `active_records_count`: `int | None`
    * `active_narratives_count`: `int | None`
13. **Field Meanings:** System operational state, version identifier, artifact availability flag, and basic dataset scale indicators.
14. **Validation Rules:** `status` must be `"healthy"` if `artifacts_loaded == True`, otherwise `"degraded"`.
15. **Default Values:** N/A.
16. **Pagination Behavior:** Non-paginated.
17. **Sorting Behavior:** N/A.
18. **Filtering Behavior:** N/A.
19. **Error Responses:** Standard 500 if unexpected internal system failure occurs.
20. **HTTP Status Codes:** `200 OK` (when running, even if degraded), `500 Internal Server Error`.
21. **Example Request:** `GET /api/v1/health HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "status": "healthy",
      "version": "0.1.0",
      "artifacts_loaded": true,
      "timestamp_utc": "2026-09-05T12:00:00Z",
      "dataset_source": "telegram_messages.parquet",
      "active_records_count": 16,
      "active_narratives_count": 3
    }
    ```
23. **Example Error Response:**
    ```json
    {
      "error": {
        "code": "INTERNAL_SERVER_ERROR",
        "message": "Health probe failed.",
        "timestamp_utc": "2026-09-05T12:00:00Z"
      }
    }
    ```
24. **Performance Expectations:** Target < 2ms latency. Simple in-memory flag check.
25. **Data Source / Artifact Consumed:** In-memory `ArtifactRepository` status.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory, no HTTP caching header required.
29. **Determinism:** 100% deterministic based on repository state.

---

### 10.2 `GET /api/v1/analytics`

1. **Purpose:** Provide a high-level, dashboard-ready summary of dataset statistics, topic distribution, narrative priority distribution, sentiment overview, and pipeline execution metadata.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/analytics`
4. **Authentication:** None (Milestone 5A).
5. **Query Parameters:** None.
6. **Path Parameters:** None.
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `AnalyticsOverviewResponse`
10. **Required Response Fields:** `data` containing `dataset_source`, `summary_counts`, `priority_distribution`, `sentiment_overview`, `pipeline_execution`.
11. **Optional Response Fields:** None.
12. **Field Types:**
    * `dataset_source`: `str`
    * `summary_counts`: `DatasetSummaryCounts` (ints: `total_messages`, `text_bearing_messages`, `media_only_messages`, `total_topics`, `total_narratives`, `noise_messages`)
    * `priority_distribution`: `dict[str, int]` (counts for `critical`, `high`, `elevated`, `routine`)
    * `sentiment_overview`: `SentimentOverview` (`sentiment_model_id`, `evaluated_messages_count`, `distribution` of pos/neu/neg)
    * `pipeline_execution`: `PipelineExecutionSummary` (`created_at_utc`, `total_runtime_seconds`, `cache_hit_rate`)
13. **Field Meanings:** Top-level executive metrics enabling the analyst dashboard to render global statistics.
14. **Validation Rules:** All counts must be non-negative integers ($\ge 0$).
15. **Default Values:** N/A.
16. **Pagination Behavior:** Non-paginated (single summary object).
17. **Sorting Behavior:** N/A.
18. **Filtering Behavior:** N/A.
19. **Error Responses:** 503 if precomputed analytics artifact is not loaded.
20. **HTTP Status Codes:** `200 OK`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/analytics HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "data": {
        "dataset_source": "synthetic_enrichment_fixture.jsonl",
        "summary_counts": {
          "total_messages": 16,
          "text_bearing_messages": 16,
          "media_only_messages": 0,
          "total_topics": 3,
          "total_narratives": 3,
          "noise_messages": 0
        },
        "priority_distribution": {
          "critical": 0,
          "high": 0,
          "elevated": 2,
          "routine": 1
        },
        "sentiment_overview": {
          "sentiment_model_id": "cardiffnlp/twitter-roberta-base-sentiment-latest",
          "evaluated_messages_count": 16,
          "distribution": {
            "positive_ratio": 0.25,
            "neutral_ratio": 0.50,
            "negative_ratio": 0.25
          }
        },
        "pipeline_execution": {
          "created_at_utc": "2026-09-05T08:00:00Z",
          "total_runtime_seconds": 1.452,
          "cache_hit_rate": 1.0
        }
      }
    }
    ```
23. **Example Error Response:**
    ```json
    {
      "error": {
        "code": "ARTIFACT_NOT_FOUND",
        "message": "Analytics overview is unavailable because the precomputed analytics artifact has not been loaded.",
        "timestamp_utc": "2026-09-05T08:05:00Z"
      }
    }
    ```
24. **Performance Expectations:** Sub-5ms response time (computed from in-memory artifact).
25. **Data Source / Artifact Consumed:** Top-level sections of `MLPipelineResult`.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory repository cache.
29. **Determinism:** 100% deterministic for a given loaded artifact.

---

### 10.3 `GET /api/v1/narratives`

1. **Purpose:** Retrieve a paginated, filterable, and sortable list of prioritized narrative candidates synthesized by the ML engine.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/narratives`
4. **Authentication:** None.
5. **Query Parameters:**
    * `page`: `int` (default `1`, ge `1`)
    * `page_size`: `int` (default `20`, ge `1`, le `100`)
    * `priority_tier`: `str | None` (`critical`, `high`, `elevated`, `routine`)
    * `min_priority`: `float | None` (ge `0.0`, le `1.0`)
    * `has_coordination_signal`: `bool | None` (filter to candidates with at least one flag)
    * `sort_by`: `str` (default `priority_signal_score`, allowed: `priority_signal_score`, `spread_score`, `coordination_score`, `reach_score`, `friction_score`, `first_observed_at`, `last_observed_at`)
    * `order`: `str` (default `desc`, allowed: `asc`, `desc`)
6. **Path Parameters:** None.
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `NarrativeListResponse`
10. **Required Response Fields:** `data` (list of `NarrativeSummaryResponse`), `meta` (`PaginationMeta`).
11. **Optional Response Fields:** None.
12. **Field Types:**
    * `data`: `list[NarrativeSummaryResponse]`
    * `meta`: `PaginationMeta` (`total`, `page`, `page_size`, `total_pages`, `has_next`, `has_prev`)
13. **Field Meanings:** Collection of prioritized narrative summaries for analyst triage.
14. **Validation Rules:** Query parameters strictly bound and validated against allowed enums.
15. **Default Values:** `page=1`, `page_size=20`, `sort_by="priority_signal_score"`, `order="desc"`.
16. **Pagination Behavior:** Offset-based pagination over the in-memory filtered array.
17. **Sorting Behavior:** Deterministic sorting; ties broken by `narrative_id ASC`.
18. **Filtering Behavior:** Multiple filters applied via logical AND.
19. **Error Responses:** 400 for invalid query parameters; 503 if artifact not loaded.
20. **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/narratives?priority_tier=elevated&page=1&page_size=10 HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "data": [
        {
          "narrative_id": "narrative_000",
          "promoted_from_topic_id": "topic_001",
          "headline_claim": "[border, security] surveillance, forces, patrol",
          "priority_signal_score": 0.4914,
          "priority_tier": "elevated",
          "sub_scores": {
            "spread_score": 0.4500,
            "coordination_score": 0.5200,
            "reach_score": 0.4800,
            "friction_score": 0.5400
          },
          "has_coordination_signals": true,
          "evidence_density": "high",
          "message_count": 5,
          "first_observed_at": "2026-09-02T12:00:00Z",
          "last_observed_at": "2026-09-02T18:30:00Z"
        }
      ],
      "meta": {
        "total": 1,
        "page": 1,
        "page_size": 10,
        "total_pages": 1,
        "has_next": false,
        "has_prev": false
      }
    }
    ```
23. **Example Error Response:**
    ```json
    {
      "error": {
        "code": "INVALID_QUERY_PARAMETER",
        "message": "Invalid priority_tier 'urgent'. Allowed values: 'critical', 'high', 'elevated', 'routine'.",
        "timestamp_utc": "2026-09-05T08:10:00Z"
      }
    }
    ```
24. **Performance Expectations:** < 10ms for 1,000 candidates.
25. **Data Source / Artifact Consumed:** `narrative_report.narrative_candidates` from analytics artifact.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory repository cache.
29. **Determinism:** 100% deterministic (stable tie-breaking).

---

### 10.4 `GET /api/v1/narratives/{narrative_id}`

1. **Purpose:** Retrieve complete, explainable analytical details for a specific narrative candidate, including component score attribution, potential coordination signals, evidence coverage, entities, and representative excerpts.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/narratives/{narrative_id}`
4. **Authentication:** None.
5. **Query Parameters:** None.
6. **Path Parameters:** `narrative_id: str` (e.g. `narrative_000`).
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `NarrativeDetailResponse`
10. **Required Response Fields:** `data` containing full `NarrativeCandidate` fields: `narrative_id`, `promoted_from_topic_id`, `headline_claim`, `priority_signal_score`, `priority_tier`, `sub_scores`, `coordination_signals`, `data_coverage`, `sentiment_profile`, `key_entities`, `broadcasting_channels`, `origin_channels`, `representative_message_excerpts`, `first_observed_at`, `last_observed_at`, `audit_rationale`.
11. **Optional Response Fields:** None.
12. **Field Types:** Strictly conforming to `app.ml.narratives.models.NarrativeCandidate`.
13. **Field Meanings:** Full explainability payload allowing an analyst to audit why a narrative was elevated and review constituent signals.
14. **Validation Rules:** `narrative_id` must match pattern `^narrative_\d{3,}$`.
15. **Default Values:** N/A.
16. **Pagination Behavior:** Non-paginated.
17. **Sorting Behavior:** N/A.
18. **Filtering Behavior:** N/A.
19. **Error Responses:** 404 if ID does not exist; 503 if artifact not loaded.
20. **HTTP Status Codes:** `200 OK`, `404 Not Found`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/narratives/narrative_000 HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "data": {
        "narrative_id": "narrative_000",
        "promoted_from_topic_id": "topic_001",
        "headline_claim": "[border, security] surveillance, forces, patrol",
        "priority_signal_score": 0.4914,
        "priority_tier": "elevated",
        "sub_scores": {
          "spread_score": 0.45,
          "coordination_score": 0.52,
          "reach_score": 0.48,
          "friction_score": 0.54
        },
        "coordination_signals": {
          "potential_syndication_spike": false,
          "potential_temporal_burst": true,
          "potential_rapid_channel_entry": false,
          "potential_cross_channel_cascade": true
        },
        "data_coverage": {
          "message_count": 5,
          "channel_count": 3,
          "timespan_seconds": 23400.0,
          "has_views_coverage": true,
          "has_reactions_coverage": true,
          "evidence_density": "high",
          "data_quality_notes": []
        },
        "sentiment_profile": {
          "is_available": true,
          "total_text_messages_evaluated": 5,
          "text_positive_ratio": 0.20,
          "text_neutral_ratio": 0.60,
          "text_negative_ratio": 0.20,
          "emoji_polarity_score": 0.15,
          "sentiment_model_id": "cardiffnlp/twitter-roberta-base-sentiment-latest"
        },
        "key_entities": [
          "hashtag:borderpatrol",
          "gazetteer_geo:Ladakh"
        ],
        "broadcasting_channels": ["chan_alpha", "chan_beta"],
        "origin_channels": ["chan_origin_1"],
        "representative_message_excerpts": [
          "Border security outpost reports full perimeter surveillance established without incident."
        ],
        "first_observed_at": "2026-09-02T12:00:00Z",
        "last_observed_at": "2026-09-02T18:30:00Z",
        "audit_rationale": [
          "Priority/Narrative Signal Score: 0.4914 (ELEVATED) | Component attribution: Spread 0.45 (w=0.3), Coordination 0.52 (w=0.3), Observed Reach 0.48 (w=0.2), Friction 0.54 (w=0.2).",
          "Potential coordination/anomaly signal: concentrated inter-arrival temporal burstiness detected (B = +0.28) across distinct publishing sources."
        ]
      }
    }
    ```
23. **Example Error Response:**
    ```json
    {
      "error": {
        "code": "RESOURCE_NOT_FOUND",
        "message": "Narrative candidate 'narrative_999' not found.",
        "details": {
          "resource_type": "narrative",
          "identifier": "narrative_999"
        },
        "timestamp_utc": "2026-09-05T08:15:00Z"
      }
    }
    ```
24. **Performance Expectations:** < 2ms (Direct hash table lookup).
25. **Data Source / Artifact Consumed:** In-memory index of `NarrativeCandidate`.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory repository cache.
29. **Determinism:** 100% deterministic.

---

### 10.5 `GET /api/v1/topics`

1. **Purpose:** Retrieve a paginated list of discovered semantic topic clusters formed by HDBSCAN, including representative keywords, cluster sizes, and contextual features.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/topics`
4. **Authentication:** None.
5. **Query Parameters:**
    * `page`: `int` (default `1`, ge `1`)
    * `page_size`: `int` (default `20`, ge `1`, le `100`)
    * `min_messages`: `int | None` (ge `1`)
    * `sort_by`: `str` (default `message_count`, allowed: `message_count`, `topic_id`, `percentage_of_dataset`)
    * `order`: `str` (default `desc`, allowed: `asc`, `desc`)
6. **Path Parameters:** None.
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `TopicListResponse`
10. **Required Response Fields:** `data` (list of `TopicSummaryResponse`), `meta` (`PaginationMeta`).
11. **Optional Response Fields:** None.
12. **Field Types:**
    * `topic_id`: `str`
    * `cluster_label`: `int`
    * `message_count`: `int`
    * `percentage_of_dataset`: `float`
    * `representative_keywords`: `list[TopicKeywordResponse]` (`keyword: str`, `score: float`)
13. **Field Meanings:** Overview of semantic clusters discovered by Milestone 4E.
14. **Validation Rules:** Standard query bounds.
15. **Default Values:** `page=1`, `page_size=20`, `sort_by="message_count"`, `order="desc"`.
16. **Pagination Behavior:** In-memory slicing.
17. **Sorting Behavior:** Stable sort with `topic_id ASC` tie-breaker.
18. **Filtering Behavior:** Filters on message volume.
19. **Error Responses:** 400 for invalid query parameters; 503 if artifact not loaded.
20. **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/topics?page=1&page_size=10 HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "data": [
        {
          "topic_id": "topic_000",
          "cluster_label": 0,
          "message_count": 6,
          "percentage_of_dataset": 37.5,
          "representative_keywords": [
            {"keyword": "fuel", "score": 1.0},
            {"keyword": "prices", "score": 0.95},
            {"keyword": "petrol", "score": 0.82}
          ]
        }
      ],
      "meta": {
        "total": 3,
        "page": 1,
        "page_size": 10,
        "total_pages": 1,
        "has_next": false,
        "has_prev": false
      }
    }
    ```
23. **Example Error Response:** Standard 400 validation error.
24. **Performance Expectations:** < 5ms.
25. **Data Source / Artifact Consumed:** `topics.topic_records` from analytics artifact.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory.
29. **Determinism:** 100% deterministic.

---

### 10.6 `GET /api/v1/topics/{topic_id}`

1. **Purpose:** Retrieve deep diagnostic details for a specific topic cluster, joining 4E representation with 4F contextual feature enrichment (`engagement`, `propagation`, `temporal`, `entities`).
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/topics/{topic_id}`
4. **Authentication:** None.
5. **Query Parameters:** None.
6. **Path Parameters:** `topic_id: str` (e.g. `topic_000`).
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `TopicDetailResponse`
10. **Required Response Fields:** `data` containing `topic_id`, `cluster_label`, `message_count`, `percentage_of_dataset`, `representative_keywords`, `representative_message_ids`, `entities`, `engagement`, `propagation`, `temporal`.
11. **Optional Response Fields:** None.
12. **Field Types:** Typed according to `TopicRecord` joined with `EnrichedTopicCandidate`.
13. **Field Meanings:** Full contextual intelligence for a topic cluster.
14. **Validation Rules:** `topic_id` must match pattern `^topic_\d{3,}$`.
15. **Default Values:** N/A.
16. **Pagination Behavior:** Non-paginated.
17. **Sorting Behavior:** N/A.
18. **Filtering Behavior:** N/A.
19. **Error Responses:** 404 if topic does not exist; 503 if artifact not loaded.
20. **HTTP Status Codes:** `200 OK`, `404 Not Found`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/topics/topic_000 HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "data": {
        "topic_id": "topic_000",
        "cluster_label": 0,
        "message_count": 6,
        "percentage_of_dataset": 37.5,
        "representative_keywords": [
          {"keyword": "fuel", "score": 1.0},
          {"keyword": "prices", "score": 0.95}
        ],
        "representative_message_ids": [
          "telegram:chan1:101",
          "telegram:chan2:205"
        ],
        "entities": [
          {
            "text": "oil",
            "category": "hashtag",
            "frequency": 4,
            "sample_message_ids": ["telegram:chan1:101"]
          }
        ],
        "engagement": {
          "total_views": 15400,
          "total_forwards": 320,
          "total_replies": 45,
          "total_reactions": 612,
          "forward_to_view_ratio": 0.0208,
          "reply_to_view_ratio": 0.0029,
          "reaction_to_view_ratio": 0.0397,
          "emoji_polarity_score": -0.12,
          "peak_views_message_id": "telegram:chan1:101"
        },
        "propagation": {
          "observed_forward_count": 2,
          "direct_forward_ratio": 0.3333,
          "unique_origin_channels": ["chan_root"],
          "unique_amplifying_channels": ["chan1", "chan2"],
          "cross_channel_observed_spread": 2,
          "uncredited_syndication_count": 1
        },
        "temporal": {
          "first_published_at": "2026-09-02T10:00:00Z",
          "last_published_at": "2026-09-02T15:30:00Z",
          "timespan_seconds": 19800.0,
          "messages_per_hour": 1.09,
          "peak_window_utc": "2026-09-02T12:00",
          "peak_window_message_count": 3,
          "burstiness_index": 0.15,
          "channel_entry_velocity": 0.36
        }
      }
    }
    ```
23. **Example Error Response:** Standard 404 error envelope.
24. **Performance Expectations:** < 2ms (In-memory lookup).
25. **Data Source / Artifact Consumed:** Joined `TopicRecord` and `EnrichedTopicCandidate`.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory.
29. **Determinism:** 100% deterministic.

---

### 10.7 `GET /api/v1/messages`

1. **Purpose:** Provide a paginated, filterable collection of normalized social media messages from the canonical dataset.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/messages`
4. **Authentication:** None.
5. **Query Parameters:**
    * `page`: `int` (default `1`, ge `1`)
    * `page_size`: `int` (default `20`, ge `1`, le `100`)
    * `platform`: `str | None` (`telegram`, `x`)
    * `channel_id`: `str | None`
    * `topic_id`: `str | None` (filter to messages assigned to a specific topic)
    * `has_media`: `bool | None`
    * `is_forward`: `bool | None`
    * `language`: `str | None`
    * `sort_by`: `str` (default `published_at`, allowed: `published_at`, `views_count`, `forwards_count`)
    * `order`: `str` (default `desc`, allowed: `asc`, `desc`)
6. **Path Parameters:** None.
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `MessageListResponse`
10. **Required Response Fields:** `data` (list of `MessageSummaryResponse`), `meta` (`PaginationMeta`).
11. **Optional Response Fields:** None.
12. **Field Types:** Mapped from `CanonicalMessage`.
13. **Field Meanings:** Feed of individual social media posts.
14. **Validation Rules:** Query parameters strictly bound.
15. **Default Values:** `page=1`, `page_size=20`, `sort_by="published_at"`, `order="desc"`.
16. **Pagination Behavior:** In-memory slicing over the loaded Parquet dataset.
17. **Sorting Behavior:** Stable sort with `canonical_id ASC` tie-breaker.
18. **Filtering Behavior:** Logical AND across all specified filter parameters.
19. **Error Responses:** 400 for invalid query parameter; 503 if dataset not loaded.
20. **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/messages?platform=telegram&page=1&page_size=5 HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "data": [
        {
          "canonical_id": "telegram:chan1:101",
          "platform": "telegram",
          "native_id": "101",
          "author_id": "chan1",
          "channel_title": "Energy Intelligence Desk",
          "published_at": "2026-09-02T12:00:00Z",
          "text_content": "Crude oil futures surge 3.2% amid global supply reallocations.",
          "language": "en",
          "views_count": 8200,
          "forwards_count": 145,
          "has_media": false,
          "is_forward": false
        }
      ],
      "meta": {
        "total": 16,
        "page": 1,
        "page_size": 5,
        "total_pages": 4,
        "has_next": true,
        "has_prev": false
      }
    }
    ```
23. **Example Error Response:** Standard 400 validation error.
24. **Performance Expectations:** < 15ms for datasets up to 100,000 records in memory.
25. **Data Source / Artifact Consumed:** In-memory `CanonicalMessage` list loaded from Parquet.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory repository cache.
29. **Determinism:** 100% deterministic.

---

### 10.8 `GET /api/v1/messages/{message_id}`

1. **Purpose:** Retrieve the full, comprehensive canonical representation of an individual social media message.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/messages/{message_id:path}`
4. **Authentication:** None.
5. **Query Parameters:** None.
6. **Path Parameters:** `message_id: str` (Full canonical identifier, e.g. `telegram:chan1:101` or `x:182938492`).
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `MessageDetailResponse`
10. **Required Response Fields:** `data` containing the full 27 fields of `CanonicalMessage`.
11. **Optional Response Fields:** Topic assignment metadata if assigned (`assigned_topic_id: str | None`).
12. **Field Types:** Exact mapping of `app.schemas.canonical_message.CanonicalMessage`.
13. **Field Meanings:** Complete forensic record of the message.
14. **Validation Rules:** Parameter is URL-decoded; must contain valid platform prefix.
15. **Default Values:** N/A.
16. **Pagination Behavior:** Non-paginated.
17. **Sorting Behavior:** N/A.
18. **Filtering Behavior:** N/A.
19. **Error Responses:** 404 if message does not exist; 503 if dataset not loaded.
20. **HTTP Status Codes:** `200 OK`, `404 Not Found`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/messages/telegram:chan1:101 HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "data": {
        "canonical_id": "telegram:chan1:101",
        "platform": "telegram",
        "native_id": "101",
        "author_id": "chan1",
        "author_username": "@energy_desk",
        "author_type": "channel",
        "channel_title": "Energy Intelligence Desk",
        "subscriber_count": 45000,
        "published_at": "2026-09-02T12:00:00Z",
        "collected_at": "2026-09-02T12:05:00Z",
        "text_content": "Crude oil futures surge 3.2% amid global supply reallocations.",
        "language": "en",
        "media_types": [],
        "has_media": false,
        "is_forward": false,
        "is_repost": false,
        "origin_source_id": null,
        "reply_to_id": null,
        "thread_id": null,
        "views_count": 8200,
        "forwards_count": 145,
        "replies_count": 12,
        "reactions": {"👍": 80, "🔥": 24},
        "urls": [],
        "hashtags": ["oil"],
        "mentions": [],
        "raw_reference": "raw/telegram/2026-09-02/batch.jsonl:line_10",
        "assigned_topic_id": "topic_000"
      }
    }
    ```
23. **Example Error Response:** Standard 404 error envelope.
24. **Performance Expectations:** < 2ms (Direct hash table lookup).
25. **Data Source / Artifact Consumed:** In-memory `dict[canonical_id, CanonicalMessage]`.
26. **Read-Only:** Yes.
27. **ML Inference Allowed:** **NO.**
28. **Cached:** In-memory.
29. **Determinism:** 100% deterministic.

---

### 10.9 `GET /api/v1/pipeline/status`

1. **Purpose:** Expose high-level pipeline provenance and lifecycle metadata (source dataset, creation timestamp, schema versions, cache health).
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/pipeline/status`
4. **Authentication:** None.
5. **Query Parameters:** None.
6. **Path Parameters:** None.
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `PipelineStatusResponse`
10. **Required Response Fields:** `dataset_source`, `created_at_utc`, `pipeline_version`, `status`.
11. **Optional Response Fields:** `cache_status`.
12. **Field Types:** Strings, booleans, and floats.
13. **Field Meanings:** System pipeline health and provenance report.
14. **Validation Rules:** N/A.
15. **Default Values:** N/A.
16. **Pagination Behavior:** Non-paginated.
17. **Sorting Behavior:** N/A.
18. **Filtering Behavior:** N/A.
19. **Error Responses:** 503 if pipeline metadata is missing.
20. **HTTP Status Codes:** `200 OK`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/pipeline/status HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "status": "idle",
      "dataset_source": "telegram_messages.parquet",
      "created_at_utc": "2026-09-05T08:00:00Z",
      "pipeline_version": "4h.v1",
      "cache_status": {
        "enabled": true,
        "hit_rate": 1.0
      }
    }
    ```
23. **Performance Expectations:** < 2ms.
24. **Data Source / Artifact Consumed:** `MLPipelineResult` metadata.
25. **Read-Only:** Yes.
26. **ML Inference Allowed:** **NO.**
27. **Cached:** In-memory.
28. **Determinism:** Deterministic.

---

### 10.10 `GET /api/v1/pipeline/metrics`

1. **Purpose:** Expose granular, audit-ready latency, throughput, memory, and cache accounting metrics recorded during the execution of the upstream ML pipeline.
2. **HTTP Method:** `GET`
3. **Full Route:** `/api/v1/pipeline/metrics`
4. **Authentication:** None.
5. **Query Parameters:** None.
6. **Path Parameters:** None.
7. **Request Body:** None.
8. **Request Schema:** None.
9. **Response Schema:** `PipelineMetricsResponse`
10. **Required Response Fields:** Complete mapping of `app.ml.pipeline.metrics.PipelineStageMetrics`.
11. **Optional Response Fields:** None.
12. **Field Types:** Float latencies (seconds), throughputs, integer record counts, Peak RSS (MB), Peak Python Heap (MB).
13. **Field Meanings:** Exact copy of the 4H production metrics contract.
14. **Validation Rules:** Latencies $\ge 0.0$.
15. **Default Values:** N/A.
16. **Pagination Behavior:** Non-paginated.
17. **Sorting Behavior:** N/A.
18. **Filtering Behavior:** N/A.
19. **Error Responses:** 503 if metrics are unavailable.
20. **HTTP Status Codes:** `200 OK`, `503 Service Unavailable`.
21. **Example Request:** `GET /api/v1/pipeline/metrics HTTP/1.1`
22. **Example Successful Response:**
    ```json
    {
      "stage_latencies_seconds": {
        "language_detection": 0.0421,
        "normalization": 0.0180,
        "sentiment_load": 1.1320,
        "sentiment_inference": 0.0031,
        "embedding_load": 3.3510,
        "embedding_inference": 0.0012,
        "topic_discovery": 0.0542,
        "feature_enrichment": 0.0812,
        "narrative_assessment": 0.0210,
        "total_runtime": 4.7038
      },
      "execution_breakdown": {
        "cold_start_time_seconds": 4.4830,
        "warm_inference_time_seconds": 0.2208
      },
      "throughput_samples_per_sec": {
        "sentiment": 17.6,
        "embedding": 143.2
      },
      "record_accounting": {
        "records_ingested": 16,
        "records_processed": 16,
        "records_skipped": 0,
        "records_failed": 0
      },
      "cache_performance": {
        "cache_hits": 43,
        "cache_misses": 0,
        "cache_hit_rate": 1.0
      },
      "memory_footprint_mb": {
        "peak_process_rss_mb": 1104.2,
        "peak_python_heap_mb": 0.32
      }
    }
    ```
23. **Performance Expectations:** < 2ms.
24. **Data Source / Artifact Consumed:** `MLPipelineResult.metrics`.
25. **Read-Only:** Yes.
26. **ML Inference Allowed:** **NO.**
27. **Cached:** In-memory.
28. **Determinism:** Deterministic.

---

## 11. Priority Score Contract & 4G Semantic Guardrails

### Exact Frozen Formulas (Milestone 4G)
The API layer **MUST NOT recalculate** these scores. The formulas are documented here strictly so the API engineer understands what the precomputed values represent:

#### 1. Spread Sub-Score ($S_{\text{spread}} \in [0.0, 1.0]$)
$$S_{\text{spread}} = 0.50 \cdot \min\left(\frac{\text{cross\_channel\_spread}}{3.0}, 1.0\right) + 0.30 \cdot \text{direct\_forward\_ratio} + 0.20 \cdot \min\left(\frac{|\text{amplifying\_channels}|}{3.0}, 1.0\right)$$

#### 2. Potential Coordination Sub-Score ($S_{\text{coord}} \in [0.0, 1.0]$)
$$\text{synd\_ratio} = \min\left(\frac{\text{uncredited\_syndication\_count}}{\max(\text{non\_forward\_count}, 1)}, 1.0\right)$$
$$B_{\text{norm}} = \begin{cases} \max\left(\frac{\text{burstiness\_index} + 1.0}{2.0}, 0.0\right) & \text{if burstiness\_index exists} \\ 0.50 & \text{otherwise} \end{cases}$$
$$V_{\text{norm}} = \begin{cases} \min\left(\frac{\text{channel\_entry\_velocity}}{10.0}, 1.0\right) & \text{if channel\_entry\_velocity exists} \\ 0.0 & \text{otherwise} \end{cases}$$
$$S_{\text{coord}} = 0.50 \cdot \min(\text{synd\_ratio} \times 2.0, 1.0) + 0.30 \cdot B_{\text{norm}} + 0.20 \cdot V_{\text{norm}}$$

#### 3. Observed Reach Sub-Score ($S_{\text{reach}} \in [0.0, 1.0]$)
$$S_{\text{reach}} = 0.60 \cdot \min\left(\frac{\log_{10}(\max(\text{total\_views}, 1))}{6.0}, 1.0\right) + 0.40 \cdot \min\left(\frac{\text{forward\_to\_view\_ratio}}{0.08}, 1.0\right)$$

#### 4. Friction Sub-Score ($S_{\text{friction}} \in [0.0, 1.0]$)
$$\text{emoji\_neg} = \max(-\text{emoji\_polarity\_score}, 0.0) \in [0.0, 1.0]$$
$$\text{term\_reply} = \min\left(\frac{\text{reply\_to\_view\_ratio}}{0.04}, 1.0\right)$$
- If text sentiment is available:
  $$S_{\text{friction}} = 0.45 \cdot \text{text\_negative\_ratio} + 0.35 \cdot \text{emoji\_neg} + 0.20 \cdot \text{term\_reply}$$
- If text sentiment is unavailable:
  $$S_{\text{friction}} = \frac{0.35 \cdot \text{emoji\_neg} + 0.20 \cdot \text{term\_reply}}{0.55}$$

#### 5. Composite Priority / Narrative Signal Score
$$\text{PrioritySignalScore} = 0.30 \cdot S_{\text{spread}} + 0.30 \cdot S_{\text{coord}} + 0.20 \cdot S_{\text{reach}} + 0.20 \cdot S_{\text{friction}}$$

#### 6. Triage Priority Tiers
* $\ge 0.75 \implies \text{CRITICAL}$
* $0.55 - 0.74 \implies \text{HIGH}$
* $0.35 - 0.54 \implies \text{ELEVATED}$
* $< 0.35 \implies \text{ROUTINE}$

### Mandatory Terminology & Policy Guardrails
* **DO NOT** use the terms *threat score, risk score, propaganda score, manipulation score, or CIB score*.
* **DO USE** *Priority Signal Score*, *Narrative Signal Score*, *Triage Priority*.
* **Coordination Signals** are *potential synchronization anomalies* flagging items for analyst attention. They are **never** proof of coordinated inauthentic behavior or malicious bot networks.
* **Reach** represents *observed exposure* across available messages, not total population penetration.
* **Forwarding** represents *platform-observed reposting*, not direct causal influence.

---

## 12. Topic Representation & HDBSCAN Noise Semantics

### Neutral Topic Representation
* Topics do not have natural-language titles generated by LLMs. Topic identifiers are strictly neutral: `topic_000`, `topic_001`, etc.
* The descriptive representation consists of top **c-TF-IDF keywords** (`representative_keywords`) with numerical relevance weights.

### HDBSCAN Noise Handling (`cluster_label = -1`)
* In HDBSCAN clustering, unclustered outlier messages are assigned cluster label `-1`.
* In TRAJECT:
  - Noise messages are **NOT** assigned a `topic_id` and are **NOT** promoted into `NarrativeCandidate` objects.
  - The list of noise message IDs is accessible via `topics.noise_message_ids` and counted in `topics.noise_messages` and `unassigned_noise_count`.
  - If a dataset consists entirely of noise messages (e.g. sparse or disparate messages), `total_topics = 0` and `total_narratives = 0`. The API returns valid empty collections (`"data": []`) with accurate counts, rather than failing.

---

## 13. Canonical Message ID Semantics & Platform Abstraction

### Chat-Scoped Telegram Identifiers
In Telegram, message sequence integers are scoped to individual chats/channels. Therefore, the unique canonical identifier is:
```
telegram:{chat_id}:{native_id}
```
Example: `telegram:-100123456789:42` or `telegram:GenshinUpdate_STR:101`.

For X (Twitter), IDs are globally unique snowflake integers:
```
x:{native_id}
```

### URL Route Encoding Specification
Because canonical IDs contain colons (`:`) and negative signs (`-`), FastAPI route parameters can encounter parsing issues if treated as standard route tokens.
* **Specification:** The single-message route **MUST** use FastAPI's path parameter type:
  ```python
  @router.get("/messages/{message_id:path}", response_model=MessageDetailResponse)
  async def get_message(message_id: str):
      ...
  ```
* The implementation must perform `urllib.parse.unquote(message_id)` to handle clients that percent-encode `:` as `%3A`.

### Platform Neutrality
The API is completely platform-neutral. There are **no platform-specific sub-routes** (e.g. `/api/v1/telegram/messages`). All posts exist in the `/api/v1/messages` endpoint, differentiated by the `platform` attribute. Future platforms (e.g. X, Reddit, Discord) map directly into this contract without breaking frontend consumers.

---

## 14. Pagination, Filtering, and Sorting Contracts

### Pagination Contract
* Parameter names: `page` (1-indexed integer, default `1`) and `page_size` (integer, default `20`, maximum `100`).
* Response metadata:
  ```json
  "meta": {
    "total": 128,
    "page": 1,
    "page_size": 20,
    "total_pages": 7,
    "has_next": true,
    "has_prev": false
  }
  ```
* Out-of-bounds page request (e.g. requesting page 10 when only 3 pages exist) returns `"data": []` with correct pagination metadata.

### Deterministic Sorting Contract
* Sorting parameters: `sort_by: str` and `order: str` (`asc` | `desc`).
* If `sort_by` is not specified, default ordering applies:
  - Narratives: `priority_signal_score DESC`, broken by `narrative_id ASC`.
  - Topics: `message_count DESC`, broken by `topic_id ASC`.
  - Messages: `published_at DESC`, broken by `canonical_id ASC`.
* If a client supplies an invalid `sort_by` field, the API rejects the request with HTTP `400 Bad Request` (`INVALID_QUERY_PARAMETER`).

---

## 15. Data Consistency, Edge Cases, & Empty Data Behavior

The API must gracefully handle all real-world data boundary conditions:

| Scenario | System Behavior | HTTP Response |
| :--- | :--- | :--- |
| **Empty Input Dataset (0 messages)** | Returns empty arrays with `"total": 0`. Does not crash. | `200 OK` (`"data": []`) |
| **100% HDBSCAN Noise (0 topics formed)**| Returns 0 topics and 0 narratives. | `200 OK` (`"data": []`) |
| **Precomputed Analytics Artifact Missing**| Repository detects missing file; API returns clear diagnostic. | `503 Service Unavailable` (`ARTIFACT_NOT_FOUND`) |
| **Parquet Dataset Missing** | Message endpoints return service unavailable. | `503 Service Unavailable` (`DATASET_NOT_FOUND`) |
| **Artifact JSON Corrupted / Invalid** | Lifespan logs error; endpoints return structured error. | `500 Internal Server Error` (`ARTIFACT_CORRUPTED`) |
| **Sentiment Unavailable in Upstream Run**| Exposes `is_available: false` in `sentiment_profile`. Sub-score friction is renormalized. | `200 OK` |
| **Single Message / Zero Timespan Topic** | Feature enrichment sets `burstiness_index: null`, `velocity: null`. API returns `null`. | `200 OK` |

---

## 16. Security, CORS, Configuration, & Observability

### Security Guardrails
1. **No Path Traversal:** File paths are never accepted as HTTP query parameters or path variables. Artifact filenames are controlled strictly by server environment configuration.
2. **Input Bounding:** Strict `Pydantic` validation bounds all integer and string inputs (`page_size <= 100`, string length limits).
3. **No Secret Leakage:** Telethon API IDs, hashes, bot tokens, and internal file paths are **never** included in HTTP responses or public logs.
4. **No Raw Tracebacks:** Internal exceptions are caught by global exception handlers and logged server-side, returning an opaque `INTERNAL_SERVER_ERROR` with a UTC timestamp.

### CORS Configuration
Configured in `backend/app/main.py` using FastAPI's `CORSMiddleware`:
* **Development Origins:** Default to `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173`.
* **Configurable via Environment:** Loaded from `API_CORS_ORIGINS` (comma-separated list).
* **Allowed Methods:** `GET`, `OPTIONS`.
* **Allowed Headers:** `*`.
* **Credentials:** Supported (`allow_credentials=True`).

### Application Configuration Contract (`app.core.config`)
Milestone 5A will introduce a typed configuration model in `backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings
from pydantic import Field

class APISettings(BaseSettings):
    app_env: str = Field(default="development")
    log_level: str = Field(default="INFO")
    api_host: str = Field(default="127.0.0.1")
    api_port: int = Field(default=8000)
    api_prefix: str = Field(default="/api/v1")
    api_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"])
    data_processed_dir: str = Field(default="./data/processed")
    active_dataset_name: str = Field(default="telegram_messages")
```

---

## 17. Frontend Consumption Contract & Integration Guide

The TRAJECT frontend dashboard consumes this API across 4 primary views:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. EXECUTIVE DASHBOARD                            │
│  Endpoint: GET /api/v1/analytics                                            │
│  Renders: Summary tiles (total messages, topics, active narratives),        │
│           Priority Tier Breakdown bar chart, Sentiment distribution pie,    │
│           Pipeline execution latency card.                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           2. NARRATIVE TRIAGE QUEUE                         │
│  Endpoint: GET /api/v1/narratives?priority_tier=critical,high               │
│  Renders: Ranked triage table with Priority Signal Scores, Headline Claims, │
│           Spread/Coordination badges, and Evidence Density indicators.      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Clicks row
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           3. NARRATIVE DETAIL VIEW                          │
│  Endpoint: GET /api/v1/narratives/{narrative_id}                            │
│  Renders: Four component radar chart (Spread, Coord, Reach, Friction),      │
│           Audit rationale bullets, Coordination anomaly flags,              │
│           Key entities, and representative message excerpts.                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Drill-down to source data
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           4. MESSAGE FORENSIC FEED                          │
│  Endpoint: GET /api/v1/messages?topic_id={topic_id}                         │
│  Renders: Chronological feed of canonical social media posts with native    │
│           views, forward origins, reactions, and author metadata.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Internal Architecture & Proposed File Structure

Milestone 5A implementation must reside strictly inside `backend/` and follow this modular structure:

```text
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py               # Router exports
│   │   ├── deps.py                   # Dependency injection (get_repository, get_settings)
│   │   └── v1/
│   │       ├── __init__.py           # Unified v1 APIRouter
│   │       ├── health.py             # GET /health
│   │       ├── analytics.py          # GET /analytics
│   │       ├── narratives.py         # GET /narratives, GET /narratives/{id}
│   │       ├── topics.py             # GET /topics, GET /topics/{id}
│   │       ├── messages.py           # GET /messages, GET /messages/{id}
│   │       └── pipeline.py           # GET /pipeline/status, GET /pipeline/metrics
│   │
│   ├── core/
│   │   ├── config.py                 # Existing root finder + new APISettings class
│   │   └── logging.py                # Structured console logging configuration
│   │
│   ├── repositories/
│   │   ├── __init__.py
│   │   └── artifact_repository.py    # In-memory artifact loader, caching, and lookups
│   │
│   ├── schemas/
│   │   ├── canonical_message.py      # Existing CanonicalMessage contract (UNTOUCHED)
│   │   └── api/                      # New typed Pydantic API response models
│   │       ├── __init__.py
│   │       ├── common.py             # PaginationMeta, ErrorEnvelope
│   │       ├── health.py             # HealthResponse
│   │       ├── analytics.py          # AnalyticsOverviewResponse
│   │       ├── narratives.py         # NarrativeSummaryResponse, NarrativeDetailResponse
│   │       ├── topics.py             # TopicSummaryResponse, TopicDetailResponse
│   │       ├── messages.py           # MessageSummaryResponse, MessageDetailResponse
│   │       └── pipeline.py           # PipelineStatusResponse, PipelineMetricsResponse
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── analytics_service.py      # Aggregations, filtering, slicing
│   │   └── message_service.py        # Message querying, sorting, pagination
│   │
│   └── main.py                       # FastAPI app creation, lifespan, CORS, exception handlers
│
└── tests/
    ├── test_api_health.py            # Verification of health endpoint
    ├── test_api_analytics.py         # Verification of analytics summary
    ├── test_api_narratives.py        # Verification of narratives list & detail
    ├── test_api_topics.py            # Verification of topics list & detail
    ├── test_api_messages.py          # Verification of message list & detail (with Telegram ID)
    ├── test_api_pipeline.py          # Verification of pipeline status & metrics
    └── test_api_errors.py            # Verification of 400, 404, 503 error envelopes
```

---

## 19. Testing Contract & Real-Data Smoke Test Protocol

The teammate implementing Milestone 5A must build a comprehensive automated test suite using `pytest` and `httpx.AsyncClient` / `TestClient`.

### Mandatory Unit & Integration Tests
1. **Health Tests (`test_api_health.py`):**
   - Returns 200 OK with `status: "healthy"` when artifacts are present.
   - Returns 200 OK with `status: "degraded"` when artifacts are missing.
2. **Analytics Tests (`test_api_analytics.py`):**
   - Correctly exposes dataset statistics matching the upstream artifact.
   - Gracefully handles empty dataset artifacts.
3. **Narratives Tests (`test_api_narratives.py`):**
   - List returns items sorted by `priority_signal_score DESC`.
   - Filtering by `priority_tier` works accurately.
   - Pagination bounds (`page`, `page_size`) work correctly.
   - Detail returns complete audit attribution and coordination signals.
   - Non-existent narrative ID returns HTTP 404 with structured error envelope.
4. **Topics Tests (`test_api_topics.py`):**
   - Discovered topics expose c-TF-IDF keywords.
   - Detail joins 4E representation with 4F features (engagement, propagation, temporal).
   - Noise handling is transparent.
5. **Messages Tests (`test_api_messages.py`):**
   - List returns canonical messages from Parquet.
   - Detail resolves Telegram chat-scoped ID (`telegram:chan1:101`).
   - Percent-encoded ID (`telegram%3Achan1%3A101`) resolves identically.
   - Non-existent message ID returns HTTP 404.
6. **Error & Edge Case Tests (`test_api_errors.py`):**
   - Invalid query parameters return HTTP 400 with parameter name in error details.
   - Missing artifact file returns HTTP 503 (`ARTIFACT_NOT_FOUND`).
   - Server internal errors return HTTP 500 without leaking stack traces.

### Real-Data Smoke Test Protocol
The implementation must be validated against the real Telegram dataset:
```powershell
# 1. Start the API locally:
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Probe health:
curl http://127.0.0.1:8000/api/v1/health

# 3. Fetch analytics overview:
curl http://127.0.0.1:8000/api/v1/analytics

# 4. Fetch top narratives:
curl http://127.0.0.1:8000/api/v1/narratives

# 5. Fetch message by Telegram canonical ID:
curl http://127.0.0.1:8000/api/v1/messages/telegram:GenshinUpdate_STR:101
```

---

## 20. Prohibited Changes & Strict Invariants

The engineer implementing Milestone 5A is **strictly prohibited** from performing any of the following actions:
1. **NO Rewriting of ML Pipelines:** Do not alter any code inside `backend/app/ml/` (language identification, sentiment, topic discovery, feature enrichment, narrative scoring, caching, or orchestrator).
2. **NO ML Inference in Normal GET Requests:** Do not load PyTorch models, sentence transformers, or RoBERTa adapters during API request cycles.
3. **NO Modification of Raw Data or Schemas:** Do not alter `CanonicalMessage`, `AuthorType`, `Platform`, or raw JSONL records.
4. **NO Invented Terminology:** Do not call priority scores "threat" or "risk" scores.
5. **NO Generative LLMs:** Do not introduce LLM calls to generate natural language topic titles or claims.
6. **NO External Heavy Infrastructure:** Do not introduce Redis, Celery, Kafka, Docker containers, Kubernetes, or microservices.
7. **NO Moving Files Outside `backend/`:** All backend Python code must reside within `backend/app/`.

---

## 21. Step-by-Step Implementation Sequence

The implementation must proceed in the following linear sequence to ensure high testability at every stage:

1. **Step 1: Dependency Setup (`pyproject.toml`):** Add `fastapi`, `uvicorn`, `pydantic-settings`, and `httpx` to `pyproject.toml`. Run `pip install -e ".[dev,test]"`.
2. **Step 2: Configuration (`app.core.config`):** Define `APISettings` integrated with `find_repo_root()` and `.env.example`.
3. **Step 3: Response Schemas (`app.schemas.api`):** Create Pydantic v2 response models for all endpoints.
4. **Step 4: Artifact Repository (`app.repositories`):** Implement `ArtifactRepository` capable of reading Parquet and precomputed JSON into memory.
5. **Step 5: Application Entrypoint (`app.main`):** Create FastAPI application with lifespan context manager for artifact loading, CORS middleware, and unified error handlers.
6. **Step 6: Health Router (`app.api.v1.health`):** Implement and test `GET /api/v1/health`.
7. **Step 7: Analytics Router (`app.api.v1.analytics`):** Implement and test `GET /api/v1/analytics`.
8. **Step 8: Narratives Router (`app.api.v1.narratives`):** Implement and test `GET /api/v1/narratives` and `GET /api/v1/narratives/{id}`.
9. **Step 9: Topics Router (`app.api.v1.topics`):** Implement and test `GET /api/v1/topics` and `GET /api/v1/topics/{id}`.
10. **Step 10: Messages Router (`app.api.v1.messages`):** Implement and test `GET /api/v1/messages` and `GET /api/v1/messages/{id:path}`.
11. **Step 11: Pipeline Router (`app.api.v1.pipeline`):** Implement and test `GET /api/v1/pipeline/status` and `GET /api/v1/pipeline/metrics`.
12. **Step 12: Automated Test Suite:** Implement `tests/test_api_*.py` ensuring 100% route coverage.
13. **Step 13: Full Regression Test:** Execute `pytest tests -v` verifying all 180 existing tests continue to pass alongside the new API test suite.

---

## 22. Milestone 5A Acceptance Criteria & Definition of Done

### Acceptance Checklist
* [ ] **Framework & Dependencies:** FastAPI and Uvicorn installed; dependencies updated in `pyproject.toml`.
* [ ] **API Versioning:** All endpoints registered under `/api/v1`.
* [ ] **Endpoint Completeness:** All 10 specified endpoints implemented and responding with typed schemas.
* [ ] **No ML Inference:** Zero model forward passes occur during GET requests.
* [ ] **Canonical Message Lookup:** Telegram chat-scoped IDs (`telegram:chat:id`) resolve accurately.
* [ ] **Data Integrity:** 4A–4H scoring formulas, feature definitions, and canonical schemas remain completely untouched.
* [ ] **Error Handling:** Standardized error JSON returned for 400, 404, and 503; no stack traces leaked.
* [ ] **CORS Enabled:** Local frontend origins (`localhost:3000`, `localhost:5173`) permitted.
* [ ] **OpenAPI Available:** Interactive Swagger UI available at `/docs` and ReDoc at `/redoc`.
* [ ] **Test Coverage:** Full test suite implemented; existing 180 tests + new API tests all pass cleanly.

---

## 23. Architectural Decision Records (ADRs)

### ADR-01: Adoption of FastAPI for Serving Layer
* **Decision:** Use FastAPI as the core API framework.
* **Reason:** Native Pydantic v2 support (which matches TRAJECT schemas), asynchronous performance, automatic OpenAPI documentation, and minimal boilerplate.
* **Alternatives Considered:** Flask, Django, Litestar.
* **Why Rejected:** Flask lacks native async and Pydantic validation without external plugins; Django is excessively monolithic and requires unwanted database machinery.

### ADR-02: Serving Precomputed Artifacts vs. On-Demand Pipeline Execution
* **Decision:** Normal API GET endpoints read strictly precomputed analytics artifacts generated by Milestone 4H.
* **Reason:** Transformer embeddings and HDBSCAN clustering require seconds of compute on CPU. Recomputing on every HTTP request would introduce prohibitive latency and exhaust system memory.
* **Alternatives Considered:** On-demand inference in GET requests.
* **Why Rejected:** Violates sub-second web latency requirements and creates process memory instability.

### ADR-03: In-Memory Indexing vs. Relational Database (Postgres/SQLite)
* **Decision:** Load active Parquet and JSON artifacts into process memory indices during application startup.
* **Reason:** TRAJECT operates on bounded analytical batches (100 to 100,000 records). In-memory dictionary lookups deliver sub-millisecond query performance without introducing external database services.
* **Alternatives Considered:** Loading Parquet into SQLite or PostgreSQL.
* **Why Rejected:** Premature complexity. Database synchronization and migration management are unnecessary for single-node Milestone 5A.

---

## 24. Upstream-to-API Traceability Matrix

| Upstream Milestone | Upstream Class / Artifact | Upstream Field(s) | API Endpoint | API Response Model Field |
| :--- | :--- | :--- | :--- | :--- |
| **3B (Storage)** | `CanonicalMessage` (`.parquet`) | `canonical_id`, `platform`, `text_content`, `published_at`, `views_count`, etc. | `GET /api/v1/messages/{id}` | `MessageDetailResponse.data.*` |
| **4A (ML Dataset)** | `MLPipelineResult` | `metrics.records_ingested`, `records_processed` | `GET /api/v1/analytics` | `summary_counts.total_messages` |
| **4E (Topics)** | `TopicRecord` | `topic_id`, `cluster_label`, `representative_keywords` | `GET /api/v1/topics` | `TopicSummaryResponse` |
| **4E (Topics)** | `TopicDiscoveryResult` | `noise_messages`, `noise_message_ids` | `GET /api/v1/analytics` | `summary_counts.noise_messages` |
| **4F (Features)** | `TopicEngagementFeatures` | `total_views`, `forward_to_view_ratio`, `emoji_polarity_score` | `GET /api/v1/topics/{id}` | `TopicDetailResponse.data.engagement` |
| **4F (Features)** | `TopicPropagationFeatures`| `observed_forward_count`, `unique_amplifying_channels`, `cross_channel_observed_spread` | `GET /api/v1/topics/{id}` | `TopicDetailResponse.data.propagation` |
| **4F (Features)** | `TopicTemporalFeatures` | `first_published_at`, `burstiness_index`, `channel_entry_velocity` | `GET /api/v1/topics/{id}` | `TopicDetailResponse.data.temporal` |
| **4G (Narratives)**| `NarrativeCandidate` | `narrative_id`, `headline_claim`, `priority_signal_score`, `priority_tier` | `GET /api/v1/narratives` | `NarrativeSummaryResponse` |
| **4G (Narratives)**| `NarrativeSubScores` | `spread_score`, `coordination_score`, `reach_score`, `friction_score` | `GET /api/v1/narratives/{id}` | `NarrativeDetailResponse.data.sub_scores` |
| **4G (Narratives)**| `PotentialCoordinationSignals` | `potential_syndication_spike`, `potential_temporal_burst`, etc. | `GET /api/v1/narratives/{id}` | `NarrativeDetailResponse.data.coordination_signals` |
| **4G (Narratives)**| `NarrativeDataCoverage` | `evidence_density`, `has_views_coverage`, `data_quality_notes` | `GET /api/v1/narratives/{id}` | `NarrativeDetailResponse.data.data_coverage` |
| **4H (Metrics)** | `PipelineStageMetrics` | `stage_latencies`, `throughput`, `peak_rss_mb`, `cache_hit_rate` | `GET /api/v1/pipeline/metrics`| `PipelineMetricsResponse.*` |

---

## 25. "Do Not Guess" Unresolved Decisions Log

No unresolved API contract decisions identified from repository inspection. All schemas, formulas, file paths, and upstream structures have been concretely verified against the active codebase.

---

## 26. Final Engineering Handoff

### Responsibility Boundaries
* **The Backend API Teammate:**
  - Owns: `backend/app/api/`, `backend/app/repositories/`, `backend/app/schemas/api/`, `backend/app/services/`, `backend/app/main.py`, and `backend/tests/test_api_*.py`.
  - Must install FastAPI, Uvicorn, and httpx.
  - Must write tests covering all 10 endpoints and error conditions.
* **The ML Teammate:**
  - Owns: `backend/app/ml/`, `backend/app/schemas/canonical_message.py`, `backend/app/storage/`, and `backend/app/quality/`.
  - Responsible for generating the precomputed `.parquet` and `-analytics-artifact.json` files using the CLI.
* **The Frontend Teammate:**
  - Consumes: The `/api/v1` contract documented in this specification.
  - Can mock endpoints immediately using the JSON examples provided in Section 10.

### First Implementation Step
The API engineer should begin by adding FastAPI and Uvicorn to `backend/pyproject.toml`, creating `backend/app/schemas/api/health.py` and `backend/app/api/v1/health.py`, and ensuring `GET /api/v1/health` responds with `200 OK`.

### Final Validation Commands
```powershell
# Run the complete test suite (existing 180 tests + new API tests):
cd backend
pytest tests -v

# Start the local development server:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Expected output: All unit and integration tests passing; OpenAPI documentation available at `http://127.0.0.1:8000/docs`.
