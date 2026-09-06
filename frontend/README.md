# TESSERA — Professional Social Intelligence & Monitoring Platform

A mature, responsive, production-ready social intelligence and monitoring platform engineered for daily analytical operations across Telegram and X (Twitter) message streams.

---

## 1. Product Overview

Tessera is built for analysts, researchers, and operational monitoring teams to detect emerging signals, understand narrative evolutions, analyze behavioral community clusters, trace diffusion pathways across platforms, and investigate threshold alerts with corroborating evidence and grounded foresight.

### Operational Intelligence Pipeline
$$\text{MONITOR} \longrightarrow \text{NOTICE} \longrightarrow \text{INVESTIGATE} \longrightarrow \text{UNDERSTAND} \longrightarrow \text{VERIFY} \longrightarrow \text{ACT}$$

1. **Overview (`/overview`)**: System health, priority attention metrics, 24h telemetry volume, and audit log.
2. **Signals (`/signals`, `/signals/:id`)**: Statistical and lexical anomaly surveillance workspace with multi-attribute filtering and priority indicators.
3. **Topics (`/topics`, `/topics/:id`)**: Subject clustering, 6h/24h/7d volume curves, sentiment shifts, and multilingual distribution.
4. **Narratives (`/narratives`, `/narratives/:id`)**: Tracking evolving claim framings, Then vs Now comparisons, chronological lifecycle stages, and stepwise framing mutations.
5. **Communities (`/communities`, `/communities/:id`)**: Discussion clusters, behavioral profiles, shared languages, platform shares, and topic/narrative participation.
6. **Propagation (`/propagation`)**: Diffusion pathway flow diagrams, chronological multi-hop timelines, platform migration progression, and community-to-community transmission relays.
7. **Alerts (`/alerts`)**: Operational inbox managing threshold breaches with strict state lifecycle: `NEW` → `ACKNOWLEDGED` → `UNDER REVIEW` → `RESOLVED`.
8. **Investigation (`/investigation/:id`)**: Central analytical workbench (Situation summary, What Changed delta, Analysis Chain, Evidence attribution, Propagation pathway, Foresight projections, and Analyst Working Notes).
9. **Data Explorer (`/explorer`)**: Structured query workspace over raw ingested observations across Telegram and X with multi-attribute filtering, server-style pagination, observation detail modal, URL search synchronization, and structured CSV/JSON exports.
10. **Settings & Data Sources (`/settings`)**: Live telemetry health for Telegram MTProto collector pools and X Enterprise streams.

---

## 2. SIH Demonstration Journey

For evaluation and demonstration purposes, execute this exact coherent intelligence story:

1. **Overview (`/overview`)**:
   - Notice the elevated attention count and anomalous volume peak around 18:40 UTC.
2. **Signal Surveillance (`/signals`)**:
   - Inspect high-priority signal: *"Sudden increase in discussion around regional power cuts"* (`+27%`).
3. **Topic Deep-Dive (`/topics/top-101`)**:
   - Examine *"Regional power supply disruption"*: previous baseline (1,240 mentions) vs current (1,575 mentions), negative sentiment shift (`+8%`), and Hindi/Hinglish language surge.
4. **Narrative Lineage (`/narratives/nar-201`)**:
   - Track framing shift: *"Then"* (localized service disruption) vs *"Now"* (substation infrastructure neglect).
   - Inspect chronological milestones and stepwise mutations table.
5. **Community Clustering (`/communities/com-301`)**:
   - Review *Northern District Residents Network* (3,840 posts, high cohesion, 60% Telegram / 40% X).
6. **Propagation Pathway (`/propagation`)**:
   - Trace diffusion flow: X Commuters → Resident Community → Infrastructure Watchers → Infrastructure Failure Narrative → Telegram Channels.
7. **Alert Operational Inbox (`/alerts`)**:
   - Review alert `ALT-601`, transition state from *New* → *Under Review*, and jump directly into the investigation dossier.
8. **Central Investigation Dossier (`/investigation/alt-601`)**:
   - Review the *Situation Picture*, *What Changed* volume delta, and *Stepwise Analysis Chain*.
   - Inspect *Supporting Evidence* captures with status tags (`Observed`, `Corroborated`).
   - Review *Foresight Scenarios*, progression timeline (`Now` to `Next 48h`), and historical comparison against the July 14 substation outage.
   - Add a working analyst hypothesis note (persists in `localStorage`).
   - Export analyst brief (`CSV`, `JSON`).
9. **Data Explorer (`/explorer`)**:
   - Filter by keyword `"power"`, inspect raw message payloads, view engagement stats, and export query results.

---

## 3. Technology Stack & Design System

- **Core Framework**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS with custom theme tokens; 100% compliant with professional monitoring software standards (zero AI chatbot tropes, zero purple neon, zero glassmorphism, zero fake confidence percentages).
- **Typography**:
  - `IBM Plex Sans`: Primary UI and analytical body text.
  - `IBM Plex Mono`: Technical identifiers, timestamps, metrics, and data values.
  - `IBM Plex Serif`: Editorial payload quotes and verbatim message excerpts.
- **Palette**:
  - Background: `#0E1420`
  - Surface: `#161E2C`
  - Elevated: `#1E2839`
  - Border: `#2A3446`
  - Primary Text: `#E8EAF0`
  - Muted Text: `#8791A3`
  - Signal (Attention): `#E0982F`
  - Data / Trace: `#3FA8A0`
  - Confirmed: `#6B9E78`
  - Critical: `#C0503E`

---

## 4. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Telemetry Gateway URL
VITE_API_BASE_URL=http://localhost:8000/api

# Offline Mock vs Live Backend toggle
VITE_USE_MOCK_DATA=true

# Telemetry polling interval (ms)
VITE_REFRESH_INTERVAL=30000

# Application mode
VITE_APP_MODE=development
```

---

## 5. Development & Production Commands

```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm.cmd install

# Start development server (http://localhost:3000)
npm.cmd run dev

# Run TypeScript check and production bundle compilation
npm.cmd run build

# Preview production build locally
npm.cmd run preview
```

---

## 6. Architecture & Service Layer

All React components communicate exclusively through dedicated services in `src/services/`. No presentation component makes raw HTTP requests or touches `localStorage` directly:

- `apiClient.ts`: Centralized HTTP client with environment switching, request cancellation (`AbortSignal`), error translation, and in-memory GET caching.
- `explorerService.ts`: Query, filter, and server-style pagination over raw observation messages.
- `searchService.ts`: Cross-category search indexing Topics, Narratives, Communities, Signals, and Investigations.
- `exportService.ts`: Structured CSV and JSON client-side blob generation.
- `watchlistService.ts`: Persistent storage for pinned intelligence entities.
- `notesService.ts`: Persistent storage for analyst working hypotheses.
- `sourcesService.ts`: Ingest stream telemetry and collector pool status.
- `systemService.ts`: Global platform health evaluation.
