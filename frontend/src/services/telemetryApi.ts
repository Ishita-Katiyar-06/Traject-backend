/**
 * TRAJECT Milestone 5B - Authoritative Telemetry API Service
 *
 * Exclusively consumes the frozen Milestone 5A REST endpoints under /api/v1:
 * - GET /health
 * - GET /analytics
 * - GET /narratives
 * - GET /narratives/{narrative_id}
 * - GET /topics
 * - GET /topics/{topic_id}
 * - GET /messages
 * - GET /messages/{message_id}
 * - GET /pipeline/status
 * - GET /pipeline/metrics
 *
 * Strictly typed against src/types/api.ts.
 */

import { apiClient, type RequestOptions } from './apiClient.ts';
import type {
  AnalyticsOverviewResponse,
  HealthResponse,
  MessageDetailResponse,
  MessageListResponse,
  MessageQueryParams,
  LineageListResponse,
  NarrativeDetailResponse,
  NarrativeLineageDetailResponse,
  NarrativeListResponse,
  NarrativeQueryParams,
  PipelineMetricsResponse,
  PipelineStatusResponse,
  TemporalSnapshotListResponse,
  TemporalStatusResponse,
  TopicDetailResponse,
  TopicListResponse,
  TopicQueryParams,
} from '../types/api.ts';

export const telemetryApi = {
  /**
   * 10.1 GET /api/v1/health
   * Operational readiness probe and artifact loading status.
   */
  async getHealth(options?: RequestOptions): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>('/health', {
      timeoutMs: 5000,
      skipCache: true,
      ...options,
    });
  },

  /**
   * 10.2 GET /api/v1/analytics
   * Executive dashboard summary: counts, priority distribution, sentiment, and pipeline telemetry.
   */
  async getAnalyticsOverview(options?: RequestOptions): Promise<AnalyticsOverviewResponse> {
    return apiClient.get<AnalyticsOverviewResponse>('/analytics', {
      cacheTtlMs: 5000,
      ...options,
    });
  },

  /**
   * 10.3 GET /api/v1/narratives
   * Paginated triage queue of prioritized narrative candidates synthesized by 4G.
   */
  async getNarratives(
    params?: NarrativeQueryParams,
    options?: RequestOptions
  ): Promise<NarrativeListResponse> {
    const qs = apiClient.buildQueryString(params as Record<string, unknown>);
    return apiClient.get<NarrativeListResponse>(`/narratives${qs}`, {
      cacheTtlMs: 3000,
      ...options,
    });
  },

  /**
   * 10.4 GET /api/v1/narratives/{narrative_id}
   * Full explainable analytical dossier for a single narrative candidate.
   */
  async getNarrativeById(
    narrativeId: string,
    options?: RequestOptions
  ): Promise<NarrativeDetailResponse> {
    const cleanId = encodeURIComponent(narrativeId.trim());
    return apiClient.get<NarrativeDetailResponse>(`/narratives/${cleanId}`, {
      cacheTtlMs: 10000,
      ...options,
    });
  },

  /**
   * 10.5 GET /api/v1/topics
   * Paginated list of discovered semantic topic clusters formed by HDBSCAN.
   */
  async getTopics(
    params?: TopicQueryParams,
    options?: RequestOptions
  ): Promise<TopicListResponse> {
    const qs = apiClient.buildQueryString(params as Record<string, unknown>);
    return apiClient.get<TopicListResponse>(`/topics${qs}`, {
      cacheTtlMs: 5000,
      ...options,
    });
  },

  /**
   * 10.6 GET /api/v1/topics/{topic_id}
   * Deep diagnostic topic details joined with 4F engagement, propagation, and temporal features.
   */
  async getTopicById(
    topicId: string,
    options?: RequestOptions
  ): Promise<TopicDetailResponse> {
    const cleanId = encodeURIComponent(topicId.trim());
    return apiClient.get<TopicDetailResponse>(`/topics/${cleanId}`, {
      cacheTtlMs: 10000,
      ...options,
    });
  },

  /**
   * 10.7 GET /api/v1/messages
   * Paginated collection of normalized social media messages from the canonical dataset.
   */
  async getMessages(
    params?: MessageQueryParams,
    options?: RequestOptions
  ): Promise<MessageListResponse> {
    const qs = apiClient.buildQueryString(params as Record<string, unknown>);
    return apiClient.get<MessageListResponse>(`/messages${qs}`, {
      cacheTtlMs: 3000,
      ...options,
    });
  },

  /**
   * 10.8 GET /api/v1/messages/{message_id}
   * Full 27-field canonical representation of an individual social media post.
   * Handles chat-scoped Telegram IDs (e.g. telegram:chan1:101) with URL path encoding.
   */
  async getMessageById(
    messageId: string,
    options?: RequestOptions
  ): Promise<MessageDetailResponse> {
    // Encodes colons and special characters in canonical IDs
    const encodedId = encodeURIComponent(messageId.trim());
    return apiClient.get<MessageDetailResponse>(`/messages/${encodedId}`, {
      cacheTtlMs: 10000,
      ...options,
    });
  },

  /**
   * 10.9 GET /api/v1/pipeline/status
   * High-level pipeline provenance and lifecycle metadata.
   */
  async getPipelineStatus(options?: RequestOptions): Promise<PipelineStatusResponse> {
    return apiClient.get<PipelineStatusResponse>('/pipeline/status', {
      skipCache: true,
      ...options,
    });
  },

  /**
   * 10.10 GET /api/v1/pipeline/metrics
   * Granular audit-ready latency, throughput, memory, and cache accounting metrics.
   */
  async getPipelineMetrics(options?: RequestOptions): Promise<PipelineMetricsResponse> {
    return apiClient.get<PipelineMetricsResponse>('/pipeline/metrics', {
      cacheTtlMs: 5000,
      ...options,
    });
  },

  // ---------------------------------------------------------------------------
  // Milestone 6E: Temporal Narrative Lineage & Monitoring
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/temporal/status
   * Unified operational health and temporal lineage status.
   */
  async getTemporalStatus(options?: RequestOptions): Promise<TemporalStatusResponse> {
    return apiClient.get<TemporalStatusResponse>('/temporal/status', {
      skipCache: true,
      ...options,
    });
  },

  /**
   * GET /api/v1/temporal/snapshots
   * Discovered immutable analytics snapshots.
   */
  async getTemporalSnapshots(options?: RequestOptions): Promise<TemporalSnapshotListResponse> {
    return apiClient.get<TemporalSnapshotListResponse>('/temporal/snapshots', {
      cacheTtlMs: 5000,
      ...options,
    });
  },

  /**
   * GET /api/v1/temporal/narratives
   * Paginated list of temporal narrative lineages.
   */
  async getLineages(
    params?: { state?: string; page?: number; page_size?: number },
    options?: RequestOptions
  ): Promise<LineageListResponse> {
    const qs = apiClient.buildQueryString((params || {}) as Record<string, unknown>);
    return apiClient.get<LineageListResponse>(`/temporal/narratives${qs}`, {
      cacheTtlMs: 3000,
      ...options,
    });
  },

  /**
   * GET /api/v1/temporal/narratives/{lineage_id}
   * Full lineage details and lifecycle event history.
   */
  async getLineageDetail(
    lineageId: string,
    options?: RequestOptions
  ): Promise<NarrativeLineageDetailResponse> {
    const encodedId = encodeURIComponent(lineageId.trim());
    return apiClient.get<NarrativeLineageDetailResponse>(`/temporal/narratives/${encodedId}`, {
      cacheTtlMs: 5000,
      ...options,
    });
  },

  /**
   * GET /api/v1/temporal/narratives/by-narrative/{narrative_id}
   * Resolve lineage for a snapshot-local narrative candidate.
   */
  async getLineageByNarrative(
    narrativeId: string,
    options?: RequestOptions
  ): Promise<NarrativeLineageDetailResponse> {
    const encodedId = encodeURIComponent(narrativeId.trim());
    return apiClient.get<NarrativeLineageDetailResponse>(
      `/temporal/narratives/by-narrative/${encodedId}`,
      {
        cacheTtlMs: 5000,
        ...options,
      }
    );
  },
};
