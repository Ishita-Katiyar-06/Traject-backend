# TRAJECT Discord Collector

This package provides the official Discord platform collector for **TRAJECT**.

## Quick Start

### 1. Configure Environment
Set `DISCORD_BOT_TOKEN` in `.env`:
```bash
DISCORD_BOT_TOKEN=your_token_here
```

### 2. Collect Messages
Run the collector from `backend/`:
```bash
python -m app.collectors.discord.collector --channel 1546079728404930612 --limit 50
```

Raw outputs are saved to `data/raw/discord/{channel_name}_{timestamp}.jsonl`.

### 3. Replay Offline
```bash
python -m app.replay.discord_jsonl --input ../data/raw/discord
```

Full documentation is available at [`docs/DISCORD_INTEGRATION_README.md`](../../../docs/DISCORD_INTEGRATION_README.md).
