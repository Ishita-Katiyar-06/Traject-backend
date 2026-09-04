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
| **Current Implementation** | • Python backend foundation (`backend/app/`)<br>• Core `CanonicalMessage` schema (Pydantic v2) with strict UTC timestamp enforcement and controlled platform/author types<br>• Chat-scoped deterministic Telegram canonical ID generation (`telegram:{chat_id}:{message_id}`)<br>• Telegram message normalizer (`TelegramNormalizer`) handling plain text, captions, forwards, replies, reactions, and entity extraction<br>• MTProto collector (`Telethon`) supporting interactive terminal authentication and cloud 2FA<br>• Appendable, immutable raw JSONL storage (`data/raw/telegram/`)<br>• Streaming offline JSONL replay & pre-validation engine (`backend/app/replay/`) with line-level provenance preservation<br>• Columnar processed storage (`backend/app/storage/`) using Snappy-compressed Apache Parquet with 27-field typed schema, native Arrow lists, reaction maps, and UTC microsecond timestamps<br>• Data quality & deduplication engine (`backend/app/quality/`) enforcing temporal consistency, identity well-formedness, engagement integrity, first-occurrence-wins deduplication on `canonical_id`, and generating paired JSON quality audit reports<br>• **ML Dataset & Inspection Layer (4A)**: Canonical Parquet ML loader, `MLTextRecord` preparation, and deterministic statistical profiling<br>• **Language Identification & Normalization (4B)**: Deterministic multilingual language detection (`langdetect`) and social-safe text normalization<br>• **Sentiment Intelligence Baseline (4C/4D)**: Pretrained frozen sentiment adapters (English RoBERTa & Multilingual XLM-RoBERTa), evaluation metrics, and model recommendation routing<br>• **Topic Discovery Baseline (4E)**: Multilingual sentence embeddings (`paraphrase-multilingual-MiniLM-L12-v2`), unsupervised HDBSCAN clustering, deterministic c-TF-IDF keyword extraction, and representative message centroids<br>• **Topic Feature Enrichment (4F)**: Deterministic feature vectors across social/gazetteer entities, engagement metrics, observed forwarding propagation, uncredited syndication detection, and temporal cadence/burstiness<br>• **Narrative Candidate Formation & Scoring (4G)**: Bounded, explainable Priority Signal Score ($S \in [0, 1]$) with Spread, Potential Coordination, Observed Reach, and Friction sub-scores, audit rationale, and evidence-density tiers<br>• **Production Pipeline & Caching (4H)**: Unified `run_ml_pipeline` orchestration, process-level singleton `ModelLifecycleManager`, thread-safe deterministic SQLite `InferenceCache`, batch-size benchmark harness, and precomputed analytics export (`MLPipelineResult`)<br>• **180 passing tests** using mocked clients and offline datasets (zero network calls during test runs)<br>• Successful real-world smoke test against public Telegram channel (`@GenshinUpdate_STR`) and verified end-to-end replay, quality check, Parquet conversion, and ML pipeline analytics |
| **Planned / Future Scope** | • Continuous timeline and streaming ingestion<br>• **X (Twitter)** ingestion collector (Essential)<br>• **Instagram** and **Facebook** collectors (Desirable)<br>• **Reddit** and **YouTube** collectors (Appreciable additional sources)<br>• Dynamic sliding-window narrative mutation tracking<br>• Multi-node distributed inference caching (Redis/PostgreSQL)<br>• Information cascade topology, link analysis, and influence propagation graphs<br>• Aggregate and anonymized demographic profiling<br>• FastAPI backend service layer and Next.js / Vite analyst dashboard |

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

## 6. Setup & Installation

### Prerequisites
* **Python 3.11+** (Tested on Python 3.13)
* **Git**
* **Telegram Account** and API credentials (`api_id`, `api_hash`) from [my.telegram.org](https://my.telegram.org)

### 1. Clone & Set Up Virtual Environment

```powershell
# Clone the repository
git clone https://github.com/ezManish/Traject.git
cd Traject

# Create and activate local virtual environment under backend/
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

The project currently uses a minimal, lightweight dependency set. Heavy machine learning frameworks (PyTorch, Transformers, Sentence-Transformers) have **not** been added yet.

```powershell
# From within backend/ (with .venv activated):
pip install -e .
# Or install direct foundation dependencies:
pip install pydantic telethon python-dotenv pytest pytest-asyncio
```

---

## 7. Environment Configuration

Configuration is managed via a `.env` file located at the **repository root**:

```text
TRAJECT/
├── .env          # Secrets & API credentials (GITIGNORED)
├── .env.example  # Template with placeholders
└── backend/
```

### Setup Steps
1. Copy the example template to `.env` at the root of the repository:
   ```powershell
   # From the repository root:
   Copy-Item .env.example .env
   ```
2. Populate the required values with your own Telegram API credentials:
   ```ini
   # Environment & Logging
   APP_ENV=development
   LOG_LEVEL=INFO

   # Telegram Collector Configuration (Telethon / MTProto)
   # Obtain credentials from https://my.telegram.org
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_SESSION=traject_collector_session
   TELEGRAM_PHONE=+91XXXXXXXXXX

   # Local Storage Directories
   DATA_RAW_DIR=./data/raw
   DATA_PROCESSED_DIR=./data/processed
   ```

### Deterministic Discovery & Precedence
* **Automatic Root Discovery**: The application automatically locates the repository root `.env` from any working directory using [`find_repo_root()`](file:///d:/Projects/Traject/backend/app/core/config.py).
* **OS Precedence**: Operating system environment variables explicitly set in your terminal session take precedence over values in the `.env` file (`override=False`).

---

## 8. Running the Telegram Collector

The collector fetches a bounded batch of recent messages from any public Telegram channel and persists them to raw storage before normalization.

### Command Line Interface

```powershell
# From backend/ directory with activated virtual environment:
python -m app.collectors.telegram.collector --channel "@GenshinUpdate_STR" --limit 10
```

### What to Expect on First Run
1. **Phone Number**: Prompts for your telephone number if not configured in `.env`.
2. **Login Code**: Telegram sends an official login code to your Telegram app. Enter this code in the terminal.
3. **2FA Password**: If your account has Two-Factor Authentication (Cloud Password) enabled, enter your password (input is masked via `getpass`).
4. **Session Persistence**: The authenticated MTProto session is securely saved locally (`traject_collector_session.session`). Subsequent runs authenticate immediately without prompting.

### Output
* **Raw Payloads**: Appended to `data/raw/telegram/{channel}_{timestamp}.jsonl`
* **Normalized Data**: Streamed through `TelegramNormalizer` into validated `CanonicalMessage` objects
* **CLI Summary**:
  ```text
  Collection Summary:
  Channel: @GenshinUpdate_STR (ID: 3190072493)
  Raw file: D:\Projects\Traject\data\raw\telegram\GenshinUpdate_STR_20260902_194324.jsonl
  Messages Collected: 10
  Messages Normalized: 10
  ```

---

## 9. Testing & Quality Assurance

All automated unit tests run entirely offline using mock objects and **make zero network calls to Telegram**.

### Executing Tests

```powershell
# From backend/ directory:
.\.venv\Scripts\pytest tests -v
```

### Test Coverage (84 Passing Tests)
* **Configuration & Precedence (`test_config.py` - 2 tests)**: Deterministic repository root discovery; strict OS environment variable precedence over `.env`.
* **Canonical Schema Validation (`test_schemas.py` - 8 tests)**: Valid model creation, strict rejection of unsupported platforms (`Platform` enum), rejection of missing required fields, strict UTC timestamp enforcement and conversion, stable canonical ID format validation, rejection of negative engagement metrics, and extra field forbidding.
* **Telegram Serialization (`test_telegram_collector.py` - 17 tests)**: Primitive dictionary conversion, signed 64-bit chat ID and peer ID extraction, message ID extraction, media type detection, forward origin headers, reply/thread headers, reaction maps, entity spans, and malformed payload handling.
* **Telegram Normalization (`test_telegram_normalizer.py` - 8 tests)**: Broadcast text messages, media captions, forwarded messages, comments/replies, multi-script unicode preservation (e.g. Hindi scripts and emojis), missing optional fields, and cross-channel ID differentiation.
* **Streaming Offline Replay (`test_telegram_replay.py` - 15 tests)**: Line-by-line reading, blank line handling, malformed JSON recovery without aborting, pre-validation checks, source file and line-number provenance, raw JSONL SHA-256 immutability, deterministic ordering, and single-normalizer reuse.
* **Durable Parquet Storage (`test_parquet_storage.py` - 15 tests)**: Complete 27-field Arrow schema mapping, nullability preservation, native Arrow list and reaction map round-trips, microsecond UTC timestamps, custom dataset metadata, overwrite guard, empty input rejection, and end-to-end replay-to-Parquet conversion.
* **Data Quality & Deduplication (`test_data_quality.py` - 19 tests)**: Temporal consistency checks (`collected_at >= published_at`), identity checks, media-only acceptance, engagement integrity, deterministic first-occurrence-wins deduplication on `canonical_id`, duplicate provenance retention, paired Parquet and JSON report generation, and atomic overwrite guards.

---

## 10. Security & Privacy Considerations

* **Secrets Management**: `.env` and `.env*.local` are explicitly ignored by Git. Real credentials, tokens, and hashes must never be committed.
* **Session Integrity**: Telegram MTProto session files (`*.session`, `*.session-journal`) contain authenticated encryption keys and are strictly ignored by Git.
* **Secret Masking**: All credential objects implement custom `__repr__` and `__str__` methods to prevent `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_PHONE` from leaking into logs or tracebacks.
* **Hidden Inputs**: 2FA passwords are read via `getpass.getpass()`, preventing shoulder surfing and terminal buffer leakage.
* **Data Sensitivity**: Ingested social media data in `data/` is excluded from version control. Analysts must handle public communications datasets in compliance with relevant data privacy principles and NTRO guidelines.

---

## 11. Development Principles

1. **Build from Real Data**: Design schemas and normalizers against actual platform payloads, not theoretical assumptions.
2. **Preserve Raw Data First**: Always persist raw, immutable responses to allow offline replaying and schema iteration.
3. **Single Canonical Contract**: All platforms must normalize into a shared data model. Never create platform-specific ML pipelines.
4. **Reproducible Pipelines**: Ensure every normalized record maintains a `raw_reference` linking it back to source raw files.
5. **Test Before Architecture Expansion**: Prove collection and normalization before adding databases, queues, or distributed workers.
6. **Zero Unnecessary Dependencies**: Add libraries only when actively required. Heavy ML dependencies will be introduced incrementally.
7. **Pretrained Baselines First**: Utilize established pretrained models before attempting custom fine-tuning.
8. **Evaluate Before Fine-Tuning**: Base model selection and fine-tuning on quantitative evaluation metrics against TRAJECT datasets.
9. **Never Commit Secrets**: Treat credentials, session files, and raw user identifiers as strictly sensitive.
10. **Honest Documentation**: Document only what is implemented; clearly distinguish active functionality from future roadmap milestones.

---

## 12. Project Roadmap

### Completed Milestones
- [x] Repository foundation and clean monorepo structure
- [x] Unified `CanonicalMessage` schema with Pydantic v2
- [x] Chat-scoped Telegram canonical ID convention (`telegram:{chat_id}:{message_id}`)
- [x] Telegram normalizer with media, forward, reply, and entity parsing
- [x] Deterministic repository-root `.env` discovery with OS environment precedence
- [x] Telethon MTProto historical channel collector
- [x] Interactive terminal authentication with 2FA cloud password support
- [x] Session persistence and `AuthKeyUnregisteredError` recovery
- [x] Appendable raw JSONL storage pipeline (`data/raw/telegram/`)
- [x] 84 offline unit tests covering schemas, collectors, replay, Parquet, and quality validation
- [x] Live real-world Telegram smoke test against public broadcast channel (`@GenshinUpdate_STR`)
- [x] Milestone 3A: Offline raw JSONL replay and validation pipeline
- [x] Milestone 3B: Durable analytical Parquet storage (`data/processed/telegram/`)
- [x] Milestone 3C: Data quality checks, deterministic deduplication (`canonical_id`), and JSON audit reports

### Next Milestones
- [ ] Preprocessing and text cleaning pipeline
- [ ] Baseline pretrained sentiment and emotion classification
- [ ] Model evaluation on TRAJECT intelligence benchmarks

- [ ] Fine-tuning pipeline (only if evaluation demonstrates necessity)
- [ ] Real-time topic, framing, and narrative genesis detection
- [ ] Information cascade graph and influence propagation analysis
- [ ] **X (Twitter)** collector and normalizer (feeding identical `CanonicalMessage` contract)
- [ ] Additional platform collectors (Instagram, Facebook, Reddit, YouTube)
- [ ] Aggregate demographic and linguistic analysis
- [ ] FastAPI backend service layer
- [ ] Next.js / Vite analyst dashboard

---

## 13. License

This project is licensed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
