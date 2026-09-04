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

---

## 8. ML Dataset Foundation & Baseline Inspection (Milestone 4A)

The machine learning foundation layer (`app.ml`) bridges processed Parquet datasets with downstream NLP, sentiment, narrative, and graph intelligence models.

### Key Architectural Invariants
1. **Parquet Input Boundary**: Processed Parquet (`data/processed/`) serves as the strict, single input boundary for all ML tasks. ML modules never read raw JSONL directly or bypass the canonical contract.
2. **Canonical Contract Integrity**: `CanonicalMessage` remains the source-of-truth domain model. ML-specific preparation (`MLTextRecord`) extracts lightweight text features without altering storage schemas.
3. **Media-Only Filtering**: Messages with `has_media=True` and empty text (`text_content=""`) remain fully valid in storage, but are systematically excluded from text-model datasets. This is an ML filtering decision, not a data-quality rejection.
4. **Missing Language Transparency**: Unlabeled or missing language tags are reported as `"unknown"` for analytics without mutating the underlying canonical records.
5. **Deterministic Statistics**: Baseline inspection computes exact character and whitespace-tokenized word distributions (min, max, mean, median) with division-by-zero protection.
6. **No Premature Model Training**: Zero heavy ML frameworks (PyTorch, Transformers, scikit-learn) are introduced in this milestone. The focus is strictly on empirical dataset inspection prior to model selection.

### Inspection CLI Execution

```powershell
# Run baseline inspection and output a companion JSON report:
python -m app.ml.inspection `
    --input ..\data\processed\telegram\telegram_messages.parquet `
    --output ..\data\processed\telegram\telegram_messages.ml-inspection.json `
    --overwrite
```

Console summary output:
```text
TRAJECT ML Dataset Inspection

Dataset:
  D:\Projects\Traject\data\processed\telegram\telegram_messages.parquet

Records:
  Total: 10
  Text-bearing: 9 (90.0%)
  Media-only: 1 (10.0%)
  Empty-body: 0

Languages:
  unknown: 10 (100.0%)

Text:
  Character count:
    Min: 77
    Max: 338
    Mean: 173.56
    Median: 167.0

  Word count:
    Min: 11
    Max: 62
    Mean: 28.67
    Median: 26.0

Content:
  URLs: 0 (0.0%)
  Hashtags: 7 (70.0%)
  Mentions: 0 (0.0%)
  Forwards/Reposts: 0 (0.0%)
  Media: 5 (50.0%)

Inspection JSON report saved:
  D:\Projects\Traject\data\processed\telegram\telegram_messages.ml-inspection.json
```

---

## 9. Language Identification & Text Normalization (Milestone 4B)

The language identification and text normalization pipeline (`app.ml.language` and `app.ml.normalization`) establishes an ML-derived analytical layer over text-bearing canonical records without altering underlying storage contracts.

### Architectural Invariants
1. **Canonical Schema Separation**: `CanonicalMessage.text_content` and `CanonicalMessage.language` remain the immutable source of truth in Parquet storage. Language identification is strictly an **analytical inference** and not guaranteed ground truth.
2. **Derived Record Contract**: Processed text is encapsulated in `LanguageAwareMLTextRecord`, containing both `original_text` and `normalized_text`, plus `detected_language` and `language_confidence`.
3. **Deterministic Offline Classifier**: Uses `langdetect` (v1.0.9) pinned with `DetectorFactory.seed = 0`. Operates 100% offline with zero GPU dependencies and zero large model weights.
4. **Conservative Unknown Policy**:
   * Text shorter than 10 characters or blank strings evaluate to `language="unknown"`, `confidence=0.0`.
   * Predictions with confidence $< 0.70$ fall back to `language="unknown"`.
   * Unparseable character streams default to `"unknown"` without raising unhandled exceptions.
5. **Safe Normalization Rules**:
   * **Applied**: Unicode NFC normalization, line-break conversion (`\r\n` $\to$ `\n`, compress $\ge 3$ newlines to 2), horizontal whitespace compaction (tabs/multiple spaces $\to$ single space), outer whitespace strip.
   * **Deliberately NOT Performed**: No stripping of `#hashtags`, `@mentions`, `http(s)://` URLs, or emojis. No lowercasing, stemming, lemmatization, translation, or punctuation stripping. Social signals remain intact for downstream NLP.

### CLI Execution & Audit Report

```powershell
# Run language inspection and generate a companion JSON report:
python -m app.ml.language `
    --input ..\data\processed\telegram\telegram_messages.parquet `
    --output ..\data\processed\telegram\telegram_messages.language-inspection.json `
    --overwrite
```

Console summary output:
```text
TRAJECT ML Language Inspection

Dataset:
  D:\Projects\Traject\data\processed\telegram\telegram_messages.parquet

Text-bearing records: 9 (of 10 total)
Media-only records: 1

Languages:
  en: 9 (100.0%)

Unknown: 0 (0.0%)

Confidence:
  Min: 1.0
  Max: 1.0
  Mean: 1.0
  Median: 1.0

Normalization:
  Records processed: 9
  Records changed: 3

Language inspection JSON report saved:
  D:\Projects\Traject\data\processed\telegram\telegram_messages.language-inspection.json
```

---

## 10. Pretrained Sentiment Baseline Evaluation (Milestone 4C)

The sentiment evaluation pipeline (`app.ml.sentiment`) evaluates off-the-shelf pretrained social-media sentiment models against an empirical, manually authored benchmark before determining whether production fine-tuning is necessary.

### Architectural Invariants & Philosophy
1. **Empirical Evaluation Before Fine-Tuning**: Fine-tuning or deploying unvalidated models introduces hidden regressions and computational waste. Off-the-shelf pretrained representations must first be tested against controlled, domain-specific edge cases.
2. **Strict Evaluation Isolation**: No models are trained, fine-tuned, or indexed into vector databases during this milestone.
3. **Storage Immutability**: Parquet datasets and raw JSONL files remain completely untouched. Sentiment predictions are persisted strictly as derived analytical companion artifacts (`telegram_messages.sentiment-baseline.jsonl`).
4. **Pure-Python Metrics**: Classification metrics (Accuracy, Precision, Recall, Per-class F1, Macro F1, Confusion Matrix) are implemented with zero `scikit-learn` dependencies.

### Candidate Models Investigated
* **`cardiffnlp/twitter-roberta-base-sentiment-latest`** (RoBERTa-base, ~501MB, MIT License): Trained on ~124M tweets (2018–2021) and fine-tuned on TweetEval sentiment.
* **`cardiffnlp/twitter-xlm-roberta-base-sentiment`** (XLM-RoBERTa-base, ~1.1GB, MIT License): Multilingual social-media variant covering 30+ languages.
* **`lxyuan/distilbert-base-multilingual-cased-sentiments-student`** (DistilBERT, ~541MB, Apache 2.0 License): Multilingual student model distilled for resource-constrained deployments.

### Manual Pilot Benchmark Dataset (`tests/fixtures/sentiment/manual_evaluation.jsonl`)
A 30-sample pilot benchmark balanced across:
* **10 Negative**: Infrastructure failure, public outrage, conflict casualties, cybersecurity breaches, economic panic, civil unrest, and multilingual crisis alerts (Hindi, Russian).
* **10 Neutral**: Official MEA press briefings, telecommunication maintenance, meteorological bulletins, government appointments, statistical releases, legislative updates, and multilingual scheduling.
* **10 Positive**: Border security operations, diplomatic agreements, humanitarian rescues, space exploration triumphs, infrastructure milestones, economic records, and multilingual commendations.

### Benchmark Evaluation Results (`cardiffnlp/twitter-roberta-base-sentiment-latest`)

```text
TRAJECT Pretrained Sentiment Model Evaluation

Model:    cardiffnlp/twitter-roberta-base-sentiment-latest
Dataset:  manual_evaluation.jsonl (30 samples)
Device:   cpu

Accuracy: 0.8667 (86.7%)
Macro F1: 0.8704

Per-Class Metrics:
  Class      Precision   Recall    F1-Score  Support
  ---------  ----------  --------  --------  -------
  negative   1.0000      0.8000    0.8889    10     
  neutral    0.7143      1.0000    0.8333    10     
  positive   1.0000      0.8000    0.8889    10     

Confusion Matrix:
                 Predicted
              neg   neu   pos
  Actual neg     8     2     0
  Actual neu     0    10     0
  Actual pos     0     2     8
```

#### Key Findings & Error Analysis
* **English Text Performance**: **26/26 (100.0%) Accuracy**. Zero false positive or false negative sentiment classifications across all English test samples, correctly resolving complex hashtags (`#Failure`, `#Bravery`, `#DisinfoAlert`), emojis (`😡`, `🚀`, `🙏`), and geopolitical domain phrasing.
* **Multilingual Generalization**: The 4 misclassified instances (`pilot_09`, `pilot_10`, `pilot_29`, `pilot_30`) were Hindi and Russian samples. Because this RoBERTa variant was trained on English social text, non-English texts fall back safely to `neutral` rather than hallucinating false polarity.
* **Precision**: Achieved **1.0000 Precision** for both `negative` and `positive` sentiment classes.

### Qualitative Telegram Data Evaluation (`telegram_messages.parquet`)
Inference was executed over the 9 text-bearing Telegram records:
* **Output**: `data/processed/telegram/telegram_messages.sentiment-baseline.jsonl`.
* **Result**: All 9 records were classified as `neutral` with high confidence (mean confidence: 0.823). This aligns with ground truth, as the collected channel (`@GenshinUpdate_STR`) exclusively posts factual game patch notes, update schedules, and character leaks.
* **Subtle Nuance**: Message with text *"The leak for Genshin Anniversary gift: Free Character+Weapon is fake"* yielded elevated negative probability (`0.368`), reflecting nuanced token attention to the word *"fake"*.

### Recommendation: KEEP (Candidate Decision)
* **`cardiffnlp/twitter-roberta-base-sentiment-latest`**: **KEEP** as the primary baseline for English-language social streams. It delivers high precision (1.00 on sentiment polarities) and fast CPU inference.
* **Multilingual Strategy**: Non-English streams (e.g. Hindi, Russian) require an explicit multilingual model (e.g. XLM-RoBERTa or IndicBERT) or fine-tuning, as English RoBERTa conservatively maps non-Latin scripts to `neutral`.

### CLI Execution Commands

```powershell
# 1. Run evaluation on benchmark dataset:
python -m app.ml.sentiment.evaluation `
    --input tests\fixtures\sentiment\manual_evaluation.jsonl `
    --model cardiffnlp/twitter-roberta-base-sentiment-latest `
    --output ..\data\processed\telegram\twitter-roberta-evaluation.json `
    --predictions-output ..\data\processed\telegram\twitter-roberta-predictions.jsonl `
    --overwrite

# 2. Run qualitative inference on real processed Parquet dataset:
python -m app.ml.sentiment.evaluation `
    --real-parquet ..\data\processed\telegram\telegram_messages.parquet `
    --real-output ..\data\processed\telegram\telegram_messages.sentiment-baseline.jsonl `
    --overwrite
```

---

## 11. Multilingual Sentiment Evaluation (Milestone 4D)

Milestone 4D evaluated whether deploying a dedicated pretrained multilingual sentiment model outperforms the English baseline on non-English TRAJECT social-media streams.

### Candidate Multilingual Model Selected
* **Model ID**: `cardiffnlp/twitter-xlm-roberta-base-sentiment`
* **Architecture**: XLM-RoBERTa-base (~278M parameters, ~604.8 MB local directory).
* **Training Corpus**: ~198M multilingual tweets in 30+ languages fine-tuned on TweetEval sentiment.
* **License**: MIT.
* **Labels**: `0: negative`, `1: neutral`, `2: positive` (exact alignment with English TweetEval scheme).
* **Why Selected**: As the official multilingual counterpart from CardiffNLP, it shares identical tokenization conventions and objective targets as our English baseline (`cardiffnlp/twitter-roberta-base-sentiment-latest`), ensuring an unbiased architectural comparison.

### Comparative Benchmark Results (`manual_evaluation.jsonl`)

The 30-sample benchmark dataset was evaluated across both models on CPU:

```text
================================================================================
TRAJECT Pretrained Sentiment Model Comparison (Milestone 4D)
================================================================================
Benchmark Dataset: manual_evaluation.jsonl (30 samples)

1. OVERALL BENCHMARK PERFORMANCE:
  Metric       English Model (twitter-roberta-base)   Multilingual Model (twitter-xlm-roberta)   Delta
  -----------  ------------------------------------   ----------------------------------------   -------
  Accuracy      86.67%                                 96.67%                                    +10.00%
  Macro F1      0.8704                                 0.9666                                    +0.0962

2. LANGUAGE BREAKDOWN:
  Lang  Samples  English Acc  Multi Acc   Multi - En Delta
  ----  -------  -----------  ----------  ----------------
  en    24       100.0%       95.8%         -4.2%
  hi    3        33.3%        100.0%       +66.7%
  ru    3        33.3%        100.0%       +66.7%

3. PERFORMANCE & EFFICIENCY (CPU):
  Metric                      English Model          Multilingual Model
  --------------------------  ---------------------  ---------------------
  Model Disk Size               509.1 MB               604.8 MB
  Warm Inference Latency        3.365 s                0.598 s
  Throughput (samples/sec)        8.9                   50.2

4. RECOMMENDATION:
  >>> Use English model for English and multilingual model for non-English
  Reason: English model excels on English text (100.0% vs 95.8%), while the multilingual model provides superior non-English detection. Language routing preserves peak accuracy for both.

5. LIMITATIONS:
  The Hindi and Russian sample sizes (n=3 each) are pilot evaluation samples and not statistically representative population benchmarks.
================================================================================
```

### Real Telegram Qualitative Sanity Check (`telegram_messages.parquet`)
Dual inference was performed across all 9 text-bearing records from the real Telegram channel:
* **Output Artifact**: `data/processed/telegram/telegram_messages.multilingual-comparison.jsonl`.
* **Agreement Rate**: **88.9% (8/9 records agreed)**. Both models classified 8 of 9 informational game patch notes as `neutral`.
* **Qualitative Disagreement Case**:
  - *Message*: `"The leak for Genshin Anniversary gift: Free Character+Weapon is fake\n\nThank you DK2 for the info."`
  - *English Model*: `neutral` (confidence: 0.5794, negative: 0.3676).
  - *Multilingual Model*: `negative` (confidence: 0.7635).
  - *Analysis*: XLM-RoBERTa placed heavier attention on the debunking keyword `"fake"`, categorizing the debunking notice as negative disinformation resolution.

### Final Architecture Recommendation
**Recommendation: Use English model for English and multilingual model for non-English (Language-Aware Routing).**
* For English texts (`lang == 'en'`), route to `cardiffnlp/twitter-roberta-base-sentiment-latest` (achieves 100.0% accuracy on English social text).
* For non-English texts (`lang != 'en'`), route to `cardiffnlp/twitter-xlm-roberta-base-sentiment` (achieves 100.0% accuracy on non-English pilot texts, whereas the English model falls back to neutral).

### CLI Execution Commands

```powershell
# 1. Comparative benchmark evaluation:
python -m app.ml.sentiment.evaluation `
    --input tests\fixtures\sentiment\manual_evaluation.jsonl `
    --model cardiffnlp/twitter-roberta-base-sentiment-latest `
    --compare-with cardiffnlp/twitter-xlm-roberta-base-sentiment `
    --output ..\data\processed\telegram\sentiment-models-comparison.json `
    --overwrite

# 2. Dual real-data qualitative inference on Parquet:
python -m app.ml.sentiment.evaluation `
    --real-parquet ..\data\processed\telegram\telegram_messages.parquet `
    --model cardiffnlp/twitter-roberta-base-sentiment-latest `
    --compare-with cardiffnlp/twitter-xlm-roberta-base-sentiment `
    --real-output ..\data\processed\telegram\telegram_messages.multilingual-comparison.jsonl `
    --overwrite
```

---

## 12. Topic Discovery Baseline (Milestone 4E)

Milestone 4E establishes an unsupervised semantic topic discovery baseline (`app.ml.topics`) that groups normalized social media messages into cohesive semantic topic clusters using frozen multilingual sentence representations and density-based clustering.

> [!IMPORTANT]
> **Topic vs. Narrative Distinction**:
> Topic discovery identifies semantic clusters. It does not by itself determine whether a topic represents an emerging narrative, coordinated behavior, misinformation, influence activity, or malicious information operations.

### 1. Pretrained Embedding Model
* **Model Identifier**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
* **Model Revision**: `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`
* **License**: Apache 2.0
* **Embedding Dimensionality**: 384 dimensions
* **Supported Languages**: 50+ languages (including English, Hindi, Russian, Arabic, French, German, Spanish, etc.)
* **Model Size**: ~470.6 MB (`model.safetensors`)
* **Pooling Behavior**: Mean pooling over token embeddings with subsequent L2 vector normalization.
* **Frozen Invariant**: The model is utilized exclusively as a frozen pretrained feature extractor; zero weights are modified or fine-tuned.

### 2. Architecture & Pipeline
```text
CanonicalMessage (from Parquet or Replay)
    ↓
ML Text Preparation (filtering media-only records)
    ↓
Language Identification & Text Normalization
    ↓
Multilingual Sentence Embedding (SentenceEmbeddingAdapter, 384-dim, L2 normalized)
    ↓
Density-Based Clustering (HDBSCAN: min_cluster_size=2, min_samples=1)
    ↓
Class-based TF-IDF Keyword Extraction (c-TF-IDF with Unicode and hashtag preservation)
    ↓
Centroid Message Selection (Cosine proximity to cluster mean vector)
    ↓
TopicDiscoveryResult (TopicRecord Candidates + Isolated Noise Messages)
```

### 3. Keyword Extraction & Topic Representation
* **c-TF-IDF Formulation**: Rather than generic frequency counting, keywords are weighted using class-based TF-IDF:
  $$W_{t, c} = \text{TF}_{t, c} \times \log\left(1 + \frac{A}{f_t}\right)$$
  where $\text{TF}_{t, c}$ is the term count in cluster $c$, $A$ is the average word count per cluster, and $f_t$ is total frequency across all clusters. This guarantees terms unique to a specific cluster receive top priority.
* **Sanitization**: Strips raw URLs (`https://...`, `t.me/...`) and pure `@user` handles, but preserves `#hashtags` and multilingual Unicode characters across Latin, Devanagari, and Cyrillic scripts.
* **Representative Messages**: Computes the L2-normalized centroid vector of the cluster and ranks messages by cosine similarity $\mathbf{m}_i \cdot \mathbf{c}$, returning the most central canonical message IDs.

### 4. Controlled Benchmark Results (`controlled_topics.jsonl`)
Evaluated across 15 synthetic social-media posts distributed across 3 distinct semantic domains:
* **Total Input**: 15 messages
* **Clustered Count**: 15 (100.0%)
* **Noise Count**: 0 (0.0%)
* **Discovered Topics**: 3 (Silhouette Score: `0.2350`)
  1. `topic_000` (5 messages, 33.3%): `prices (1.00), fuel (1.00), petrol (1.00), crude (0.60), oil (0.60)` [Energy Market domain]
  2. `topic_001` (5 messages, 33.3%): `border (1.00), surveillance (0.83), security (0.62), forces (0.62)` [Border Security domain]
  3. `topic_002` (5 messages, 33.3%): `football (1.00), manchester (0.60), united (0.60), secures (0.60)` [Sports domain]
* **Throughput**: ~47 messages/sec on CPU.

### 5. Real Telegram Dataset Smoke Test (`telegram_messages.parquet`)
* **Total Messages**: 10 (9 text-bearing, 1 media-only excluded).
* **Embedding Generation**: 100% success (9 x 384 matrix).
* **Clustering Behavior**: Because 9 messages across distinct game update notes do not meet the minimum density threshold to form statistically cohesive clusters, HDBSCAN correctly classified all 9 as noise/outliers.
* **Integrity**: The pipeline handles sparse datasets gracefully without inventing or hallucinating artificial topic boundaries.

### 6. Limitations & Future Work
1. **Unsupervised Density Bounds**: HDBSCAN requires sufficient message volume to establish dense neighborhoods; very small channels will naturally produce high noise ratios.
2. **Static Snapshot**: Topic discovery identifies static topical similarity; it does not track narrative mutation over time or measure coordination patterns.
3. **No Semantic Labels**: Topic IDs remain neutral (`topic_000`, `topic_001`) with statistical keywords to avoid hallucinated LLM labeling.

### CLI Execution Commands

```powershell
# 1. Run controlled topic discovery:
python -m app.ml.topics.discovery `
    --fixture tests\fixtures\topics\controlled_topics.jsonl `
    --min-cluster-size 3 `
    --min-samples 1

# 2. Run real Telegram smoke test:
python -m app.ml.topics.discovery `
    --parquet ..\data\processed\telegram\telegram_messages.parquet `
    --output ..\data\processed\telegram\topic-discovery-baseline.json `
    --min-cluster-size 2 `
    --min-samples 1 `
    --overwrite
```

---

## 13. Topic Feature Enrichment (Milestone 4F)

Milestone 4F enriches discovered semantic topic clusters (`TopicRecord` from Milestone 4E) with deterministic contextual feature vectors:

$$\text{Topic Cluster} \longrightarrow \text{Social Entities} + \text{Engagement Metrics} + \text{Propagation Signals} + \text{Temporal Profiles}$$

> [!IMPORTANT]
> **Strict 4F $\to$ 4G Boundary**:
> Milestone 4F is strictly a **deterministic feature extraction** layer. It extracts objective, reproducible measurements without analytical conclusions.
> Specifically:
> * **NO** threat / risk scores
> * **NO** propaganda or misinformation labels
> * **NO** bot or coordinated inauthentic behavior (CIB) classifications
> * **NO** causal propagation claims (e.g., claiming a forward is coordinated amplification)
> * **NO** LLM-generated summaries or synthetic entity hallucinations
> Interpretation, anomaly detection, narrative scoring, and coordination modeling belong strictly to Milestone 4G.

### 1. Feature Architecture & Package Layout (`app.ml.features`)

```text
backend/app/ml/features/
├── __init__.py           # Lazy exports for models, extractors, and enrichment orchestrator
├── models.py             # Pydantic v2 schemas: TopicEntity, TopicEngagementFeatures,
│                         # TopicPropagationFeatures, TopicTemporalFeatures, EnrichedTopicCandidate,
│                         # TopicEnrichmentResult
├── entities.py           # Social entities (hashtags, handles, domain roots) + P1 Multilingual gazetteers
├── engagement.py         # Deterministic engagement sums, ratios, peak view message, emoji polarity
├── propagation.py        # Observed forward tracking, origin channels, uncredited near-duplicate syndication
├── temporal.py           # Timespan, cadence (msg/h), peak UTC 1h bucket, burstiness index, channel entry velocity
└── enrichment.py         # Orchestrator & CLI runner joining 4E topics with 4F features
```

### 2. Feature Extractor Specifications & Mathematical Formulations

#### A. Social Entities & Multilingual Gazetteer (`entities.py`)
* **Hashtags (`HASHTAG`)**: Normalized lowercase strings with leading `#` stripped (e.g., `#BorderPatrol` $\to$ `borderpatrol`). Deduplicated per message.
* **Handles (`HANDLE`)**: Extracted from `mentions` or `@channel` regex, normalized lowercase with leading `@` stripped.
* **Domain Roots (`DOMAIN`)**: Canonicalized registered host domains extracted from URLs via `urllib.parse.urlparse` (e.g., `https://www.reuters.com/news/123` $\to$ `reuters.com`).
* **P1 Multilingual Gazetteer (`GAZETTEER_GEO`, `GAZETTEER_ORG`)**: Curated deterministic dictionary mapping geopolitical entities and strategic organizations across English, Hindi (Devanagari), and Russian (Cyrillic) without heavy NER dependencies.

#### B. Engagement Metrics (`engagement.py`)
* **Aggregations**: Deterministic sums across all cluster messages: `total_views`, `total_forwards`, `total_replies`, `total_reactions`. Missing fields (`None`) default to `0`.
* **Safe Ratios**:
  $$\text{forward\_to\_view\_ratio} = \frac{\text{total\_forwards}}{\max(\text{total\_views}, 1)}$$
  $$\text{reply\_to\_view\_ratio} = \frac{\text{total\_replies}}{\max(\text{total\_views}, 1)}$$
  $$\text{reaction\_to\_view\_ratio} = \frac{\text{total\_reactions}}{\max(\text{total\_views}, 1)}$$
* **Emoji Polarity Heuristic**:
  $$\text{polarity} = \frac{\sum \text{pos\_emojis} - \sum \text{neg\_emojis}}{\max(\text{total\_reactions}, 1)} \in [-1.0, +1.0]$$
  * *Positive*: `👍`, `❤️`, `🔥`, `🎉`, `👏`, `😍`, `🥳`, `🙏` (+1.0)
  * *Negative*: `👎`, `😡`, `🤬`, `💩`, `🤮`, `😢`, `💔` (-1.0)
  * *Neutral / Informational / Custom*: `🤔`, `👀`, `⚡`, `✍️`, `🫡`, `🤝` or unknown emoji tokens contribute 0.0 signed weight to total reactions.
* **Peak View Message**: Canonical ID of the message with the highest observed view count.

#### C. Propagation Signals (`propagation.py`)
* **Observed Forwards**: Count and ratio of messages where `is_forward == True` and `origin_source_id` is present.
* **Origin Channel Parsing**: Deterministically parses root origin channel from `origin_source_id` (`telegram:<channel>:<native_id>`).
* **Verified Cross-Channel Spread**: Count of forwarded messages where **both** the origin channel ID and broadcasting channel ID are reliably known and differ:
  $$\text{broadcasting\_channel\_id} \neq \text{origin\_channel\_id}$$
  If the author is not verified as a channel (e.g., `author_type == AuthorType.USER` or `UNKNOWN`), it is not classified as cross-channel spread.
* **P1 Configurable Near-Duplicate Syndication**: Identifies non-forward messages sharing near-identical text content across different authors/channels via cosine similarity over embedding representations with a user-configurable threshold (default: `0.92`, tested across `0.90`, `0.92`, `0.95`, `0.98`).

#### D. Temporal Profiles (`temporal.py`)
* **Timespan**: Total elapsed time from earliest `published_at` to latest `published_at` in seconds.
* **Cadence & Small-Sample Policies**:
  - **Single message**: `timespan = 0.0s`, `messages_per_hour = None`, `burstiness_index = None`, `channel_entry_velocity = None`.
  - **Identical timestamps**: `timespan = 0.0s`, `messages_per_hour = None`, `burstiness_index = None`, `channel_entry_velocity = None`.
  - **Two messages**: `messages_per_hour` computed if `timespan > 0`; `burstiness_index = None` (insufficient inter-arrival intervals).
  - **$\ge 3$ messages**:
    $$\text{messages\_per\_hour} = \frac{|\text{msgs}|}{\text{timespan\_hours}}$$
* **Peak 1-Hour UTC Window**: Deterministic hourly binning formatted as ISO `YYYY-MM-DDTHH:00` identifying maximum burst density.
* **Burstiness Index**: Inter-arrival interval dispersion:
  $$B = \frac{\sigma_\tau - \mu_\tau}{\sigma_\tau + \mu_\tau} \in [-1.0, +1.0]$$
  where $\tau_i = t_{i+1} - t_i$. Regular periodic posting yields $B \approx -1$, Poisson processes yield $B \approx 0$, and sudden bursty activity yields $B > 0$. Requires $\ge 3$ messages.
* **Channel Entry Velocity**: Distinct authors per elapsed hour for $\text{timespan} > 0$.

### 3. Verification & Benchmark Summary

* **Unit & Integration Tests**: 15 dedicated test cases in `backend/tests/test_topic_features.py` covering serialization, entities, engagement safe division, emoji heuristics, verified cross-channel propagation guards, configurable syndication thresholds ($0.90, 0.92, 0.95, 0.98$), small-sample temporal edge cases (1 msg, 2 msgs, identical timestamps), and full orchestration.
* **Full Test Suite Status**: **152 passing tests** across the entire backend repository in ~6.80 seconds.
* **Storage Immutability**: Verified SHA-256 hashes of `data/raw/telegram/GenshinUpdate_STR_20260902_194324.jsonl` (`6F925744...`) and `data/processed/telegram/telegram_messages.parquet` (`5C396FE0...`) remain byte-for-byte identical.
* **Real Parquet Smoke Test Artifact**: Generated `data/processed/telegram/topic-features-baseline.json`.

### CLI Execution Commands

```powershell
# 1. Run enrichment on real Telegram Parquet dataset:
python -m app.ml.features.enrichment `
    --parquet ..\data\processed\telegram\telegram_messages.parquet `
    --output ..\data\processed\telegram\topic-features-baseline.json `
    --min-cluster-size 2 `
    --syndication-threshold 0.92 `
    --overwrite

# 2. Run enrichment on expanded 16-sample multi-topic multi-channel fixture:
python -m app.ml.features.enrichment `
    --fixture tests\fixtures\features\synthetic_enrichment_fixture.jsonl `
    --min-cluster-size 2 `
    --syndication-threshold 0.92
```

---

## 14. Narrative Candidate Formation & Priority Scoring (Milestone 4G)

Milestone 4G elevates enriched topic clusters (`EnrichedTopicCandidate` from Milestone 4F) into prioritized, explainable **Narrative Candidates** (`NarrativeCandidate`):

$$\text{EnrichedTopicCandidate} + \text{Batched Sentiment Synthesis} \longrightarrow \text{NarrativeCandidate} + \text{Priority Signal Score}$$

> [!IMPORTANT]
> **Strict Operational Boundaries for Milestone 4G**:
> 1. **Priority / Narrative Signal Score (NOT Threat / Risk Score)**: The composite score ($[0.0, 1.0]$) represents triage priority and operational narrative momentum. It is **never** termed a "threat" or "risk" score.
> 2. **Potential Coordination / Anomaly Signals (NOT Proof of Inauthenticity)**: Syndication spikes, temporal burstiness, and rapid multi-channel entry are flagged strictly as *potential coordination or anomaly signals*, never as factual proof or conclusions of inauthentic coordination or CIB.
> 3. **Observed Exposure / Reach (NOT Audience Penetration)**: Measured strictly as *observed exposure/reach* via log-scaled views and forward-to-view ratios, acknowledging that subscriber counts are often unavailable and Telegram views are not unique audience measures.
> 4. **One Initial Promotion per Enriched Topic (P0 Scope)**: P0 establishes a 1:1 candidate promotion baseline (`1 EnrichedTopicCandidate` $\to$ `1 NarrativeCandidate`). Topic and narrative are explicitly **not** claimed to be permanently identical; future narrative evolution (temporal tracking, splitting, merging) will operate on this candidate contract.
> 5. **Evidence / Data-Coverage Metadata**: Every candidate carries an auditable `NarrativeDataCoverage` object so analysts can immediately distinguish well-observed samples from sparse data artifacts.
> 6. **Zero LLM Hallucination**: Headline claims and framing remain 100% deterministic (entities + discriminative c-TF-IDF keywords).
> 7. **Storage & 4F Immutability**: Milestone 4F source code, raw JSONL, and Parquet storage remain untouched.

### 1. Package Architecture (`app.ml.narratives`)

```text
backend/app/ml/narratives/
├── __init__.py           # Lazy exports for models, scoring, framing, and detector
├── models.py             # Pydantic v2 schemas: NarrativeCandidate, SubScores, Signals, Coverage, Report
├── scoring.py            # Bounded, safe mathematical formulations for 4 sub-scores + composite
├── sentiment_fusion.py   # Batched sentiment inference over all text messages in candidate cluster
├── signals.py            # Potential coordination & anomaly indicator heuristics
├── framing.py            # Deterministic entity + keyword headline & evidence coverage generation
└── detector.py           # End-to-end orchestrator (`promote_narratives`) and reproducible CLI runner
```

### 2. Mathematical Formulations for Priority Scoring

All sub-scores and composite scores reside strictly in $[0.0, 1.0]$, are monotonic, deterministic, and safe against zero division.

#### A. Spread Sub-Score ($S_{\text{spread}} \in [0.0, 1.0]$)
$$S_{\text{spread}} = 0.50 \cdot \min\left(\frac{\text{cross\_channel\_spread}}{3.0}, 1.0\right) + 0.30 \cdot \text{direct\_forward\_ratio} + 0.20 \cdot \min\left(\frac{|\text{amplifying\_channels}|}{3.0}, 1.0\right)$$

#### B. Potential Coordination Sub-Score ($S_{\text{coord}} \in [0.0, 1.0]$)
$$\text{synd\_ratio} = \min\left(\frac{\text{uncredited\_syndication\_count}}{\max(\text{non\_forward\_count}, 1)}, 1.0\right)$$
$$B_{\text{norm}} = \begin{cases} \max\left(\frac{\text{burstiness\_index} + 1.0}{2.0}, 0.0\right) & \text{if burstiness\_index is not None} \\ 0.50 & \text{if burstiness\_index is None (neutral fallback)} \end{cases}$$
$$V_{\text{norm}} = \begin{cases} \min\left(\frac{\text{channel\_entry\_velocity}}{10.0}, 1.0\right) & \text{if channel\_entry\_velocity is not None} \\ 0.0 & \text{if velocity is None} \end{cases}$$
$$S_{\text{coord}} = 0.50 \cdot \min(\text{synd\_ratio} \times 2.0, 1.0) + 0.30 \cdot B_{\text{norm}} + 0.20 \cdot V_{\text{norm}}$$

#### C. Observed Exposure / Reach Sub-Score ($S_{\text{reach}} \in [0.0, 1.0]$)
$$S_{\text{reach}} = 0.60 \cdot \min\left(\frac{\log_{10}(\max(\text{total\_views}, 1))}{6.0}, 1.0\right) + 0.40 \cdot \min\left(\frac{\text{forward\_to\_view\_ratio}}{0.08}, 1.0\right)$$

#### D. Friction & Polarity Sub-Score ($S_{\text{friction}} \in [0.0, 1.0]$)
$$\text{emoji\_neg} = \max(-\text{emoji\_polarity\_score}, 0.0) \in [0.0, 1.0]$$
$$\text{term\_reply} = \min\left(\frac{\text{reply\_to\_view\_ratio}}{0.04}, 1.0\right)$$
- When text sentiment is **available**:
  $$S_{\text{friction}} = 0.45 \cdot \text{text\_negative\_ratio} + 0.35 \cdot \text{emoji\_neg} + 0.20 \cdot \text{term\_reply}$$
- When text sentiment is **unavailable** (inference skipped/offline):
  $$S_{\text{friction}} = \frac{0.35 \cdot \text{emoji\_neg} + 0.20 \cdot \text{term\_reply}}{0.55}$$
  *(Renormalizes over available components without fabricating false neutrality).*

#### E. Composite Priority / Narrative Signal Score
$$\text{PrioritySignalScore} = w_{\text{spread}} S_{\text{spread}} + w_{\text{coord}} S_{\text{coord}} + w_{\text{reach}} S_{\text{reach}} + w_{\text{friction}} S_{\text{friction}}$$
* **Default Analyst Weights**: $w_{\text{spread}} = 0.30$, $w_{\text{coord}} = 0.30$, $w_{\text{reach}} = 0.20$, $w_{\text{friction}} = 0.20$ ($\sum w_i = 1.0$).
* **Triage Tiers**:
  - $\ge 0.75 \implies \text{CRITICAL}$
  - $0.55 - 0.74 \implies \text{HIGH}$
  - $0.35 - 0.54 \implies \text{ELEVATED}$
  - $< 0.35 \implies \text{ROUTINE}$

### 3. Verification & Benchmark Summary

* **Unit & Integration Tests**: 10 dedicated test cases in `backend/tests/test_narratives.py` covering serialization, bounded formulas, syndication clamping, zero division, unavailable sentiment renormalization, sentiment batching, evidence-density tiers, potential coordination signals, deterministic framing, and priority tier assignments.
* **Full Test Suite Status**: **162 passing tests** across all milestones in ~6.81 seconds.
* **Storage Immutability**: Verified SHA-256 hashes of `data/raw/telegram/GenshinUpdate_STR_20260902_194324.jsonl` (`6F925744...`) and `data/processed/telegram/telegram_messages.parquet` (`5C396FE0...`) remain byte-for-byte identical.
* **Real Parquet Smoke Test Artifact**: Generated `data/processed/telegram/narrative-candidates-baseline.json`.

### CLI Execution Commands

```powershell
# 1. Run narrative candidate formation on real Telegram Parquet dataset:
python -m app.ml.narratives.detector `
    --parquet ..\data\processed\telegram\telegram_messages.parquet `
    --output ..\data\processed\telegram\narrative-candidates-baseline.json `
    --min-cluster-size 2 `
    --overwrite

# 2. Run narrative candidate formation on 16-sample multi-topic fixture:
python -m app.ml.narratives.detector `
    --fixture tests\fixtures\features\synthetic_enrichment_fixture.jsonl `
    --min-cluster-size 2
```

---

## 15. ML Pipeline Performance & Productionization (Milestone 4H)

Milestone 4H establishes the production performance, caching, model lifecycle reuse, and unified pipeline orchestration layer for TRAJECT.

> [!IMPORTANT]
> **Strict Operational Invariants for Milestone 4H**:
> 1. **Zero Semantic Changes**: Preserves all 4A–4G contracts, schemas (`CanonicalMessage`), normalization rules, topic discovery behavior (HDBSCAN), 4F feature definitions, 4G priority scoring formulas, and potential coordination signal non-conclusory wording.
> 2. **Storage Immutability**: Raw JSONL (`6F925744...`) and Parquet storage (`5C396FE0...`) remain 100% byte-for-byte immutable.
> 3. **Model Singleton Lifecycle**: Pretrained sentiment and sentence embedding models are loaded once per process and reused across batches.
> 4. **Deterministic Inference Caching**: Thread-safe, local SQLite cache (`data/cache/ml_inference_cache.db`) with SHA-256 keys tracking model ID, model revision, pipeline version, input ID, and normalized text.
> 5. **Precomputed Analytics Artifacts**: Unified pipeline executes offline/background processing and outputs complete, queryable analytics reports (`MLPipelineResult`), decoupling UI/API reads from expensive model recalculations.

### 1. Package Architecture (`app.ml.pipeline`)

```text
backend/app/ml/pipeline/
├── __init__.py           # Unified exports for lifecycle, cache, orchestrator, and metrics
├── lifecycle.py          # Process-level ModelLifecycleManager for model caching and reuse
├── cache.py              # SQLite-backed InferenceCache and cached adapter wrappers
├── metrics.py            # PipelineStageMetrics observability data contract
├── orchestrator.py       # End-to-end orchestrator (`run_ml_pipeline`) and CLI runner
└── benchmark.py          # Batch-size benchmarking harness for batch sizes 8, 16, 32, 64
```

### 2. Batch-Size Performance Benchmark Results (128 Samples)

Empirical benchmarks run on CPU separating cold-start model load from warm inference, measuring operating system **Peak RSS** (Resident Set Size via Win32 `GetProcessMemoryInfo` / POSIX `getrusage`) and **Peak Python Heap** (via `tracemalloc`):

| Model / Stage | Batch Size | Cold Start | Warm Inference | Throughput | Per-Batch Latency | Peak RSS | Peak Python Heap |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Sentiment** (`twitter-roberta-base`) | 8 | 0.346 s | 7.257 s | 17.6 samples/s | 453.6 ms | 808.0 MB | 0.1 MB |
| **Sentiment** (`twitter-roberta-base`) | 16 | 0.346 s | 9.009 s | 14.2 samples/s | 1126.2 ms | 857.4 MB | 0.2 MB |
| **Sentiment** (`twitter-roberta-base`) | 32 | 0.346 s | 9.251 s | 13.8 samples/s | 2312.7 ms | 955.8 MB | 0.2 MB |
| **Sentiment** (`twitter-roberta-base`) | 64 | 0.346 s | 9.610 s | 13.3 samples/s | 4805.0 ms | 1103.4 MB | 0.3 MB |
| **Embeddings** (`paraphrase-multilingual`) | 8 | 1.992 s | 1.067 s | 119.9 samples/s | 66.7 ms | 1474.1 MB | 0.3 MB |
| **Embeddings** (`paraphrase-multilingual`) | 16 | 1.992 s | 0.894 s | **143.2 samples/s** | 111.7 ms | 1474.1 MB | 0.2 MB |
| **Embeddings** (`paraphrase-multilingual`) | 32 | 1.992 s | 0.982 s | 130.4 samples/s | 245.5 ms | 1474.1 MB | 0.2 MB |
| **Embeddings** (`paraphrase-multilingual`) | 64 | 1.992 s | 1.002 s | 127.8 samples/s | 500.9 ms | 1474.1 MB | 0.3 MB |

*Key Takeaways*: For sentence embeddings on CPU, batch size 16 achieves peak throughput (~143.2 samples/sec). For sentiment on CPU, smaller mini-batches (8) reduce per-batch memory pressure and provide the highest throughput (17.6 samples/sec). Process Peak RSS reaches ~1.1–1.5 GB due to PyTorch C++ runtime and model weights, while Python-allocated heap remains low (0.1–0.3 MB).

### 3. Inference Caching Performance & Semantics

Cache key format: `namespace + pipeline_version + model_id + model_revision + input_id + normalized_text`.
On text NLP inference, model output depends purely on normalized text and model weights. When identical text content appears across distinct canonical messages (e.g. syndicated forwards across channels), content-derived keying (`text_{sha256}`) safely reuses cached inference results without semantic drift, preserving message provenance at the schema layer.

* **Workload-Specific Speedup on Repeated 16-Record Benchmark**:
  - On the repeated 16-record benchmark, sentiment inference decreased from 1.112 s to 0.003 s and sentence embedding inference decreased from 0.181 s to 0.001 s.
  - **Run 1 (Cold Cache)**: 31 misses, 25 hits. Hits occur due to both:
    1. *Inter-stage reuse*: Stage 3 topic discovery embeddings are reused in Stage 4 syndication checks.
    2. *Cross-canonical duplicate text reuse*: Syndicated messages sharing identical normalized text content across channels hit the content cache.
  - **Run 2 (Warm Cache)**: 0 misses, 43–56 hits (**100.0% Cache Hit Rate**), bypassing model forward passes entirely.

### 4. Verification & Regression Suite Status

* **Dedicated 4H Tests**: 18 test cases in `tests/test_ml_cache.py`, `tests/test_ml_pipeline.py`, and `tests/test_ml_performance.py` (including explicit tests for cache-key canonical vs content identity semantics and multi-stage reuse).
* **Full Test Suite Status**: **180 passing tests** across all milestones (100% pass rate) in ~48.61s.
* **Storage Immutability**: Byte-for-byte SHA-256 verification confirmed for both raw JSONL (`6F925744...`) and Parquet storage (`5C396FE0...`).
* **Analytical Invariant Preservation**:
  - 3 topics formed (13 clustered / 3 noise).
  - Border narrative score: **0.4914**
  - Sports narrative score: **0.4378**
  - Routine narrative score: **0.1440**
* **Model Lifecycle Timings (Individual Attribution)**:
  - English Sentiment Model Load: ~1.13 s
  - Embedding Model Load: ~3.35 s
  - Multilingual Sentiment Model: 0.000 s (intentionally lazy-loaded, not loaded for English runs)
  - Warm Pipeline Execution: ~1.34 s
* **Precomputed Analytics Artifacts**:
  - `data/processed/benchmarks/benchmark_results.json`
  - `data/processed/telegram/synthetic-analytics-artifact.json`
  - `data/processed/telegram/telegram-analytics-artifact.json`

### CLI Execution Commands

```powershell
# 1. Run reproducible batch-size inference benchmark:
python -m app.ml.pipeline.benchmark `
    --samples 128 `
    --output ..\data\processed\benchmarks\benchmark_results.json `
    --overwrite

# 2. Run unified production pipeline on real Telegram Parquet dataset:
python -m app.ml.pipeline.orchestrator `
    --parquet ..\data\processed\telegram\telegram_messages.parquet `
    --output ..\data\processed\telegram\telegram-analytics-artifact.json `
    --batch-size 16 `
    --overwrite

# 3. Run unified production pipeline on synthetic fixture:
python -m app.ml.pipeline.orchestrator `
    --fixture tests\fixtures\features\synthetic_enrichment_fixture.jsonl `
    --output ..\data\processed\telegram\synthetic-analytics-artifact.json `
    --batch-size 16 `
    --overwrite
```












