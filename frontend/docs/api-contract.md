# Tessera Backend API Integration Contract

Version: `1.0.0`  
Protocol: `REST / HTTPS (JSON)`  
Base URL: `/api` (configured via `VITE_API_BASE_URL`)

---

## 1. Global Standards & Error Envelope

All endpoints return standard HTTP status codes. On error (4xx/5xx), the response body must conform to:

```json
{
  "status": 404,
  "message": "The requested intelligence record or entity could not be found.",
  "detail": "Topic ID 'top-999' not indexed in cluster.",
  "timestamp": "2026-09-02T19:30:00Z",
  "path": "/api/topics/top-999"
}
```

### Standard HTTP Status Codes:
- `200 OK`: Successful retrieval or modification.
- `201 Created`: Entity successfully persisted.
- `204 No Content`: Action executed without payload return.
- `400 Bad Request`: Validation failure on filter parameters.
- `401 Unauthorized`: Session expired / credentials missing.
- `403 Forbidden`: Insufficient analyst role privileges.
- `404 Not Found`: Entity not found.
- `429 Too Many Requests`: Rate limits exceeded on collector gateway.
- `500 / 502 / 503 Server Error`: Upstream telemetry collector or cluster down.

---

## 2. Core Endpoints

### 2.1 Signals (`/api/signals`)
- `GET /api/signals`:
  - **Query Params**: `priority` (High/Medium/Low), `status` (Active/Investigating/Resolved), `platform` (X/Telegram), `limit`, `offset`.
  - **Response**: Array of `SignalItem` records.
- `GET /api/signals/:id`:
  - **Response**: Detailed `SignalItem` with 24h telemetry series.

### 2.2 Topics (`/api/topics`)
- `GET /api/topics`:
  - **Query Params**: `platform` (X/Telegram), `language` (Hindi/Hinglish/English), `activity` (High/Moderate/Low), `trend` (Rising/Stable/Declining), `q` (search string), `sortBy` (activity/change/recent/name).
  - **Response**: Array of `TopicDetail` records.
- `GET /api/topics/:id`:
  - **Response**: Full `TopicDetail` entity including activity timeline series, sentiment breakdowns, and moments timeline.

### 2.3 Narratives (`/api/narratives`)
- `GET /api/narratives`:
  - **Query Params**: `status` (Emerging/Developing/Persistent/Cooling/Archived), `trend`, `platform`, `language`, `q`.
  - **Response**: Array of `NarrativeDetail` records.
- `GET /api/narratives/:id`:
  - **Response**: Complete `NarrativeDetail` including Then vs Now framing comparison, chronological lifecycle stages, and stepwise mutations.

### 2.4 Communities (`/api/communities`)
- `GET /api/communities`:
  - **Query Params**: `platform`, `language`, `activity`, `trend`, `q`.
  - **Response**: Array of `CommunityDetail` clusters.
- `GET /api/communities/:id`:
  - **Response**: `CommunityDetail` with associated topics, narratives, and related peer clusters.

### 2.5 Propagation (`/api/propagation`)
- `GET /api/propagation/events`:
  - **Query Params**: `topicId`, `narrativeId`, `platform`, `strength` (Observed/Likely/Unclear), `from`, `to`.
  - **Response**: Array of `PropagationEvent` multi-hop transmissions.
- `GET /api/propagation/flow`:
  - **Response**: Array of `PropagationFlowStep` items tracing cross-platform diffusion pathways.
- `GET /api/propagation/migration`:
  - **Response**: `PlatformMigrationSummary` (share progression X vs Telegram).

### 2.6 Alerts (`/api/alerts`)
- `GET /api/alerts`:
  - **Query Params**: `status` (New/Acknowledged/Under review/Resolved), `priority` (High/Medium/Low), `platform`, `q`.
  - **Response**: Array of `Alert` items.
- `PATCH /api/alerts/:id/status`:
  - **Body**: `{ "status": "Acknowledged" | "Under review" | "Resolved" }`
  - **Response**: Updated `Alert` record.

### 2.7 Investigations (`/api/investigations`)
- `GET /api/investigations/:id`:
  - **Response**: Complete `InvestigationDetail` (Situation summary, What Changed delta, Analysis Chain, Evidence summary, Notes).
- `PATCH /api/investigations/:id/status`:
  - **Body**: `{ "status": "Under review" | "Resolved" }`
  - **Response**: Updated `InvestigationDetail`.
- `POST /api/investigations/:id/notes`:
  - **Body**: `{ "content": string, "author": string }`
  - **Response**: Created `AnalystNote`.
- `DELETE /api/investigations/:id/notes/:noteId`:
  - **Response**: `204 No Content`.

### 2.8 Data Explorer (`/api/explorer`)
- `GET /api/explorer`:
  - **Query Params**: `q`, `platform`, `language`, `contentType`, `topicId`, `sentiment`, `from`, `to`, `page`, `pageSize`.
  - **Response**:
    ```json
    {
      "items": [ ...RawObservation... ],
      "total": 1420,
      "page": 1,
      "pageSize": 20,
      "totalPages": 71
    }
    ```

### 2.9 Search (`/api/search`)
- `GET /api/search`:
  - **Query Params**: `q` (query string).
  - **Response**: Array of `SearchResultItem` records categorized into Topics, Narratives, Communities, Signals, and Investigations.

### 2.10 Sources (`/api/sources`)
- `GET /api/sources`:
  - **Response**: Array of `DataSourceItem` records with connection status, message velocity, latency, and data availability.
