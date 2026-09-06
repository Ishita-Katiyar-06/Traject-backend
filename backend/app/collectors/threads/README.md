# TRAJECT Meta Threads Collector

This package provides the official Meta Threads platform collector for **TRAJECT**.

## Quick Start

### 1. Configure Environment
Set `THREADS_ACCESS_TOKEN` in `.env`:
```bash
THREADS_ACCESS_TOKEN=your_token_here
```

### 2. Collect Posts
Run the collector from `backend/`:
```bash
python -m app.collectors.threads.collector --limit 50
```

Raw outputs are saved to `data/raw/threads/{username}_{timestamp}.jsonl`.

### 3. Replay Offline
```bash
python -m app.replay.threads_jsonl --input ../data/raw/threads
```

Full documentation is available at [`docs/THREADS_INTEGRATION_README.md`](../../../docs/THREADS_INTEGRATION_README.md).
