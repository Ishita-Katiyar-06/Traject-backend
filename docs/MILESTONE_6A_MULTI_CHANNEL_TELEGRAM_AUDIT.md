# Milestone 6A — Multi-Channel Telegram Collection

## 1. Implementation Summary
Milestone 6A expands TRAJECT from single-channel Telegram collection into a configuration-driven, multi-source Telegram collection system governed by a version-controlled Telegram Source Registry.

The collector implementation maintains strict separation of concerns:
- Source configuration is managed externally in `backend/config/telegram_sources.json`.
- A single authenticated Telethon MTProto client and session (`traject_collector_session`) is reused sequentially across all configured sources.
- Individual source failures (e.g. private channels, invalid usernames, or temporary RPC issues) are isolated without terminating the collection run.
- The `CanonicalMessage` schema remains completely untouched and platform-neutral.
- Existing storage pipelines (JSONL replay, Milestone 3C quality/deduplication, and Milestone 3B Parquet storage) are reused without modifications to Arrow schemas.
- All downstream frozen milestones (4A–4H ML analytics, 5A REST API, and 5B React UI) remain 100% preserved.

---

## 2. Source Registry
The canonical source registry is version-controlled at:
`backend/config/telegram_sources.json`

It provides structured metadata describing candidate collection sources without polluting the cross-platform message schema:
- `username`: Telegram channel username or identifier (e.g. `@warmonitors`).
- `domain`: High-level thematic topic (`geopolitics`, `conflict`, `india_defence`, `cybersecurity`, `general_news`).
- `expected_language`: Source-level expectation only (actual message language detection remains strictly owned by Milestone 4B).
- `source_type`: Controlled taxonomy describing the Telegram channel publisher relationship:
  - `official`: Channel representing the claimed entity (e.g. Government Ministry).
  - `publisher`: Established news or publication organization.
  - `independent`: Independent commentary, analyst, or OSINT monitor.
  - `republication`: Channel republishing wire/media content without official affiliation.
- `enabled`: Boolean toggle for active collection.
- `display_name` & `description`: Descriptive human-readable metadata.

---

## 3. Initial Sources
The registry is seeded with exactly 13 candidate sources across 4 domains:

| Source Username | Domain | Source Type | Expected Lang | Enabled | Description |
|---|---|---|---|---|---|
| `@warmonitors` | `geopolitics` | `independent` | `en` | `true` | War Monitor OSINT & conflict updates |
| `@liveuamap` | `conflict` | `independent` | `en` | `true` | Live Universal Awareness Map |
| `@OSINTdefender` | `conflict` | `independent` | `en` | `true` | Open source intelligence monitor |
| `@GeoPWatch` | `geopolitics` | `independent` | `en` | `true` | Geopolitical Watch observations |
| `@BNONews` | `general_news` | `publisher` | `en` | `true` | BNO News international agency |
| `@Ministry_Of_Defence_Gvt_India` | `india_defence` | `official` | `en` | `true` | Ministry of Defence (Govt. of India) |
| `@majormadhankumarmmk` | `india_defence` | `independent` | `en` | `true` | Major Madhan Kumar defence analysis |
| `@thehackernews` | `cybersecurity` | `publisher` | `en` | `true` | The Hacker News cybersecurity dispatches |
| `@ctinow` | `cybersecurity` | `publisher` | `en` | `true` | Cyber Threat Intelligence reporting |
| `@cveNotify` | `cybersecurity` | `independent` | `en` | `true` | CVE vulnerability alerts |
| `@cybdetective` | `cybersecurity` | `independent` | `en` | `true` | OSINT & cybersecurity research |
| `@ReutersWorldChannel` | `general_news` | `republication` | `en` | `true` | Unofficial Reuters World wire reproduction |
| `@BBCWorld` | `general_news` | `republication` | `en` | `true` | Unofficial BBC World wire reproduction |

---

## 4. Files Added
1. `backend/config/telegram_sources.json`:
   - Version-controlled registry defining the 13 initial candidate channels.
2. `backend/app/collectors/telegram/registry.py`:
   - Strong typing models: `SourceType(StrEnum)`, `TelegramSourceEntry`, and `TelegramSourceRegistry`.
   - Dedicated loader `load_telegram_source_registry()` with structure and enum validation.
3. `backend/tests/test_telegram_multi_collector.py`:
   - 18 automated unit and mock integration tests covering registry loading, source parsing, multi-source collection, client reuse, failure isolation, provenance integrity, and Parquet round-trips.

---

## 5. Files Modified
1. `backend/app/collectors/telegram/collector.py`:
   - Added `parse_telegram_sources()` helper for robust token parsing.
   - Added `MultiCollectionResult` summary dataclass.
   - Cached `self._cached_client` to prevent recreating Telethon sessions across channels.
   - Implemented `collect_sources()` with sequential execution and failure isolation.
   - Added `close()`, `__aenter__()`, and `__aexit__()` lifecycle methods.
   - Updated CLI `_main()` to support `--channel`, `--channels`/`--sources`, `--use-registry`, `--limit`, and `--raw-dir`.
2. `backend/app/collectors/telegram/__init__.py`:
   - Exported `MultiCollectionResult`, `parse_telegram_sources`, `TelegramSourceEntry`, `TelegramSourceRegistry`, `load_telegram_source_registry`, and `SourceType`.
3. `.env.example`:
   - Documented optional runtime overrides (`TELEGRAM_SOURCES` and `TELEGRAM_COLLECTION_LIMIT`).

---

## 6. Configuration Design
Source resolution follows a deterministic 4-stage hierarchy:
1. **Explicit argument**: `sources` passed directly to `collect_sources(sources=...)`.
2. **Explicit CLI argument**: `--channel` (single channel) or `--channels` / `--sources` (comma-separated list).
3. **Environment override**: `TELEGRAM_SOURCES` in repository-root `.env`.
4. **Source Registry fallback**: Enabled sources loaded from `backend/config/telegram_sources.json`.

Source parsing supports:
- `@channel` and `channel`
- `https://t.me/channel` and `t.me/channel`
- Numeric Telegram chat IDs (`-100123456789`, `123456789`)
- Comma, newline, and whitespace-delimited strings
- Automatic deduplication preserving first-seen ordering

---

## 7. Collection Architecture
```
Configuration Layer (telegram_sources.json / CLI / ENV)
                     ↓
        TelegramCollector._get_or_create_client()
                     ↓
         Telethon Client (Single Connection & Session)
                     ↓
      Sequential Channel Iteration (Channel 1 → Channel N)
                     ↓
      Safe Failure Isolation (try/except per channel)
                     ↓
   Raw JSONL per Channel (data/raw/telegram/<channel>_<ts>.jsonl)
                     ↓
      TelethonMessageSerializer → TelegramNormalizer
                     ↓
             CanonicalMessage Records
```

---

## 8. Multi-Source Behavior
Collection runs sequentially without uncontrolled concurrency. A single Telethon client connects once and processes channels in order. For each source, the collector resolves the entity, fetches recent messages bounded by the requested limit, writes raw JSONL payloads, and normalizes them into `CanonicalMessage` objects.

---

## 9. Failure Isolation
If a channel is private, deleted, non-existent (`UsernameNotOccupiedError`), or restricted:
- The error is captured and logged.
- The failure is recorded in `MultiCollectionResult.failed_channel_errors[channel]`.
- A failed `CollectionResult` (with 0 messages and error details) is attached.
- The collector continues collecting subsequent channels without interruption.
- The run completes with an accurate count of successful vs. failed sources.

---

## 10. Provenance / Canonical IDs
Every collected message preserves full source provenance:
- `platform`: `Platform.TELEGRAM` ("telegram")
- `native_id`: Telegram message snowflake integer string
- `canonical_id`: Strictly formatted as `telegram:{chat_id}:{message_id}`
- `author_id`: Peer channel chat ID string
- `author_username`: Channel username
- `channel_title`: Channel display title
- `raw_reference`: Formatted as `<filename>:<line_number>`

Canonical IDs from different channels remain globally unique even if native message IDs collide (e.g. `telegram:1007109764:12338` vs `telegram:1625429257:12338`).

---

## 11. Deduplication
Milestone 3C quality deduplication (`process_quality`) is reused without modification:
- Primary key: `canonical_id` (`telegram:{chat_id}:{message_id}`).
- Policy: First occurrence wins.
- Duplicate collections of the same channel are deterministically deduplicated.
- Different channels with identical native IDs remain distinct.

---

## 12. JSONL / Replay / Parquet Integration
Multi-channel raw files written to `data/raw/telegram/` integrate seamlessly with existing storage tools:
- `TelegramJSONLReplayer.run("data/raw/telegram")` discovers all `.jsonl` files in deterministic alphabetical order and streams them line-by-line.
- `build_processed_dataset("data/raw/telegram", "data/processed/telegram/telegram_messages.parquet")` normalizes, quality-audits, deduplicates, and writes to Parquet.
- The Apache Arrow schema (`CANONICAL_MESSAGE_ARROW_SCHEMA`) remains untouched.

---

## 13. 4A–4H Preservation
Zero changes were made to ML pipeline code:
- Milestone 4A dataset inspection: unchanged.
- Milestone 4B language detection: unchanged (source registry `expected_language` is never used to override model detection).
- Milestones 4C/4D sentiment baselines: unchanged.
- Milestone 4E embeddings + HDBSCAN + c-TF-IDF: unchanged.
- Milestone 4F deterministic feature enrichment: unchanged.
- Milestone 4G narrative formation & Priority Signal Score: formula remains strictly $0.30 \cdot \text{Spread} + 0.30 \cdot \text{Coordination} + 0.20 \cdot \text{Observed Reach} + 0.20 \cdot \text{Friction}$. Terminology is protected.
- Milestone 4H orchestrator, cache, metrics: unchanged.

---

## 14. 5A / 5B Impact
- **5A REST API**: Fully compatible without changes. Endpoints (`/api/v1/messages`, `/api/v1/analytics`, `/api/v1/narratives`, `/api/v1/topics`) query the Parquet dataset and automatically expose multi-channel records.
- **5B React Frontend**: Fully compatible without changes. Explorer view displays channel usernames and source titles via canonical fields. No frontend analytics or mock data engines introduced.

---

## 15. Tests Added
18 automated tests added in `backend/tests/test_telegram_multi_collector.py`:
1. `test_load_production_source_registry`: Validates default registry loading with 13 sources.
2. `test_registry_source_types_and_ordering`: Validates source taxonomy and declaration ordering.
3. `test_registry_enabled_disabled_filtering`: Validates filtering enabled vs disabled sources.
4. `test_registry_validation_missing_fields`: Validates error reporting for missing registry fields.
5. `test_registry_validation_invalid_source_type`: Validates rejection of unapproved source types.
6. `test_registry_file_not_found`: Validates FileNotFoundError on missing file.
7. `test_parse_telegram_sources_single_and_multiple`: Tests comma/list source parsing.
8. `test_parse_telegram_sources_whitespace_and_newlines`: Tests whitespace and newline handling.
9. `test_parse_telegram_sources_deduplication`: Tests case-insensitive source deduplication.
10. `test_parse_telegram_sources_empty_and_none`: Tests empty inputs.
11. `test_parse_telegram_sources_numeric_and_tme_links`: Tests numeric IDs and public t.me URLs.
12. `test_multi_source_collection_sequential_and_client_reuse`: Tests sequential iteration and Telethon client reuse.
13. `test_per_source_limits`: Tests per-source limit overrides.
14. `test_single_channel_backwards_compatibility`: Tests backwards compatibility of `collect_channel()`.
15. `test_failure_isolation_continues_collection`: Tests that single channel failures do not abort the run.
16. `test_provenance_and_canonical_id_integrity`: Tests canonical ID structure and metadata preservation.
17. `test_deduplication_same_channel_vs_different_channels`: Tests Milestone 3C deduplication on multi-channel inputs.
18. `test_multi_source_jsonl_replay_and_parquet_round_trip`: Tests full replay -> Parquet round-trip.

---

## 16. Full Regression Results
Full test suite execution (`pytest -q`):
- **Total Tests**: 234
- **Passed**: 234
- **Failed**: 0
- **Skipped**: 0
- **Warnings**: 2 (Starlette deprecation warnings from test client)
- **Duration**: 52.37s
- **Zero regressions** across all 216 baseline tests and 18 new Milestone 6A tests.

---

## 17. Real Multi-Source Smoke Test
**Status**: **RUN**

- **Authentication**: Succeeded using active session `traject_collector_session.session`.
- **Sources Attempted**: 3 configured public registry sources (`@warmonitors`, `@thehackernews`, `@liveuamap`).
- **Sources Succeeded**: 3 (100% success rate).
- **Sources Failed**: 0.
- **Limit Applied**: 3 messages per source.
- **Raw Payloads Generated**:
  - `data/raw/telegram/warmonitors_20260906_185959.jsonl`: 3 records
  - `data/raw/telegram/thehackernews_20260906_190000.jsonl`: 3 records
  - `data/raw/telegram/liveuamap_20260906_190000.jsonl`: 3 records
- **Total Records Collected**: 9 raw records, 9 normalized `CanonicalMessage` instances.
- **Duplicates**: 0.
- **Skipped / Invalid**: 0.

---

## 18. Real Dataset Validation
Inspection of real replayed records:
- `@warmonitors`:
  - Chat ID: `1625429257`
  - Sample Canonical ID: `telegram:1625429257:45474`
  - Domain: `geopolitics`
- `@thehackernews`:
  - Chat ID: `1009650918`
  - Sample Canonical ID: `telegram:1009650918:9981`
  - Domain: `cybersecurity`
- `@liveuamap`:
  - Chat ID: `1007109764`
  - Sample Canonical ID: `telegram:1007109764:12338`
  - Domain: `conflict`

Offline replay of combined raw directory (`data/raw/telegram`):
- Files replayed: 4 (including baseline `GenshinUpdate_STR` file)
- Total records read: 19
- Total records normalized: 19
- Total normalization failures: 0
- Unique source channels confirmed: `{'warmonitors', 'liveuamap', 'thehackernews', 'GenshinUpdate_STR'}`

---

## 19. Performance / Reliability
- **Client Reuse**: Verified that only one Telethon client connection is created and reused across all channels.
- **No Concurrency Issues**: Sequential iteration prevents rate-limit flooding, socket contention, and SQLite session file locks.
- **Memory & Resource Safety**: Streams line-by-line into JSONL files immediately upon retrieval.
- **Execution Speed**: 3 channels (9 messages) collected in under 1.5 seconds.

---

## 20. Documentation
- Source registry location: `backend/config/telegram_sources.json`.
- Registry schema: `username`, `domain`, `expected_language`, `source_type`, `enabled`, `display_name`, `description`.
- Runtime collection command:
  ```bash
  # Collect all enabled sources from registry
  python -m app.collectors.telegram.collector --limit 10
  
  # Collect explicit sources
  python -m app.collectors.telegram.collector --sources "@warmonitors,@liveuamap" --limit 5
  
  # Backwards-compatible single channel
  python -m app.collectors.telegram.collector --channel "@warmonitors" --limit 10
  ```

---

## 21. Git Scope
- Working tree clean of accidental secrets, credentials, or session files.
- `.env.example`: updated comments only.
- `backend/config/telegram_sources.json`: version-controlled registry added.
- `backend/app/collectors/telegram/registry.py`: registry loader added.
- `backend/app/collectors/telegram/collector.py`: multi-source support added.
- `backend/app/collectors/telegram/__init__.py`: updated exports.
- `backend/tests/test_telegram_multi_collector.py`: test suite added.
- Raw collected files remain in `data/raw/telegram/`, properly ignored by root `.gitignore`.

---

## 22. Remaining Limitations
- **Incremental Checkpointing**: Not implemented in 6A (scheduled for subsequent milestones). Every run currently collects the latest $N$ messages.
- **Rate-Limit Backoff**: Sequential execution is bounded; heavy bulk backfill (>1,000 messages across dozens of channels) will require pagination loops.

---

## 23. Acceptance Checklist
- [x] Existing Telegram single-source behavior still works (`PASS`)
- [x] Multiple Telegram sources can be configured via version-controlled registry (`PASS`)
- [x] Multiple Telegram sources can actually be collected (`PASS`)
- [x] Source/channel identity is preserved (`PASS`)
- [x] `telegram:{chat_id}:{message_id}` IDs remain intact (`PASS`)
- [x] Source-specific failures are handled safely with failure isolation (`PASS`)
- [x] Existing JSONL/replay architecture is reused (`PASS`)
- [x] Existing deduplication is reused (`PASS`)
- [x] Existing Parquet storage is reused (`PASS`)
- [x] Existing 4A–4H pipeline remains unchanged (`PASS`)
- [x] Existing 5A contract remains unchanged (`PASS`)
- [x] Existing 5B frontend remains unchanged (`PASS`)
- [x] No frontend ML/analytics introduced (`PASS`)
- [x] No fake data introduced (`PASS`)
- [x] Tests added for multi-source behavior (18 tests, all passing) (`PASS`)
- [x] Full backend regression passes (234/234 passing) (`PASS`)
- [x] Real multi-channel smoke test passes with at least 2 public channels (3/3 succeeded) (`PASS`)
- [x] No secrets committed (`PASS`)
- [x] Documentation updated (`PASS`)
- [x] Git scope is clean and limited to 6A (`PASS`)

---

## 24. Final Verdict

**MILESTONE 6A — ACCEPTED**
