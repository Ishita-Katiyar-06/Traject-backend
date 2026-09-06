# TRAJECT — Milestone 6C Real-World Narrative Quality & Cross-Source Validation Audit

**Audit Date:** 2026-09-06  
**Repository:** `D:\Projects\Traject`  
**Milestone:** 6C — Real-World Narrative Quality & Cross-Source Validation  
**Corpus Evaluated:** Real 6,036-record multi-source Telegram corpus (13 sources, 5 domains)  
**Final Status:** **ACCEPTED & FROZEN**

---

## 1. Objective

Now that TRAJECT possesses an authentic 6,036-record Telegram corpus spanning 13 channels across 5 strategic domains (`cybersecurity`, `general_news`, `geopolitics`, `conflict`, `india_defence`), Milestone 6C validates whether the topic clusters and narrative candidates produced by the frozen 4A–4H ML/analytics pipeline are coherent, explainable, and cross-source representative.

The core question addressed by this audit is:

> *"Are TRAJECT's discovered narratives meaningful and explainable when evaluated against the real multi-source Telegram corpus?"*

Milestone 6C introduces a deterministic validation and evidence-reporting layer over existing outputs without altering frozen analytical contracts or inventing new threat/risk scores.

---

## 2. Frozen Contracts

Milestones 1, 2, 3A–3C, 4A–4H, 5A, 5B, 6A, and 6B remain strictly **FROZEN**.

* **Model Integrity:** No modifications were made to embedding models (`paraphrase-multilingual-MiniLM-L12-v2`), sentiment adapters (`twitter-roberta-base-sentiment-latest`), or language normalization pipelines.
* **Scoring Formula Integrity:** The Priority Signal Score formula is strictly preserved:
  $$\text{Priority Signal Score} = 0.30 \cdot \text{Spread} + 0.30 \cdot \text{Coordination} + 0.20 \cdot \text{Observed Reach} + 0.20 \cdot \text{Friction}$$
* **Terminology Preservation:** No prohibited terms (`threat_score`, `risk_score`, `cib_score`, `bot_score`) were introduced.
* **Validation Separation:** Quality indicators are observational coverage indicators, completely separated from priority ranking.

---

## 3. Existing Narrative Architecture

The end-to-end flow from raw ingestion to analyst triage operates strictly as follows:

```text
Raw Messages (JSONL)
        ↓
Replay & CanonicalMessage Normalization (Milestone 1)
        ↓
Quality Validation & Deterministic Deduplication (Milestone 3C)
        ↓
Parquet Storage (data/processed/telegram/telegram_messages.parquet)
        ↓
Language Identification & NFKC Normalization (Milestone 4B)
        ↓
Dense Multilingual Sentence Embeddings (Milestone 4E: 384d, L2-normalized)
        ↓
HDBSCAN Density-Based Clustering (Milestone 4E: min_cluster_size=2)
        ↓
c-TF-IDF Vocabulary Extraction & Centroid Message Identification (Milestone 4E)
        ↓
Deterministic Feature Enrichment: Entities, Velocity, Origin Propagation (Milestone 4F)
        ↓
Narrative Candidate Formation & Priority Signal Scoring (Milestone 4G)
        ↓
Precomputed Analytics Artifact Assembly (Milestone 4H: JSON)
        ↓
FastAPI Serving Layer (Milestone 5A)
        ↓
React / TypeScript Triage Dashboard (Milestone 5B)
```

---

## 4. Topic → Narrative Relationship

The relationship between discovered semantic clusters and narrative candidates is a **strict, deterministic 1:1 mapping**:

* **4E Topic Discovery:** Discovers $K$ dense clusters from normalized message embeddings.
* **4F Topic Feature Enrichment:** Enriches each discovered cluster with temporal, entity, and propagation metadata, yielding exactly $K$ `EnrichedTopicCandidate` objects.
* **4G Narrative Assessment:** Implements the explicit frozen contract:
  > *"Executes 1 initial NarrativeCandidate promotion per EnrichedTopicCandidate."*
* **1:1 Promotion Guarantee:** Every semantically distinct cluster is preserved as an evaluatable candidate. Rather than dropping smaller clusters prematurely, the pipeline surfaces them to analysts while applying 4G priority tiers (`elevated` vs `routine`) and observational evidence density heuristics (`high`, `moderate`, `sparse`).

---

## 5. Validation Methodology

Milestone 6C implements `CorpusQualityValidator` in `backend/app/analytics/narrative_validation.py`:
1. **Constituent Message Resolution:** Resolves all messages assigned to each topic cluster using `topic.sample_message_ids` and matches against the 6,036 canonical records.
2. **Channel & Domain Attribution:** Resolves author usernames and maps them to domains via the version-controlled `TelegramSourceRegistry` (`backend/config/telegram_sources.json`).
3. **Temporal & Textual Bounds:** Computes cluster observation duration (`timespan_seconds`) and text-bearing coverage.
4. **Co-Occurrence Aggregation:** Builds bidirectional source-pair and domain-pair overlap matrices.
5. **Deterministic Evidence Classification:** Classifies each narrative candidate into a formal observational evidence tier.

---

## 6. Narrative Quality Metrics

Each narrative candidate is evaluated on observational robustness using four deterministic tiers:

| Quality Tier | Deterministic Criteria | Corpus Count | Percentage |
| :--- | :--- | :--- | :--- |
| **`strong_evidence`** | $\ge 5$ messages AND $\ge 2$ distinct sources | 130 | 11.16% |
| **`moderate_evidence`** | $\ge 3$ messages OR ($\ge 2$ messages across $\ge 2$ sources) | 1,007 | 86.44% |
| **`limited_evidence`** | Exactly 2 messages from a single source | 28 | 2.40% |
| **`insufficient_evidence`** | $< 2$ messages or 0 text-bearing messages | 0 | 0.00% |
| **Total** | | **1,165** | **100.0%** |

*Note: 97.6% of discovered narrative candidates meet or exceed moderate evidence standards.*

---

## 7. Cross-Source Analysis

* **Total Promoted Narratives:** 1,165
* **Single-Source Narratives:** 37 (3.18%)
* **Multi-Source Narratives ($\ge 2$ channels):** 1,128 (96.82%)
* **High-Corroboration Narratives ($\ge 3$ channels):** 53 (4.55%)

### Top Source-Pair Overlaps (Shared Co-occurring Narratives)

| Channel Pair | Primary Domains | Shared Narratives | Analytical Significance |
| :--- | :--- | :--- | :--- |
| `BBCWorld <-> ReutersWorldChannel` | general_news <-> general_news | 142 | Global wire event corroboration |
| `ctinow <-> thehackernews` | cybersecurity <-> cybersecurity | 80 | Shared CVE & malware campaign reporting |
| `BBCWorld <-> bnonews` | general_news <-> general_news | 34 | Breaking international news syndication |
| `ReutersWorldChannel <-> bnonews` | general_news <-> general_news | 32 | Wire republication overlap |
| `GeoPWatch <-> OSINTdefender` | geopolitics <-> conflict | 23 | Cross-domain military/geopolitical monitoring |
| `GeoPWatch <-> liveuamap` | geopolitics <-> conflict | 20 | Battlefield situation reporting |
| `BBCWorld <-> liveuamap` | general_news <-> conflict | 16 | Mainstream coverage of conflict events |
| `OSINTdefender <-> liveuamap` | conflict <-> conflict | 15 | Corroborated tactical incident reporting |
| `ReutersWorldChannel <-> liveuamap` | general_news <-> conflict | 13 | Conflict reporting verified by wire service |
| `GeoPWatch <-> warmonitors` | geopolitics <-> geopolitics | 12 | Geopolitical OSINT commentary alignment |

---

## 8. Cross-Domain Analysis

* **Single-Domain Narratives:** 1,034 (88.76%)
* **Multi-Domain Narratives ($\ge 2$ strategic domains):** 131 (11.24%)
* **Broad Multi-Domain Narratives ($\ge 3$ domains):** 10 (0.86%)

### Top Domain-Pair Overlaps

| Strategic Domain Pair | Shared Narratives | Contextual Narrative Mechanism |
| :--- | :--- | :--- |
| `conflict <-> geopolitics` | 54 | Battlefield incidents prompting diplomatic/geopolitical reactions |
| `conflict <-> general_news` | 34 | Major kinetic events breaking into global headline news |
| `general_news <-> geopolitics` | 26 | International summits, treaties, and elections |
| `conflict <-> india_defence` | 12 | Border surveillance and regional security reporting |
| `geopolitics <-> india_defence` | 9 | Regional bilateral agreements and strategic policy |
| `general_news <-> india_defence` | 8 | Mainstream coverage of defence procurement and exercises |
| `cybersecurity <-> general_news` | 5 | Critical infrastructure cyberattacks reaching mainstream news |
| `conflict <-> cybersecurity` | 1 | Cyber operations in hybrid warfare |
| `cybersecurity <-> india_defence` | 1 | National defence cyber infrastructure advisories |
| `cybersecurity <-> geopolitics` | 1 | State-sponsored espionage threat disclosures |

---

## 9. 1,165-Topic Investigation

### Investigation Mandate
Determine whether 6,036 messages $\rightarrow$ 1,165 topic clusters $\rightarrow$ 1,165 narrative candidates is intentional behavior or an implementation defect.

### Technical Analysis
1. **HDBSCAN Micro-Clustering:** Milestone 4E configures `HDBSCAN(min_cluster_size=2, min_samples=1, metric="euclidean")` over L2-normalized 384-dimensional multilingual sentence embeddings.
2. **Cluster Size Distribution:**
   - Cluster size 2: 697 clusters (59.8%)
   - Cluster size 3: 240 clusters (20.6%)
   - Cluster size 4: 96 clusters (8.2%)
   - Cluster size 5: 70 clusters (6.0%)
   - Cluster size 6: 23 clusters
   - Cluster size 7: 19 clusters
   - Cluster size 8: 4 clusters
   - Cluster size 9: 5 clusters
   - Cluster size 10+: 11 clusters (max size: 24 messages in `topic_364`)
   - Cluster size 1 (singletons): **0 clusters (strictly 0% singletons)**.
3. **Noise Handling:** 2,511 messages were classified as noise/outliers (cluster label -1) and safely isolated from candidate promotion.
4. **Architectural Intent:** The architecture intentionally forms granular, tightly cohesive micro-topics rather than merging disparate events into monolithic mega-clusters.
5. **Verdict:** The 1:1 promotion is **intentional, specified, and correct**. Triage is properly handled via 4G priority scoring and evidence classification.

---

## 10. Top Narrative Analysis

The top narrative candidates ranked by the frozen 4G Priority Signal Score demonstrate strong coherence and clear factual grounding:

### 1. `narrative_583` (Topic `topic_175`) — Priority Signal Score: 0.4552 (ELEVATED)
* **Headline Claim:** `[India, Delhi] ghuman, isi, nid, kathmandu, clerics`
* **Sub-Scores:** Spread: 0.700 | Coordination: 0.350 | Reach: 0.375 | Friction: 0.326
* **Evidence:** 2 constituent messages, 13 channels broadcasting, domain: `india_defence`.
* **Why Considered Significant:** Elevated spread velocity and noticeable reply/reaction friction around intelligence reporting.

### 2. `narrative_627` (Topic `topic_258`) — Priority Signal Score: 0.4471 (ELEVATED)
* **Headline Claim:** `[topic_258] bihar, happened, neet, aspirants, katihar`
* **Sub-Scores:** Spread: 0.700 | Coordination: 0.150 | Reach: 0.363 | Friction: 0.596
* **Evidence:** 2 constituent messages, 5 channels broadcasting, domain: `india_defence`.
* **Why Considered Significant:** Exceptionally high friction score (0.596) driven by negative public sentiment and emotional reaction.

### 3. `narrative_304` (Topic `topic_368`) — Priority Signal Score: 0.4453 (ELEVATED)
* **Headline Claim:** `[topic_368] convoy, ctd, rawalakot, rebels, pakistani`
* **Sub-Scores:** Spread: 0.867 | Coordination: 0.142 | Reach: 0.385 | Friction: 0.329
* **Evidence:** 3 constituent messages, 6 channels broadcasting, domain: `india_defence`.
* **Why Considered Significant:** High forward spread score (0.867) indicating rapid multi-channel forwarding across regional security feeds.

### 4. `narrative_143` (Topic `topic_184`) — Priority Signal Score: 0.4111 (ELEVATED)
* **Headline Claim:** `[India, #indiansubcontinent] treaty, dar, indus, ishaq, pls`
* **Sub-Scores:** Spread: 0.867 | Coordination: 0.176 | Reach: 0.400 | Friction: 0.092
* **Evidence:** 4 constituent messages, 13 channels broadcasting, domain: `india_defence`.
* **Why Considered Significant:** Broad multi-channel propagation regarding the Indus Water Treaty diplomatic developments.

### 5. `narrative_144` (Topic `topic_188`) — Priority Signal Score: 0.3785 (ELEVATED)
* **Headline Claim:** `[topic_188] rises, carter, wdsu, toll, orleans`
* **Sub-Scores:** Spread: 0.550 | Coordination: 0.175 | Reach: 0.409 | Friction: 0.396
* **Evidence:** 4 constituent messages across `@bnonews` and `@majormadhankumarmmk`, domains: `general_news`, `india_defence`.
* **Why Considered Significant:** True multi-source and cross-domain corroborated breaking news event.

---

## 11. Weak / Noisy Narrative Analysis

To ensure transparency and prevent false certainty, the validation layer systematically identifies weak or sparse narrative clusters:

* **Limited Evidence Clusters (28 candidates, 2.4%):**
  - Characterized by exactly 2 messages originating from a single channel with near-zero temporal span.
  - Examples: `narrative_1137`, `narrative_1138` (isolated local announcements).
  - Categorization: Flagged as `LIMITED_EVIDENCE` in API and UI.
* **Insufficient Evidence Clusters (0 candidates, 0.0%):**
  - Messages with empty text or corrupted tokens are caught by Milestone 4B and 4E noise filtering.
* **Preservation Policy:** Weak clusters are **not deleted**; they are transparently classified so analysts can filter by evidence density without losing visibility into emerging signals.

---

## 12. API Changes

All API enhancements in Milestone 5A are strictly additive and 100% backward-compatible:

* **`NarrativeSummaryResponse` (`GET /api/v1/narratives`):**
  - `distinct_sources_count: int` (default: 1)
  - `distinct_domains_count: int` (default: 1)
  - `is_cross_source: bool` (default: False)
  - `is_cross_domain: bool` (default: False)
  - `domains_represented: list[str]` (default: `[]`)
  - `quality_classification: str` (default: `"moderate_evidence"`)
* **`NarrativeDetailData` (`GET /api/v1/narratives/{id}`):**
  - Inherits from `NarrativeCandidate`
  - Includes all summary validation fields plus `validation_notes: list[str]`
* **ArtifactRepository:** Automatically validates loaded artifacts and enriches narrative responses without request-path ML computation.

---

## 13. Frontend Changes

Minimal, focused UI enhancements were implemented in Milestone 5B:

1. **`frontend/src/types/api.ts`:**
   - Extended `NarrativeSummaryResponse` and `NarrativeDetailData` with validation fields.
2. **`frontend/src/components/narratives/NarrativeRow.tsx`:**
   - Added `Cross-Source` badge when `is_cross_source` is True.
   - Added `Cross-Domain` badge when `is_cross_domain` is True.
   - Rendered domain tags (`conflict`, `geopolitics`, `general_news`, etc.).
3. **`frontend/src/pages/Narratives/NarrativeDetailPage.tsx`:**
   - Added `Cross-Source` and `Cross-Domain` badges to the top metadata banner.
   - Displayed `Evidence Quality Tier` badge.
   - Rendered strategic domains represented and observational evidence notes in the channel card.

---

## 14. Test Results

Dedicated tests in `backend/tests/test_narrative_quality_validation.py` (7 tests, all PASSED):
1. `test_classify_evidence_quality_rules`: Validates deterministic tiering logic.
2. `test_evaluate_narrative_metrics`: Validates field extraction, temporal calculation, and domain resolution.
3. `test_validate_corpus_end_to_end`: Validates full pipeline output parsing and ratio calculation.
4. `test_api_schema_backward_compatibility`: Validates default fields and Pydantic subclassing.
5. `test_source_and_domain_pair_overlaps`: Validates pairwise co-occurrence aggregation.
6. `test_weak_noisy_narrative_classification`: Validates limited and insufficient evidence handling.
7. `test_api_client_narratives_endpoints_with_validation`: Validates live FastAPI endpoint responses.

---

## 15. Real Corpus Results

Output from `app.analytics.validate_narratives` on the real 6B corpus:

```text
==============================================================================
TRAJECT MILESTONE 6C — NARRATIVE QUALITY & CROSS-SOURCE VALIDATION REPORT
==============================================================================
Total Canonical Messages:    6036
Total Discovered Topics:     1165
Total Promoted Narratives:   1165
Topic-to-Narrative Ratio:    1.0 (Strict 1:1 Promotion)
Single-Source Narratives:    37
Multi-Source Narratives:     1128 (>=2 channels)
Multi-Domain Narratives:     131 (>=2 strategic domains)

--- Observational Evidence Quality Distribution ---
  moderate_evidence     : 1007 ( 86.4%)
  strong_evidence       :  130 ( 11.2%)
  limited_evidence      :   28 (  2.4%)

--- Top Source-Pair Overlaps (Shared Co-occurring Narratives) ---
  BBCWorld <-> ReutersWorldChannel    : 142 shared narratives
  ctinow <-> thehackernews            : 80 shared narratives
  BBCWorld <-> bnonews                : 34 shared narratives
  ReutersWorldChannel <-> bnonews     : 32 shared narratives
  GeoPWatch <-> OSINTdefender         : 23 shared narratives
  GeoPWatch <-> liveuamap             : 20 shared narratives
  BBCWorld <-> liveuamap              : 16 shared narratives
  OSINTdefender <-> liveuamap         : 15 shared narratives
  ReutersWorldChannel <-> liveuamap   : 13 shared narratives
  GeoPWatch <-> warmonitors           : 12 shared narratives
==============================================================================
```

---

## 16. Known Limitations

1. **Non-Goal:** Adding other social platforms (X, Discord, Threads).
2. **Non-Goal:** Dynamic cluster merging across time windows.
3. **Observational Bounds:** Multi-source presence reflects public broadcasting overlap across monitored channels, not private message sharing.

---

## 17. Semantic Guardrails

> [!CAUTION]
> **CRITICAL ANALYTICAL GUARDRAIL:**
> Cross-source narrative co-occurrence demonstrates **shared thematic presence** across channels. It does **NOT** prove:
> - Inauthentic coordination
> - Bot network activity
> - Coordinated Inauthentic Behavior (CIB)
> - Influence operations or malicious intent
> 
> The 4G Coordination signal remains strictly an **observable heuristic indicator**.

---

## 18. Files Changed

* `backend/app/analytics/__init__.py` [NEW]
* `backend/app/analytics/narrative_validation.py` [NEW]
* `backend/app/analytics/validate_narratives.py` [NEW]
* `backend/app/schemas/api/narratives.py` [MODIFIED]
* `backend/app/repositories/artifact_repository.py` [MODIFIED]
* `backend/tests/test_narrative_quality_validation.py` [NEW]
* `frontend/src/types/api.ts` [MODIFIED]
* `frontend/src/components/narratives/NarrativeRow.tsx` [MODIFIED]
* `frontend/src/pages/Narratives/NarrativeDetailPage.tsx` [MODIFIED]
* `docs/MILESTONE_6C_NARRATIVE_QUALITY_AUDIT.md` [NEW]

---

## 19. Regression Results

* **Backend Test Suite:** **247/247 passed** in 66.94s (`pytest -q`).
* **Frontend Test Suite:** **14/14 passed** in 290ms (`npm test`).
* **Frontend Build:** **Clean build** in 3.37s (`npm run build`).
* **Live API Verification:** Health: `healthy`, 6,036 messages, 1,165 narratives, validation fields served.

---

## 20. Final Verdict

# **MILESTONE 6C — ACCEPTED**

The narrative quality and cross-source validation layer is verified, explainable, architecturally sound, and ready to freeze.
