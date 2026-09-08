/**
 * TRAJECT Milestone 5B - Strongly-typed API Contracts
 *
 * Strictly corresponds to the authoritative Milestone 5A Pydantic v2 schemas:
 * - backend/app/schemas/api/common.py
 * - backend/app/schemas/api/health.py
 * - backend/app/schemas/api/analytics.py
 * - backend/app/schemas/api/narratives.py
 * - backend/app/schemas/api/topics.py
 * - backend/app/schemas/api/messages.py
 * - backend/app/schemas/api/pipeline.py
 * - backend/app/ml/narratives/models.py
 * - backend/app/ml/features/models.py
 * - backend/app/schemas/canonical_message.py
 */

// =============================================================================
// Common Envelopes & Pagination
// =============================================================================

export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details: Record<string, unknown>;
  timestamp_utc: string;
}

export interface ErrorEnvelope {
  error: ErrorDetail;
}

// =============================================================================
// 10.1 Health Response (/api/v1/health)
// =============================================================================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | string;
  version: string;
  artifacts_loaded: boolean;
  timestamp_utc: string;
  dataset_source: string | null;
  active_records_count: number | null;
  active_narratives_count: number | null;
}

// =============================================================================
// 10.2 Analytics Overview Response (/api/v1/analytics)
// =============================================================================

export interface DatasetSummaryCounts {
  total_messages: number;
  text_bearing_messages: number;
  media_only_messages: number;
  total_topics: number;
  total_narratives: number;
  noise_messages: number;
}

export interface SentimentDistribution {
  positive_ratio: number;
  neutral_ratio: number;
  negative_ratio: number;
}

export interface SentimentOverview {
  sentiment_model_id: string | null;
  evaluated_messages_count: number;
  distribution: SentimentDistribution;
}

export interface PipelineExecutionSummary {
  created_at_utc: string;
  total_runtime_seconds: number;
  cache_hit_rate: number;
}

export interface AnalyticsOverviewData {
  dataset_source: string;
  summary_counts: DatasetSummaryCounts;
  priority_distribution: {
    critical: number;
    high: number;
    elevated: number;
    routine: number;
    [key: string]: number;
  };
  sentiment_overview: SentimentOverview;
  pipeline_execution: PipelineExecutionSummary;
}

export interface AnalyticsOverviewResponse {
  data: AnalyticsOverviewData;
}

// =============================================================================
// 10.3 & 10.4 Narrative Schemas (/api/v1/narratives & /api/v1/narratives/{id})
// =============================================================================

export type PriorityTier = 'critical' | 'high' | 'elevated' | 'routine';
export type EvidenceDensityTier = 'high' | 'moderate' | 'sparse';

export interface NarrativeSubScores {
  spread_score: number;
  coordination_score: number;
  reach_score: number;
  friction_score: number;
}

export interface PotentialCoordinationSignals {
  potential_syndication_spike: boolean;
  potential_temporal_burst: boolean;
  potential_rapid_channel_entry: boolean;
  potential_cross_channel_cascade: boolean;
}

export interface NarrativeDataCoverage {
  message_count: number;
  channel_count: number;
  timespan_seconds: number;
  has_views_coverage: boolean;
  has_reactions_coverage: boolean;
  evidence_density: EvidenceDensityTier;
  data_quality_notes: string[];
}

export interface NarrativeSentimentProfile {
  is_available: boolean;
  total_text_messages_evaluated: number;
  text_positive_ratio: number | null;
  text_neutral_ratio: number | null;
  text_negative_ratio: number | null;
  emoji_polarity_score: number;
  sentiment_model_id: string | null;
}

export interface NarrativeSummaryResponse {
  narrative_id: string;
  promoted_from_topic_id: string;
  headline_claim: string;
  narrative_name?: string;
  narrative_summary?: string;
  priority_signal_score: number;
  priority_tier: PriorityTier;
  sub_scores: NarrativeSubScores;
  has_coordination_signals: boolean;
  evidence_density: EvidenceDensityTier;
  message_count: number;
  first_observed_at: string;
  last_observed_at: string;
  distinct_sources_count?: number;
  distinct_domains_count?: number;
  is_cross_source?: boolean;
  is_cross_domain?: boolean;
  domains_represented?: string[];
  quality_classification?: 'strong_evidence' | 'moderate_evidence' | 'limited_evidence' | 'insufficient_evidence' | string;
}

export interface NarrativeListResponse {
  data: NarrativeSummaryResponse[];
  meta: PaginationMeta;
}

export interface NarrativeDetailData {
  narrative_id: string;
  promoted_from_topic_id: string;
  headline_claim: string;
  narrative_name?: string;
  narrative_summary?: string;
  priority_signal_score: number;
  priority_tier: PriorityTier;
  sub_scores: NarrativeSubScores;
  coordination_signals: PotentialCoordinationSignals;
  data_coverage: NarrativeDataCoverage;
  sentiment_profile: NarrativeSentimentProfile;
  key_entities: string[];
  broadcasting_channels: string[];
  origin_channels: string[];
  representative_message_excerpts: string[];
  first_observed_at: string;
  last_observed_at: string;
  audit_rationale: string[];
  distinct_sources_count?: number;
  distinct_domains_count?: number;
  is_cross_source?: boolean;
  is_cross_domain?: boolean;
  domains_represented?: string[];
  quality_classification?: 'strong_evidence' | 'moderate_evidence' | 'limited_evidence' | 'insufficient_evidence' | string;
  validation_notes?: string[];
}

export interface NarrativeDetailResponse {
  data: NarrativeDetailData;
}

export interface NarrativeQueryParams {
  page?: number;
  page_size?: number;
  query?: string;
  priority_tier?: PriorityTier;
  min_priority?: number;
  has_coordination_signal?: boolean;
  sort_by?:
    | 'priority_signal_score'
    | 'spread_score'
    | 'coordination_score'
    | 'reach_score'
    | 'friction_score'
    | 'first_observed_at'
    | 'last_observed_at';
  order?: 'asc' | 'desc';
}

// =============================================================================
// 10.5 & 10.6 Topic Schemas (/api/v1/topics & /api/v1/topics/{id})
// =============================================================================

export interface TopicKeywordResponse {
  keyword: string;
  score: number;
}

export interface TopicSummaryResponse {
  topic_id: string;
  cluster_label: number;
  message_count: number;
  percentage_of_dataset: number;
  representative_keywords: TopicKeywordResponse[];
  trend_name?: string;
  trend_summary?: string;
}

export interface TopicListResponse {
  data: TopicSummaryResponse[];
  meta: PaginationMeta;
}

export interface TopicEntity {
  text: string;
  category: 'hashtag' | 'handle' | 'domain' | 'gazetteer_geo' | 'gazetteer_org' | string;
  frequency: number;
  sample_message_ids: string[];
}

export interface TopicEngagementFeatures {
  total_views: number;
  total_forwards: number;
  total_replies: number;
  total_reactions: number;
  forward_to_view_ratio: number;
  reply_to_view_ratio: number;
  reaction_to_view_ratio: number;
  emoji_polarity_score: number;
  peak_views_message_id: string | null;
}

export interface TopicPropagationFeatures {
  observed_forward_count: number;
  direct_forward_ratio: number;
  unique_origin_channels: string[];
  unique_amplifying_channels: string[];
  cross_channel_observed_spread: number;
  uncredited_syndication_count: number;
}

export interface TopicTemporalFeatures {
  first_published_at: string;
  last_published_at: string;
  timespan_seconds: number;
  messages_per_hour: number;
  peak_window_utc: string | null;
  peak_window_message_count: number;
  burstiness_index: number | null;
  channel_entry_velocity: number | null;
}

export interface TopicDetailData {
  topic_id: string;
  cluster_label: number;
  message_count: number;
  percentage_of_dataset: number;
  representative_keywords: TopicKeywordResponse[];
  representative_message_ids: string[];
  sample_message_ids: string[];
  entities: TopicEntity[];
  engagement: TopicEngagementFeatures | null;
  propagation: TopicPropagationFeatures | null;
  temporal: TopicTemporalFeatures | null;
  trend_name?: string;
  trend_summary?: string;
}

export interface TopicDetailResponse {
  data: TopicDetailData;
}

export interface TopicQueryParams {
  page?: number;
  page_size?: number;
  min_messages?: number;
  sort_by?: 'message_count' | 'topic_id' | 'percentage_of_dataset';
  order?: 'asc' | 'desc';
}

// =============================================================================
// Phase 1: Trend, Node Graph & Sentiment Schemas
// =============================================================================

export interface TrendKeywordResponse {
  keyword: string;
  score: number;
}

export interface TrendChannelSummary {
  channel_id: string;
  channel_title: string | null;
  author_username: string | null;
  message_count: number;
  total_views: number | null;
}

export interface TrendSummaryResponse {
  trend_id: string;
  topic_id: string;
  cluster_label: number;
  label: string;
  message_count: number;
  percentage_of_dataset: number;
  representative_keywords: TrendKeywordResponse[];
  associated_narrative_ids?: string[];
  trend_name?: string;
  trend_summary?: string;
}

export interface TrendListResponse {
  data: TrendSummaryResponse[];
  meta: PaginationMeta;
}

export interface TrendDetailData {
  trend_id: string;
  topic_id: string;
  cluster_label: number;
  label: string;
  message_count: number;
  percentage_of_dataset: number;
  representative_keywords: TrendKeywordResponse[];
  representative_message_ids: string[];
  sample_message_ids: string[];
  entities: TopicEntity[];
  engagement: TopicEngagementFeatures | null;
  propagation: TopicPropagationFeatures | null;
  temporal: TopicTemporalFeatures | null;
  channels: TrendChannelSummary[];
  associated_narrative_ids: string[];
  trend_name?: string;
  trend_summary?: string;
}

export interface TrendDetailResponse {
  data: TrendDetailData;
}

export interface TrendQueryParams {
  page?: number;
  page_size?: number;
  min_messages?: number;
  sort_by?: 'message_count' | 'percentage_of_dataset' | 'trend_id' | 'topic_id';
  order?: 'asc' | 'desc';
}

export interface GraphNode {
  id: string;
  type: 'trend' | 'channel' | 'entity' | 'narrative' | 'message';
  label: string;
  metadata: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship_type: 'observed_in' | 'cited_in' | 'promoted_to' | 'contributes_evidence' | 'associated_with';
  label: string;
  metadata: Record<string, any>;
}

export interface TrendGraphData {
  trend_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
}

export interface TrendGraphResponse {
  data: TrendGraphData;
}

export interface SentimentBucket {
  bucket_start_utc: string;
  bucket_end_utc: string;
  positive: number;
  neutral: number;
  negative: number;
  unassigned: number;
  total: number;
  net_sentiment: number | null;
}

export interface SentimentSummary {
  total_messages: number;
  evaluated_messages: number;
  unassigned_messages: number;
  positive_ratio: number | null;
  neutral_ratio: number | null;
  negative_ratio: number | null;
  sentiment_model_id: string | null;
}

export interface TrendSentimentData {
  trend_id: string;
  topic_id: string;
  bucket_size: string;
  time_series: SentimentBucket[];
  summary: SentimentSummary;
}

export interface TrendSentimentResponse {
  data: TrendSentimentData;
}

export interface NarrativeSentimentData {
  narrative_id: string;
  promoted_from_trend_id: string;
  bucket_size: string;
  time_series: SentimentBucket[];
  summary: SentimentSummary;
}

export interface NarrativeSentimentResponse {
  data: NarrativeSentimentData;
}


// =============================================================================
// 10.7 & 10.8 Message Schemas (/api/v1/messages & /api/v1/messages/{id})
// =============================================================================

export type Platform = 'telegram' | 'x';
export type AuthorType = 'channel' | 'group' | 'user' | 'unknown';

export interface MessageSummaryResponse {
  canonical_id: string;
  platform: Platform;
  native_id: string;
  author_id: string;
  channel_title: string | null;
  published_at: string;
  text_content: string;
  language: string | null;
  views_count: number | null;
  forwards_count: number | null;
  has_media: boolean;
  is_forward: boolean;
}

export interface MessageListResponse {
  data: MessageSummaryResponse[];
  meta: PaginationMeta;
}

export interface MessageDetailData {
  canonical_id: string;
  platform: Platform;
  native_id: string;
  author_id: string;
  author_username: string | null;
  author_type: AuthorType;
  channel_title: string | null;
  subscriber_count: number | null;
  published_at: string;
  collected_at: string;
  text_content: string;
  language: string | null;
  media_types: string[];
  has_media: boolean;
  is_forward: boolean;
  is_repost: boolean;
  origin_source_id: string | null;
  reply_to_id: string | null;
  thread_id: string | null;
  views_count: number | null;
  forwards_count: number | null;
  replies_count: number | null;
  reactions: Record<string, number>;
  urls: string[];
  hashtags: string[];
  mentions: string[];
  raw_reference: string | null;
  assigned_topic_id: string | null;
}

export interface MessageDetailResponse {
  data: MessageDetailData;
}

export interface MessageQueryParams {
  page?: number;
  page_size?: number;
  platform?: Platform;
  channel_id?: string;
  topic_id?: string;
  has_media?: boolean;
  is_forward?: boolean;
  language?: string;
  sort_by?: 'published_at' | 'views_count' | 'forwards_count';
  order?: 'asc' | 'desc';
}

// =============================================================================
// 10.9 & 10.10 Pipeline Schemas (/api/v1/pipeline/*)
// =============================================================================

export interface CacheStatus {
  enabled: boolean;
  hit_rate: number;
}

export interface PipelineStatusResponse {
  status: string;
  dataset_source: string;
  created_at_utc: string;
  pipeline_version: string;
  cache_status: CacheStatus | null;
  collection_mode?: string | null;
  last_collection_run?: string | null;
  last_successful_collection?: string | null;
  source_count?: number | null;
  successful_source_count?: number | null;
  failed_source_count?: number | null;
  last_new_record_count?: number | null;
  cumulative_record_count?: number | null;
  corpus_snapshot_id?: string | null;
  analytics_generated_at?: string | null;
  analytics_current?: boolean;
  stale_analytics_reason?: string | null;
  active_lineages_count?: number | null;
  last_temporal_update?: string | null;
}

export interface StageLatencies {
  language_detection: number;
  normalization: number;
  sentiment_load: number;
  sentiment_inference: number;
  embedding_load: number;
  embedding_inference: number;
  topic_discovery: number;
  feature_enrichment: number;
  narrative_assessment: number;
  total_runtime: number;
}

export interface ExecutionBreakdown {
  cold_start_time_seconds: number;
  warm_inference_time_seconds: number;
}

export interface ThroughputSamples {
  sentiment: number;
  embedding: number;
}

export interface RecordAccounting {
  records_ingested: number;
  records_processed: number;
  records_skipped: number;
  records_failed: number;
}

export interface CachePerformance {
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate: number;
}

export interface MemoryFootprint {
  peak_process_rss_mb: number;
  peak_python_heap_mb: number;
}

export interface PipelineMetricsResponse {
  stage_latencies_seconds: StageLatencies;
  execution_breakdown: ExecutionBreakdown;
  throughput_samples_per_sec: ThroughputSamples;
  record_accounting: RecordAccounting;
  cache_performance: CachePerformance;
  memory_footprint_mb: MemoryFootprint;
}

// -----------------------------------------------------------------------------
// Milestone 6E: Temporal Narrative Lineage & Operational Monitoring
// -----------------------------------------------------------------------------

export type LineageState = 'new' | 'persisting' | 'weakening' | 'disappeared' | 'reappeared';

export interface LineageEvent {
  event_id: string;
  lineage_id: string;
  snapshot_id: string;
  previous_snapshot_id: string | null;
  event_type: string;
  timestamp: string;
  source_narrative_id: string | null;
  previous_narrative_id: string | null;
  lineage_match_score: number | null;
  match_evidence: Record<string, any>;
  explanation: string;
}

export interface NarrativeLineage {
  lineage_id: string;
  current_narrative_id: string | null;
  state: LineageState;
  first_seen_at: string;
  last_seen_at: string;
  first_snapshot_id: string;
  last_snapshot_id: string;
  previous_snapshot_id: string | null;
  snapshot_count: number;
  consecutive_snapshot_count: number;
  message_count_current: number;
  message_count_previous: number | null;
  distinct_sources_current: number;
  distinct_sources_previous: number | null;
  distinct_domains_current: number;
  distinct_domains_previous: number | null;
  priority_signal_current: number;
  priority_signal_previous: number | null;
  headline_claim_current: string;
  lineage_match_score: number | null;
  historical_narrative_ids: string[];
}

export interface NarrativeLineageSummary {
  lineage_id: string;
  current_narrative_id: string | null;
  state: LineageState;
  first_seen_at: string;
  last_seen_at: string;
  snapshot_count: number;
  consecutive_snapshot_count: number;
  message_count_current: number;
  message_count_previous: number | null;
  priority_signal_current: number;
  headline_claim_current: string;
  lineage_match_score: number | null;
}

export interface LineageListResponse {
  data: NarrativeLineageSummary[];
  meta: PaginationMeta;
}

export interface NarrativeLineageDetailResponse {
  lineage: NarrativeLineage;
  events: LineageEvent[];
}

export interface TemporalSnapshotMetadata {
  snapshot_id: string;
  collection_run_id: string | null;
  corpus_snapshot_id: string | null;
  generated_at_utc: string;
  corpus_size: number;
  narrative_count: number;
  topic_count: number;
  artifact_path: string;
}

export interface TemporalSnapshotListResponse {
  snapshots: TemporalSnapshotMetadata[];
  total_snapshots: number;
}

export interface TemporalStatusResponse {
  collection_status: string;
  last_collection_run: string | null;
  last_successful_collection: string | null;
  cumulative_corpus_count: number;
  latest_corpus_snapshot_id: string | null;
  latest_analytics_snapshot_id: string | null;
  analytics_generated_at_utc: string | null;
  analytics_current: boolean;
  stale_analytics_reason: string | null;
  total_lineages_tracked: number;
  active_lineages_count: number;
  lineages_by_state: Record<string, number>;
  last_temporal_update: string | null;
}
