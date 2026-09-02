# TRAJECT

> **Production Social Media Analytics & Narrative Intelligence Platform**  
> Developed for **Smart India Hackathon (SIH) 2026** — **Problem Statement 26152 (NTRO)**

---

## 1. Project Overview

**TRAJECT** is a social media analytics and narrative intelligence platform designed to ingest, normalize, and analyze public information cascades across multi-platform communications networks.

The platform addresses **SIH 2026 Problem Statement 26152 (National Technical Research Organisation - NTRO)**, focusing on multi-source social stream processing, narrative tracking, and explainable network intelligence.

### Scope & Capabilities

| Horizon | Capabilities |
| :--- | :--- |
| **Current Implementation** | • Python backend foundation (`backend/app/`)<br>• Core `CanonicalMessage` schema (Pydantic v2) with strict UTC timestamp enforcement and controlled platform/author types<br>• Chat-scoped deterministic Telegram canonical ID generation (`telegram:{chat_id}:{message_id}`)<br>• Telegram message normalizer (`TelegramNormalizer`) handling plain text, captions, forwards, replies, reactions, and entity extraction<br>• MTProto collector (`Telethon`) supporting interactive terminal authentication and cloud 2FA<br>• Deterministic root `.env` discovery with operating system environment precedence<br>• Session lifecycle and `AuthKeyUnregisteredError` recovery<br>• Appendable, immutable raw JSONL storage (`data/raw/telegram/`)<br>• 35 passing unit tests using mocked clients (zero network calls during test runs)<br>• Successful real-world smoke test against public Telegram channel (`@GenshinUpdate_STR`) |
| **Planned / Future Scope** | • Continuous timeline and streaming ingestion<br>• Durable columnar Parquet analytical datasets and offline replay pipeline (Milestone 3)<br>• **X (Twitter)** ingestion collector (Essential)<br>• **Instagram** and **Facebook** collectors (Desirable)<br>• **Reddit** and **YouTube** collectors (Appreciable additional sources)<br>• Sentiment, stance, and emotion classification<br>• Real-time topic, narrative genesis, and mutation tracking<br>• Information cascade topology, link analysis, and influence propagation graphs<br>• Aggregate and anonymized demographic profiling<br>• FastAPI backend service layer and Next.js / Vite analyst dashboard |

> [!NOTE]
> Capabilities marked as **Planned / Future Scope** are not yet implemented. The project is being constructed strictly incrementally from verified data contracts upward.

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
│           SHARED ML & ANALYTICS (PLANNED)              │
│   Sentiment, Framing, Narrative Genesis, Cascade Graph │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│              PROCESSED DATASETS (PLANNED)              │
│   data/processed/ (Partitioned Apache Parquet)         │
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
│   │   └── schemas/
│   │       └── canonical_message.py  # Unified CanonicalMessage contract
│   ├── tests/                    # 35 mocked unit tests
│   │   ├── test_config.py
│   │   ├── test_schemas.py
│   │   ├── test_telegram_collector.py
│   │   └── test_telegram_normalizer.py
│   ├── .venv/                    # Local virtual environment (gitignored)
│   ├── pyproject.toml            # Backend dependencies and pytest config
│   └── README.md                 # Backend-specific developer notes
├── data/
│   └── raw/
│       └── telegram/             # Ingested raw JSONL files (gitignored)
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

### Test Coverage (35 Passing Tests)
* **Configuration & Precedence (`test_config.py`)**: Deterministic repository root discovery; strict OS environment variable precedence over `.env`.
* **Canonical Schema Validation (`test_schemas.py`)**: Valid model creation, strict rejection of unsupported platforms (`Platform` enum), rejection of missing required fields, strict UTC timestamp enforcement and conversion, stable canonical ID format validation, rejection of negative engagement metrics, and extra field forbidding.
* **Telegram Serialization (`test_telegram_collector.py`)**: Primitive dictionary conversion, signed 64-bit chat ID and peer ID extraction, message ID extraction, media type detection, forward origin headers, reply/thread headers, reaction maps, entity spans, and malformed payload handling.
* **Authentication & Session Lifecycle (`test_telegram_collector.py`)**: Already-authorized session bypass, interactive first-time login with 2FA password handling, `AuthKeyUnregisteredError` clean recovery instructions, authentication failure handling, and credential secret masking.
* **Telegram Normalization (`test_telegram_normalizer.py`)**: Broadcast text messages, media captions, forwarded messages, comments/replies, multi-script unicode preservation (e.g. Hindi scripts and emojis), missing optional fields, and cross-channel ID differentiation.
* **End-to-End Mocked Collector Pipeline (`test_telegram_collector.py`)**: Mock Telethon message $\to$ primitive serializer $\to$ raw JSONL on disk $\to$ `TelegramNormalizer` $\to$ `CanonicalMessage`.

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
- [x] 35 offline unit tests covering configuration, schemas, serialization, and collectors
- [x] Live real-world Telegram smoke test against public broadcast channel (`@GenshinUpdate_STR`)

### Next Milestones
- [ ] Raw JSONL replay and validation pipeline
- [ ] Durable analytical Parquet storage (`data/processed/telegram/`)
- [ ] Incremental collection and message deduplication
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
