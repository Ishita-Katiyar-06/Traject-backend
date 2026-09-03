# TRAJECT Backend & Data Foundation

This directory houses the core Python backend, ingestion pipelines, normalization engines, and machine learning components for **TRAJECT** (SIH 2026 Problem Statement 26152 - NTRO).

---

## 1. Purpose

The backend processes multi-platform social media streams into structured, explainable narrative intelligence. Rather than coupling downstream analytics directly to raw platform-specific APIs, the backend decouples ingestion from analysis using a strict, normalized data contract.

---

## 2. The Canonical Message Concept

Downstream analysis modules (narrative genesis, cascade graphs, sentiment mutation, framing analysis) must not require custom code paths for each social network.

Instead, all ingested data is mapped into a single unified data contract:
```text
Telegram Raw Payload ──→ TelegramNormalizer ──┐
                                             ├──→ CanonicalMessage ──→ Downstream Analytics
X (Twitter) Payload  ──→ XNormalizer        ──┘    (Pydantic v2)        (Shared ML Pipeline)
```

The `CanonicalMessage` entity (`app/schemas/canonical_message.py`) standardizes:
- **Identity**: Deterministic `canonical_id` (`telegram:{chat_id}:{message_id}` for Telegram, `x:{native_id}` for X), `platform`, `native_id`.
- **Author & Entity**: Origin account ID, username, type (`channel`, `group`, `user`, `unknown`), channel title, subscriber count.
- **Temporal Alignment**: UTC-normalized timestamps (`published_at`, `collected_at`).
- **Content & Media**: UTF-8 clean text, language code, media type flags.
- **Topological Links**: Forward origin tracking (`origin_source_id`), reply parent (`reply_to_id`), conversation thread (`thread_id`).
- **Engagement Metrics**: Views, forwards, replies, and structured reaction maps.
- **Traceability**: Reference pointer back to the immutable raw platform payload.

---

## 3. Getting Started

### Virtual Environment Setup
Ensure you are using Python 3.11+:

```powershell
# From the repository root:
python -m venv backend/.venv

# Activate virtual environment (Windows PowerShell)
.\backend\.venv\Scripts\Activate.ps1

# Install base dependencies and test dependencies
pip install pydantic telethon python-dotenv pytest pytest-asyncio
```

### Running Tests
Execute the unit test suite across schemas, normalizers, collector, and offline replay:

```powershell
# From the repository root:
.\backend\.venv\Scripts\pytest backend/tests -v

# Or from within backend/:
cd backend
pytest
```

---

## 4. Telegram Collector Usage

The Telegram historical collector uses Telethon to ingest public channel messages into immutable raw JSONL storage before passing them to the normalizer.

### Configuration
Set your Telegram credentials in `.env`:
```bash
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
TELEGRAM_SESSION=traject_collector_session
```

### CLI Execution
Collect a bounded batch of recent messages from any public channel:

```powershell
# From backend directory (with PYTHONPATH set or activated venv):
python -m app.collectors.telegram.collector --channel @channel_username --limit 10
```
Raw outputs are saved to `data/raw/telegram/{channel}_{timestamp}.jsonl`.

---

## 5. Offline Telegram JSONL Replay & Validation (Milestone 3A)

The replay pipeline (`app.replay.telegram_jsonl`) re-evaluates historical raw Telegram records without connecting to Telegram.

### Key Principles
* **100% Offline**: Replay operates strictly on local `.jsonl` files. Zero network requests or Telethon clients are created.
* **Raw Immutability**: Raw files under `data/raw/telegram/` are opened strictly in read-only mode (`"r"`).
* **Single Normalizer Invariant**: Replay routes through the exact same `TelegramNormalizer.normalize` used by the live collector.
* **Deterministic Execution**: Preserves the original `collected_at` timestamp from the raw payload instead of substituting the current time.
* **Line-Level Provenance**: Every `ReplayRecord` tracks the source file, line number, and raw reference pointer.

### CLI Execution

```powershell
# Replay an entire raw directory:
python -m app.replay.telegram_jsonl --input ..\data\raw\telegram

# Replay a single raw JSONL file:
python -m app.replay.telegram_jsonl --input ..\data\raw\telegram\GenshinUpdate_STR_20260902_194324.jsonl
```

---

## 6. Durable Processed Storage with Apache Parquet (Milestone 3B)

The processed storage pipeline (`app.storage.parquet`) converts replayed `CanonicalMessage` objects into durable, columnar Apache Parquet datasets.

### Architectural Invariants
* **Derived Storage**: Parquet datasets under `data/processed/telegram/` are derived representations. They never replace, mutate, or alter the immutable raw JSONL source.
* **Single Replay Source**: Parquet generation consumes records directly from `TelegramJSONLReplayer` and `TelegramNormalizer`.
* **Zero Secrets in Metadata**: Parquet file footers contain schema versions, generation timestamps, and raw source filenames, with zero credential or personal token leakage.
* **Git Exclusion**: Generated Parquet datasets (`data/processed/`) are strictly local and excluded by `.gitignore`.

### Schema & Data Mapping
All 27 fields of `CanonicalMessage` are explicitly mapped into a typed Apache Arrow schema (`CANONICAL_MESSAGE_ARROW_SCHEMA`):
* **Lists**: `media_types`, `urls`, `hashtags`, `mentions` are stored as native Arrow string lists (`pa.list_(pa.string())`).
* **Reactions**: Mapped to native Arrow maps (`pa.map_(pa.string(), pa.int64())`) and reconstructed as Python dictionaries upon reading.
* **Timestamps**: `published_at` and `collected_at` preserve microsecond precision with strict UTC timezone metadata (`pa.timestamp('us', tz='UTC')`).
* **Nullability**: Nullable fields (`author_username`, `channel_title`, `subscriber_count`, `views_count`, etc.) preserve `None` rather than coercing to empty strings or zeroes.

### CLI Execution

```powershell
# Generate processed Parquet dataset from raw Telegram JSONL:
python -m app.storage.parquet --input ..\data\raw\telegram --output ..\data\processed\telegram\telegram_messages.parquet --overwrite
```

---

## 7. Data Quality, Deduplication & Dataset Provenance (Milestone 3C)

The data quality and deduplication pipeline (`app.quality.validation`) inspects and sanitizes normalized messages before they are persisted into processed Parquet storage.

### Core Architecture & Invariants
* **Immutable Raw Ground Truth**: Deduplication occurs strictly downstream in the processed pipeline. Raw JSONL files under `data/raw/` are never deleted, altered, or deduplicated in place.
* **Deterministic Deduplication**: Primary key is `canonical_id` (`telegram:{chat_id}:{message_id}`). Content or text similarity is not used for deduplication (distinct channels or messages with identical text are preserved).
* **First-Occurrence-Wins Policy**: The first valid occurrence of a `canonical_id` is retained; subsequent duplicate occurrences are rejected and logged in the audit report with line-level provenance for both occurrences.
* **Paired Output Artifacts**: Generating Parquet produces paired artifacts atomically:
  * Columnar dataset: `data/processed/telegram/telegram_messages.parquet`
  * Audit quality report: `data/processed/telegram/telegram_messages.quality.json`

### Quality Checks & Error Classification
* **Errors (Rejects record)**:
  * Missing or whitespace `canonical_id` (`EMPTY_CANONICAL_ID`).
  * Unsupported platform identifier (`UNSUPPORTED_PLATFORM`).
  * Naive timestamps without UTC timezone metadata (`NAIVE_TIMESTAMP`).
  * Inverted temporal ordering where `collected_at < published_at` (`INVALID_TIMESTAMP_ORDER`).
  * Negative engagement metrics or negative reaction counts (`NEGATIVE_ENGAGEMENT_METRIC`).
* **Warnings (Retains record, logs diagnostic)**:
  * Duplicate message instances (`DUPLICATE_CANONICAL_ID`).
  * Messages with neither textual content nor attached media (`EMPTY_MESSAGE_BODY`).
  * Missing raw storage reference pointer (`MISSING_RAW_REFERENCE`).
* **Historical Data**: Historical messages (regardless of age) are accepted provided temporal consistency holds.

### CLI Execution & Audit Report

```powershell
# Run full replay, quality validation, deduplication, and Parquet build:
python -m app.storage.parquet --input ..\data\raw\telegram --output ..\data\processed\telegram\telegram_messages.parquet --overwrite
```

Console summary output:
```text
Telegram Parquet build complete

Source:
  D:\Projects\Traject\data\raw\telegram

Files processed: 1
Records read: 10
Records normalized: 10
Records failed: 0
Records invalid: 0
Duplicates detected: 0
Records written: 10

Output:
  D:\Projects\Traject\data\processed\telegram\telegram_messages.parquet

Quality Report:
  D:\Projects\Traject\data\processed\telegram\telegram_messages.quality.json
```




