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
pip install pydantic telethon pytest pytest-asyncio
```

### Running Tests
Execute the unit test suite across schemas, normalizers, and the collector:

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

