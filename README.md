# TRAJECT

> **Production Social Media Analytics & Narrative Intelligence Platform**  
> Developed for **Smart India Hackathon (SIH) 2026** — **Problem Statement 26152 (NTRO)**

---

## 1. Project Overview

**TRAJECT** is a social media analytics and narrative intelligence platform designed to ingest, normalize, and analyze public information cascades across multi-platform communications networks.

The platform addresses **SIH 2026 Problem Statement 26152 (National Technical Research Organisation - NTRO)**, focusing on multi-source social stream processing, narrative tracking, and explainable network intelligence.

### Scope & Capabilities

### Scope & Capabilities

| Horizon | Capabilities |
| :--- | :--- |
| **Current Implementation** | • Python backend foundation (`backend/app/`)<br>• Core `CanonicalMessage` schema (Pydantic v2) with strict UTC timestamp enforcement and controlled platform/author types<br>• Chat-scoped deterministic Telegram canonical ID generation (`telegram:{chat_id}:{message_id}`)<br>• Telegram message normalizer (`TelegramNormalizer`) handling plain text, captions, forwards, replies, reactions, and entity extraction<br>• MTProto collector (`Telethon`) supporting interactive terminal authentication and cloud 2FA<br>• Appendable, immutable raw JSONL storage (`data/raw/telegram/`)<br>• Streaming offline JSONL replay & pre-validation engine (`backend/app/replay/`) with line-level provenance preservation<br>• Columnar processed storage (`backend/app/storage/`) using Snappy-compressed Apache Parquet with 27-field typed schema, native Arrow lists, reaction maps, and UTC microsecond timestamps<br>• Data quality & deduplication engine (`backend/app/quality/`) enforcing temporal consistency, identity well-formedness, engagement integrity, first-occurrence-wins deduplication on `canonical_id`, and generating paired JSON quality audit reports<br>• **ML Dataset & Inspection Layer (4A)**: Canonical Parquet ML loader, `MLTextRecord` preparation, and deterministic statistical profiling<br>• **Language Identification & Normalization (4B)**: Deterministic multilingual language detection (`langdetect`) and social-safe text normalization<br>• **Sentiment Intelligence Baseline (4C/4D)**: Pretrained frozen sentiment adapters (English RoBERTa & Multilingual XLM-RoBERTa), evaluation metrics, and model recommendation routing<br>• **Topic Discovery Baseline (4E)**: Multilingual sentence embeddings (`paraphrase-multilingual-MiniLM-L12-v2`), unsupervised HDBSCAN clustering, deterministic c-TF-IDF keyword extraction, and representative message centroids<br>• **Topic Feature Enrichment (4F)**: Deterministic feature vectors across social/gazetteer entities, engagement metrics, observed forwarding propagation, uncredited syndication detection, and temporal cadence/burstiness<br>• **Narrative Candidate Formation & Scoring (4G)**: Bounded, explainable Priority Signal Score ($S \in [0, 1]$) with Spread, Potential Coordination, Observed Reach, and Friction sub-scores, audit rationale, and evidence-density tiers<br>• **Production Pipeline & Caching (4H)**: Unified `run_ml_pipeline` orchestration, process-level singleton `ModelLifecycleManager`, thread-safe deterministic SQLite `InferenceCache`, batch-size benchmark harness, and precomputed analytics export (`MLPipelineResult`)<br>• **Backend Analytics API (5A)**: High-performance, typed FastAPI serving layer (`/api/v1`) exposing precomputed analytics, topic clusters, prioritized narratives, canonical message streams, and pipeline telemetry with sub-2ms warm latencies and zero ML on the serving path<br>• **200 passing tests** using mocked clients and offline datasets (zero network calls during test runs)<br>• Successful real-world smoke test against public Telegram channel (`@GenshinUpdate_STR`) and verified end-to-end replay, quality check, Parquet conversion, ML pipeline analytics, and live API serving |
| **Planned / Future Scope** | • Continuous timeline and streaming ingestion<br>• **X (Twitter)** ingestion collector (Essential)<br>• **Instagram** and **Facebook** collectors (Desirable)<br>• **Reddit** and **YouTube** collectors (Appreciable additional sources)<br>• Dynamic sliding-window narrative mutation tracking<br>• Multi-node distributed inference caching (Redis/PostgreSQL)<br>• Information cascade topology, link analysis, and influence propagation graphs<br>• Aggregate and anonymized demographic profiling<br>• Next.js / Vite analyst web dashboard (Milestone 5B) |

> [!NOTE]
> Capabilities marked as **Planned / Future Scope** are not yet implemented. The project is constructed strictly incrementally from verified data contracts upward.

---

## 2. High-Level Architecture

TRAJECT decouples platform-specific ingestion protocols from downstream analytical engines using a **single canonical message representation**. Downstream machine learning, graph algorithms, and dashboard APIs operate strictly on this shared data model, avoiding redundant, platform-specific analytical pipelines.

```
┌────────────────────────────────────────────────────────┐
│                      DATA SOURCES                      │
│   Telegram (Active) │ X (Planned) │ Future Platforms   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│              PLATFORM-SPECIFIC COLLECTORS              │
│    TelegramCollector (Telethon MTProto, Bounded)       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   RAW IMMUTABLE DATA                   │
│   data/raw/telegram/{channel}_{timestamp}.jsonl        │
│   (Preserves complete payloads for offline replay)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                 OFFLINE STREAMING REPLAY               │
│   iter_raw_telegram_jsonl (Line-level provenance,      │
│   pre-validation, raw immutability preserved)          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                  PLATFORM NORMALIZERS                  │
│   TelegramNormalizer (Extracts entities, topology,     │
│   engagement, media, and chat-scoped canonical ID)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               CANONICAL MESSAGE CONTRACT               │
│   CanonicalMessage (Pydantic v2 Unified Schema)        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               DATA QUALITY & DEDUPLICATION             │
│   process_quality (Temporal checks, canonical_id       │
│   deduplication [first-wins], JSON audit report)       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               DURABLE PROCESSED DATASETS               │
│   data/processed/telegram/*.parquet (PyArrow, Snappy)  │
│   data/processed/telegram/*.quality.json               │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│      SHARED ML & NARRATIVE INTELLIGENCE (ACTIVE 4A-4H) │
│   • Model Lifecycle Manager (Singleton Reuse)          │
│   • Deterministic SQLite Inference Cache               │
│   • Language Detection & Social Text Normalization     │
│   • Multilingual MiniLM Embeddings & HDBSCAN Topics    │
│   • Deterministic Feature Enrichment (4F)              │
│   • Narrative Formation & Priority Signal Scoring (4G) │
│   • Precomputed Analytics Artifacts (JSON)             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   BACKEND API & UI                     │
│   FastAPI Service Layer (Planned)                      │
│   Frontend Analyst Dashboard (Planned)                 │
└────────────────────────────────────────────────────────┘
```

### Why Raw Data is Retained
1. **Offline Replay**: Normalization rules, entity regexes, or parsing logic can be updated and re-executed over historical data without re-contacting Telegram.
2. **Reproducibility & Auditing**: Raw social payloads serve as an immutable record of what the platform returned at collection time.
3. **Debugging**: Protocol or serialization anomalies can be isolated against exact raw structures.
4. **Rate Limit & Flood Protection**: Eliminates redundant network requests to public communication channels.

---

## 3. Repository Structure

TRAJECT is organized as a unified monorepo with top-level separation between application layers:

```text
TRAJECT/
├── backend/
│   ├── app/
│   │   ├── collectors/
│   │   │   └── telegram/         # Telethon client, serializer, and collector
│   │   │       ├── client.py
│   │   │       ├── collector.py
│   │   │       └── serializer.py
│   │   ├── core/
│   │   │   └── config.py         # Deterministic root discovery & .env loading
│   │   ├── normalizers/
│   │   │   └── telegram.py       # Telegram-to-Canonical transformer
│   │   ├── quality/
│   │   │   └── validation.py     # Quality diagnostics & deduplication engine
│   │   ├── replay/
│   │   │   └── telegram_jsonl.py # Streaming offline raw JSONL replayer
│   │   ├── schemas/
│   │   │   └── canonical_message.py  # Unified CanonicalMessage contract
│   │   └── storage/
│   │       └── parquet.py        # Columnar Parquet persistence & dataset builder
│   ├── tests/                    # 84 offline unit tests
│   │   ├── test_config.py
│   │   ├── test_data_quality.py
│   │   ├── test_parquet_storage.py
│   │   ├── test_schemas.py
│   │   ├── test_telegram_collector.py
│   │   ├── test_telegram_normalizer.py
│   │   └── test_telegram_replay.py
│   ├── .venv/                    # Local virtual environment (gitignored)
│   ├── pyproject.toml            # Backend dependencies and pytest config
│   └── README.md                 # Backend-specific developer notes
├── data/
│   ├── raw/
│   │   └── telegram/             # Ingested raw JSONL files (gitignored)
│   └── processed/
│       └── telegram/             # Derived Parquet & quality reports (gitignored)
├── frontend/                     # Planned: Web application and analyst UI
├── models/                       # Planned / local: ML weights & cache (gitignored)
├── notebooks/                    # Planned: Exploratory analysis & validation
├── scripts/                      # Planned: Operational pipelines & batch scripts
├── docs/                         # Planned: Architecture specs & technical docs
├── .env                          # Local secrets & API credentials (gitignored)
├── .env.example                  # Sanitized template for environment variables
├── .gitignore                    # Secrets, caches, sessions, and data ignore rules
└── README.md                     # Root project documentation (this file)
```

---

## 4. Current Status & Milestone Accomplishments

### Milestone 1: Core Foundation & Canonical Data Contract
* **Canonical Schema (`CanonicalMessage`)**: Built on Pydantic v2 with `extra="forbid"`, string trimming, and strict validation.
* **Controlled Types**: Enums for `Platform` (`telegram`, `x`) and `AuthorType` (`channel`, `group`, `user`, `unknown`).
* **Strict UTC Timestamps**: `published_at` and `collected_at` reject naive datetimes; non-UTC timezoned timestamps are converted to UTC.
* **Chat-Scoped Telegram Canonical IDs**: Standardized as `telegram:{chat_id}:{message_id}` (e.g. `telegram:-100123456789:104523`). Because Telegram message IDs are scoped per channel/chat, this prevents ID collisions across different tracked channels.
* **Telegram Normalizer**: Maps synthetic and raw Telegram structures into validated `CanonicalMessage` objects, supporting plain text, media captions, forwarded messages, replies, threads, reactions, and entity extraction (URLs, hashtags, mentions).
* **Security & Environment**: Root `.env` discovery with OS-level environment variable precedence (`override=False`). Complete `.gitignore` protections for data, virtualenvs, test caches, and secrets.

### Milestone 2: Telegram MTProto Ingestion & Session Lifecycle
* **Telethon MTProto Collector**: Implemented using user account authentication via Telethon (not restricted by bot token limitations).
* **Deliberate Serialization Layer**: `TelethonMessageSerializer` converts complex, non-JSON Telethon objects into safe primitive Python dictionaries before persistence.
* **Interactive Authentication & 2FA**:
  * Automatically detects whether a session is already authorized (`client.is_user_authorized()`).
  * If unauthorized, launches interactive terminal sign-in prompting for phone, login code, and cloud 2FA password (using `getpass.getpass`).
  * Subsequent runs automatically reuse the local authenticated session without prompting.
* **Clean Session Recovery**: Intercepts `AuthKeyUnregisteredError` and provides actionable recovery guidance (instructing the user to remove invalid session files) rather than producing an opaque traceback.
* **Secret Protection**: API hashes, phone numbers, login codes, and 2FA passwords are masked or omitted from logs. Session files (`*.session`, `*.session-journal`) are strictly gitignored.
* **Raw JSONL Persistence**: Bounded batches of raw messages are appended line-by-line to `data/raw/telegram/{channel}_{timestamp}.jsonl` before normalization.

### Milestone 3A: Raw Telegram JSONL Replay & Validation
* **100% Offline Replay**: Incremental streaming reader (`iter_raw_telegram_jsonl`) that consumes local JSONL files without initiating any network connection or Telethon client.
* **Pre-Validation**: Lightweight structural pre-validation checking required message IDs, chat identifiers, and timestamps before reaching the normalizer.
* **Single Normalizer Invariant**: Directly routes raw records through `TelegramNormalizer.normalize`, guaranteeing zero duplication of normalization logic.
* **Line-Level Provenance**: Every `ReplayRecord` preserves source file path, line number, and raw reference pointer.
* **Raw Immutability**: Opens raw files strictly in read-only mode (`"r"`), preserving raw data as immutable ground truth.

### Milestone 3B: Durable Processed Storage with Apache Parquet
* **High-Performance Columnar Storage**: `app.storage.parquet` maps `CanonicalMessage` instances into a Snappy-compressed Apache Parquet dataset using `pyarrow`.
* **Complete Schema Mapping**: All 27 domain model fields explicitly represented in `CANONICAL_MESSAGE_ARROW_SCHEMA`.
* **Native Complex Types**: Preserves list entities (`urls`, `hashtags`, `mentions`, `media_types`) as native Arrow lists and reaction maps as native Arrow maps (`pa.map_(pa.string(), pa.int64())`).
* **Microsecond UTC Timestamps**: Timestamps are stored as 64-bit microsecond integers with UTC timezone metadata (`pa.timestamp('us', tz='UTC')`).
* **Audit Metadata**: File footer stores schema version, generation timestamp, and raw source filenames with zero secret leakage.
* **Overwrite Guard**: Enforces safe default (`overwrite=False`) preventing accidental data loss.

### Milestone 3C: Data Quality, Deduplication & Dataset Provenance
* **Quality Diagnostics (`app.quality.validation`)**: Deterministic validation checking identity well-formedness, strict temporal consistency (`collected_at >= published_at`), nonnegative engagement metrics, and content rules (media-only permitted).
* **Severity Distinction**: Differentiates `ERROR` (rejects record from processed storage) from `WARNING` (logs diagnostic issue but retains usable data).
* **Deterministic Deduplication**: Deduplicates strictly by `canonical_id` (`telegram:{chat_id}:{message_id}`) using a **first-occurrence-wins** policy. Duplicate occurrences are logged with dual provenance (first and duplicate locations) in the audit report.
* **Paired Output Artifacts**: Generating Parquet produces paired dataset and audit files:
  * Columnar Parquet: `data/processed/telegram/telegram_messages.parquet`
  * JSON Audit Report: `data/processed/telegram/telegram_messages.quality.json`


### Real-World Telegram Smoke Test
A live verification smoke test was executed against a public Telegram broadcast channel:
* **Target Channel**: `@GenshinUpdate_STR` (Public broadcast channel)
* **Ingestion Limit**: 10 messages
* **Results**:
  * Successfully connected to Telegram MTProto gateway (`149.154.167.51:443`).
  * Authenticated user session saved to `traject_collector_session.session`.
  * **10 raw records** written to `data/raw/telegram/GenshinUpdate_STR_20260902_194324.jsonl`.
  * **10 canonical messages** validated through `TelegramNormalizer`.
  * **0 errors, 0 dropped messages**.

This live test confirms that the complete pipeline operates reliably on production data:
$$\text{Telegram Network} \longrightarrow \text{Telethon Client} \longrightarrow \text{Raw JSONL File} \longrightarrow \text{TelegramNormalizer} \longrightarrow \text{CanonicalMessage Contract}$$

---

## 5. The Canonical Message Contract

All social platforms normalize into the `CanonicalMessage` model ([`backend/app/schemas/canonical_message.py`](file:///d:/Projects/Traject/backend/app/schemas/canonical_message.py)):

| Field | Type | Description |
| :--- | :--- | :--- |
| `canonical_id` | `str` | Unique canonical identifier (`telegram:{chat_id}:{message_id}` or `x:{native_id}`). |
| `platform` | `Platform` | Origin platform enum (`telegram`, `x`). |
| `native_id` | `str` | Platform-native post or status ID. |
| `author_id` | `str` | Unique ID of author or publishing channel. |
| `author_username` | `str \| None` | Screen name or handle (e.g. `@channel_name`). |
| `author_type` | `AuthorType` | Categorization: `channel`, `group`, `user`, or `unknown`. |
| `channel_title` | `str \| None` | Display title of channel or community group. |
| `subscriber_count` | `int \| None` | Follower or participant count at collection time. |
| `published_at` | `datetime` | Original publication timestamp (strictly timezone-aware UTC). |
| `collected_at` | `datetime` | Ingestion timestamp (strictly timezone-aware UTC). |
| `text_content` | `str` | Clean UTF-8 textual content or media caption. |
| `language` | `str \| None` | Detected or reported language code (e.g. `en`, `hi`). |
| `media_types` | `list[str]` | List of media categories (`['photo']`, `['video']`, `['document']`). |
| `has_media` | `bool` | Flag indicating media attachment presence. |
| `is_forward` | `bool` | True if forwarded from another channel or user. |
| `is_repost` | `bool` | True if native platform repost / retweet. |
| `origin_source_id` | `str \| None` | Identifier of original post if forwarded/reposted. |
| `reply_to_id` | `str \| None` | Parent message ID if this is a comment or reply. |
| `thread_id` | `str \| None` | Conversation or forum topic root ID. |
| `views_count` | `int \| None` | Verified impression count. |
| `forwards_count` | `int \| None` | Share or forward count. |
| `replies_count` | `int \| None` | Reply count. |
| `reactions` | `dict[str, int]` | Standardized mapping of emoji to counts (e.g. `{"👍": 42}`). |
| `urls` | `list[str]` | Extracted HTTP/HTTPS URLs. |
| `hashtags` | `list[str]` | Extracted hashtags (`#tag`). |
| `mentions` | `list[str]` | Extracted mentions (`@user`). |
| `raw_reference` | `str \| None` | Traceability reference to the immutable raw record (file and line index). |

---

## 6. Setup & Installation (New Developer Onboarding)

Welcome to TRAJECT! This guide will walk you through setting up the complete development environment from scratch, installing all dependencies, verifying with automated tests, and running the machine learning pipeline.

### Prerequisites
* **Python 3.11+** (Tested on Python 3.11, 3.12, and 3.13.14).
* **Git** (for version control).
* *(Optional)* **Telegram Account** and API credentials from [my.telegram.org](https://my.telegram.org) — **Only needed for collecting live data from Telegram**. Offline replay, dataset inspection, and the complete ML pipeline run 100% offline without Telegram credentials!
* *(Optional)* **Hugging Face Account & Token** — Public model weights download automatically without a token. Set `HF_TOKEN` in `.env` if you experience rate limiting or want to use a personal access token.

---

### Step 1: Clone Repository & Create Virtual Environment

```powershell
# Clone repository
git clone https://github.com/ezManish/Traject.git
cd Traject

# Create Python virtual environment under backend/
cd backend
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

# Windows (Command Prompt):
.\.venv\Scripts\activate.bat

# Linux / macOS (Bash/Zsh):
source .venv/bin/activate
```

---

### Step 2: Install Dependencies

Install TRAJECT's core backend, storage, and machine learning packages in editable development mode:

```powershell
# From within backend/ (with .venv activated):
pip install --upgrade pip
pip install -e ".[dev,test]"
```

> [!NOTE]
> **Windows Platform Note**: Windows systems automatically pull `tzdata` (specified in `pyproject.toml`) to ensure exact microsecond UTC timezone handling for Arrow and Parquet storage.

---

### Step 3: Configure Environment (`.env`)

TRAJECT configuration is managed centrally via a `.env` file at the **repository root**:

1. Copy the template to `.env`:
   ```powershell
   # Windows (PowerShell from repository root):
   Copy-Item .env.example .env

   # Linux / macOS:
   cp .env.example .env
   ```
2. The default values in `.env.example` are immediately functional for offline development, local unit tests, and ML pipeline runs!
3. If you plan to collect live data from Telegram, open `.env` and fill in `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_PHONE`.

---

### Step 4: Verify Installation (Run the 200-Test Suite)

Run the full automated test suite to ensure all schemas, collectors, normalizers, storage engines, machine learning pipelines, and the Analytics API are functioning properly:

```powershell
# From within backend/ directory (with .venv activated):
pytest -q

# Or from repository root:
pytest -q
```

**Expected Result**:
```text
============================ 200 passed in ~60s =============================
```
*Zero network calls are made during tests. All tests use mocked clients, deterministic synthetic fixtures, and local datasets.*


---

## 7. Running the Machine Learning Pipeline

TRAJECT includes an end-to-end production ML pipeline (Milestone 4H) that performs language identification, safe social text normalization, sentence embedding, unsupervised HDBSCAN topic discovery, contextual feature enrichment, and narrative priority scoring.

### 1. Run Pipeline on Synthetic 16-Record Fixture
```powershell
# From backend/ directory:
python -m app.ml.pipeline.orchestrator --fixture tests/fixtures/features/synthetic_enrichment_fixture.jsonl
```
This executes the 5-stage pipeline, demonstrates inference caching, outputs the runtime telemetry report, and shows promoted narrative candidates with their composite Priority Signal Scores.

### 2. Run Pipeline on Processed Parquet Dataset & Export Artifact
```powershell
# From backend/ directory:
python -m app.ml.pipeline.orchestrator --parquet ../data/processed/telegram/telegram_messages.parquet --output ../data/processed/telegram/telegram-analytics-artifact.json --overwrite
```

### 3. Run Batch-Size Performance Benchmark
```powershell
# From backend/ directory:
python -m app.ml.pipeline.benchmark
```
Benchmarks CPU inference across mini-batch sizes 8, 16, 32, and 64, recording operating system Peak RSS and Python heap allocations.

---

## 8. Data Pipelines & Telegram Collector

### Streaming Offline JSONL Replay (Milestone 3A)
Replays raw platform payloads through the normalization engine without hitting external APIs:
```powershell
# From backend/ directory:
python -m app.replay.telegram_jsonl --input ../data/raw/telegram/GenshinUpdate_STR_20260902_194324.jsonl --output ../data/processed/telegram/replay_output.jsonl
```

### Data Quality & Deduplication (Milestone 3C)
Validates schema integrity, removes duplicates via `canonical_id` (first-occurrence-wins), and outputs paired Parquet and `.quality.json` audit reports:
```powershell
# From backend/ directory:
python -m app.quality.validation --input ../data/processed/telegram/replay_output.jsonl --output ../data/processed/telegram/telegram_messages.parquet
```

### Running the Live Telegram Collector (Optional)
If Telegram credentials are configured in `.env`, collect live messages from any public channel:
```powershell
# From backend/ directory:
python -m app.collectors.telegram.collector --channel "@GenshinUpdate_STR" --limit 10
```
*On first run, Telethon prompts for a login verification code sent to your Telegram app. The session is persisted locally (`traject_collector_session.session`) for immediate passwordless subsequent runs.*

---

---

## 9. Running the Backend Analytics API (Milestone 5A)

TRAJECT includes a high-performance, typed FastAPI serving layer (`/api/v1`) that exposes precomputed narrative intelligence, semantic topic clusters, and canonical social media records without executing any ML inference on the request path.

### Step-by-Step Terminal Guide

#### 1. Open PowerShell and Navigate to Backend
```powershell
cd D:\Projects\Traject\backend
```

#### 2. Activate Virtual Environment
```powershell
.\.venv\Scripts\Activate.ps1
```
> [!NOTE]
> If your PowerShell execution policy blocks running scripts, run this one-time bypass in your terminal session:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
> ```

#### 3. Start the API Server
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
You should see console output confirming the server has started and loaded artifacts:
```text
INFO:     Will watch for changes in: ['D:\\Projects\\Traject\\backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process using WatchFiles
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     TRAJECT Backend Analytics API initializing...
INFO:     Application startup complete.
```

#### 4. Verify Endpoints While the Server is Running

##### Option A: Interactive Browser Documentation (Swagger UI)
Open **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)** in your browser to inspect and interactively test all 10 API endpoints.
Alternative documentation formats:
* **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
* **OpenAPI JSON Schema**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

##### Option B: Terminal Verification (PowerShell)
Open a second PowerShell window and test the core endpoints with `Invoke-RestMethod` (or `curl`):

* **Health Check & In-Memory Artifact Status:**
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
  ```
  *Response:*
  ```json
  {
    "status": "healthy",
    "version": "0.1.0",
    "active_records_count": 10,
    "active_narratives_count": 3,
    "active_topics_count": 2,
    "pipeline_stage": "READY"
  }
  ```

* **Analytics Dashboard Overview:**
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8000/api/v1/analytics
  ```

* **Prioritized Narratives (sorted by Signal Score descending):**
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8000/api/v1/narratives
  ```

* **Discovered Semantic Topics:**
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8000/api/v1/topics
  ```

* **Canonical Messages:**
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8000/api/v1/messages
  ```

* **ML Pipeline Metrics & Provenance:**
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8000/api/v1/pipeline/metrics
  ```

#### 5. Stopping the Server
Press `CTRL+C` in the terminal running Uvicorn to shut down the server cleanly.

### Available Endpoints Summary (`/api/v1`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Operational readiness and artifact loading state. |
| `GET` | `/api/v1/analytics` | Dashboard summary metrics, message volume, and priority distribution. |
| `GET` | `/api/v1/narratives` | Paginated, filterable prioritized narrative candidates. |
| `GET` | `/api/v1/narratives/{id}` | Detailed explainable narrative metrics, sub-scores, and audit rationale. |
| `GET` | `/api/v1/topics` | Discovered semantic topic clusters with representative c-TF-IDF keywords. |
| `GET` | `/api/v1/topics/{id}` | Diagnostic topic features (entities, engagement, propagation, burstiness). |
| `GET` | `/api/v1/messages` | Paginated canonical messages (supports topic, media, platform filters). |
| `GET` | `/api/v1/messages/{id}` | Full canonical message record by chat-scoped ID (e.g. `telegram:chan:101`). |
| `GET` | `/api/v1/pipeline/status` | Upstream pipeline execution lifecycle, provenance, and cache status. |
| `GET` | `/api/v1/pipeline/metrics` | Audit-ready stage latencies, memory footprint, and cache performance. |

---

## 10. Testing & Quality Assurance Architecture

TRAJECT maintains **200 automated unit, regression, and contract tests**:

| Test Module | Tests | Focus Area & Invariants |
| :--- | :---: | :--- |
| `test_config.py` | 2 | Deterministic repository root discovery & OS environment variable precedence. |
| `test_schemas.py` | 8 | 27-field `CanonicalMessage` schema, UTC validation, and chat-scoped ID rules. |
| `test_telegram_collector.py` | 17 | MTProto payload serialization, entity spans, 2FA masking, and error recovery. |
| `test_telegram_normalizer.py` | 8 | UTF-8 normalization, captions, forwards, replies, and cross-channel IDs. |
| `test_telegram_replay.py` | 15 | Line-level streaming, malformed line tolerance, and provenance tracking. |
| `test_parquet_storage.py` | 15 | Columnar Parquet persistence, Snappy compression, and Arrow round-trips. |
| `test_data_quality.py` | 19 | Temporal order, first-occurrence deduplication, and quality audit JSON reports. |
| `test_ml_dataset.py` | 16 | Parquet ML loader, `MLTextRecord` preparation, and dataset inspection statistics. |
| `test_ml_language.py` | 4 | Multilingual detection (`langdetect`), confidence thresholding, unknown fallback. |
| `test_ml_normalization.py` | 6 | Social-safe Unicode NFC normalization, preserving URLs, hashtags, and emojis. |
| `test_sentiment_metrics.py` | 8 | English sentiment baseline (RoBERTa), confusion matrix, and macro F1 metrics. |
| `test_sentiment_multilingual.py` | 5 | Multilingual XLM-RoBERTa sentiment evaluation and model recommendation routing. |
| `test_topics.py` | 8 | Sentence embeddings, HDBSCAN clustering, c-TF-IDF keywords, and centroids. |
| `test_topic_features.py` | 13 | 4F Feature vectors: entities, engagement, observed forwarding, and burstiness. |
| `test_narratives.py` | 20 | 4G Narrative candidate formation, Priority Signal Score, and evidence tiers. |
| `test_ml_cache.py` | 9 | Deterministic SQLite inference caching, cache-key semantics, and hit rates. |
| `test_ml_performance.py` | 4 | Cold-start vs warm inference benchmarks, memory telemetry, and parity checks. |
| `test_ml_pipeline.py` | 5 | End-to-end orchestrator execution, analytics artifact serialization, and reuse. |
| `test_api_*.py` | 20 | Milestone 5A Backend Analytics API: health, overview, narratives, topics, messages, pipeline, and error envelopes. |
| **Total** | **200** | **100% Offline, Mocked, Deterministic Test Suite** |

```powershell
# Run full test suite from backend directory:
cd backend
pytest -q

# Or from repository root:
pytest -q
```

---

## 11. Security & Privacy Considerations

* **Secrets Management**: `.env` and `.env*.local` are strictly ignored by Git. API hashes, tokens, and session keys must never be committed.
* **Session Integrity**: Telegram MTProto session files (`*.session`, `*.session-journal`) contain authenticated encryption keys and are excluded by `.gitignore`.
* **No Secret Leakage**: Collector and script modules sanitize credentials. All model scripts use environment variables (`os.environ.get("HF_TOKEN")`) rather than hardcoded keys.
* **Sensitive Inputs**: 2FA passwords are read via `getpass.getpass()`, preventing terminal buffer logging.
* **Data Sensitivity**: Raw payloads in `data/raw/` are excluded from version control. Analysts must handle public communications datasets in compliance with relevant data privacy principles and NTRO guidelines.

---

## 12. Development Principles

1. **Build from Real Data**: Design schemas and normalizers against actual platform payloads, not theoretical assumptions.
2. **Preserve Raw Data First**: Always persist raw, immutable responses to allow offline replaying and schema iteration.
3. **Single Canonical Contract**: All platforms must normalize into a shared data model. Never create platform-specific ML pipelines.
4. **Reproducible Pipelines**: Ensure every normalized record maintains a `raw_reference` linking it back to source raw files.
5. **Test Before Architecture Expansion**: Prove collection and normalization before adding databases, queues, or distributed workers.
6. **Zero Unnecessary Dependencies**: Add libraries only when actively required. No Redis, Kafka, or distributed databases unless strictly necessary.
7. **Pretrained Baselines First**: Utilize established pretrained models before attempting custom fine-tuning.
8. **Evaluate Before Fine-Tuning**: Base model selection on quantitative evaluation metrics against TRAJECT datasets.
9. **Never Commit Secrets**: Treat credentials, session files, and access tokens as strictly sensitive.
10. **Honest Documentation**: Document only what is implemented; clearly distinguish active functionality from future roadmap milestones.

---

## 13. Project Roadmap

### Completed Milestones
- [x] **Milestone 1**: Repository foundation and clean monorepo structure
- [x] **Milestone 2**: Unified `CanonicalMessage` schema (Pydantic v2) and Telegram collector/normalizer
- [x] **Milestone 3A**: Streaming offline raw JSONL replay and validation engine
- [x] **Milestone 3B**: Durable analytical Parquet storage with typed 27-field Arrow schema
- [x] **Milestone 3C**: Data quality checks, deterministic deduplication (`canonical_id`), and paired quality reports
- [x] **Milestone 4A**: ML dataset loader, `MLTextRecord` preparation, and dataset inspection statistics
- [x] **Milestone 4B**: Multilingual language identification and social-safe text normalization
- [x] **Milestone 4C**: Pretrained English sentiment baseline (RoBERTa) and evaluation metrics
- [x] **Milestone 4D**: Multilingual sentiment adapter (XLM-RoBERTa) and per-language evaluation
- [x] **Milestone 4E**: Sentence embeddings (`MiniLM-L12-v2`), HDBSCAN topic discovery, and c-TF-IDF keywords
- [x] **Milestone 4F**: Deterministic feature enrichment (social/gazetteer entities, engagement, propagation, burstiness)
- [x] **Milestone 4G**: Narrative candidate formation, bounded Priority Signal Scoring, and evidence-density heuristics
- [x] **Milestone 4H**: Production ML pipeline orchestration, singleton model lifecycle, SQLite inference cache, and batch benchmarking
- [x] **Milestone 5A**: Backend Analytics API implementation (FastAPI serving precomputed analytics, 10 typed endpoints, sub-2ms latencies)

### Current & Upcoming Milestones
- [ ] **Milestone 5B**: Interactive Analyst Web Dashboard (Next.js / Vite frontend consuming `/api/v1`)
- [ ] **Milestone 6**: Continuous timeline ingestion & sliding-window dynamic narrative mutation tracking
- [ ] **Milestone 7**: Cross-platform collectors: **X (Twitter)**, Reddit, and YouTube

- [ ] **Milestone 8**: Information cascade graph and influence propagation analysis (NetworkX / Neo4j)

---

## 13. License

This project is licensed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
