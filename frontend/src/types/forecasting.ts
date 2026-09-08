/**
 * Milestone 8F: Emerging Trend Forecasting Frontend Data Contracts
 *
 * Strict TypeScript types mirroring backend Milestone 8E Pydantic schemas
 * (app/schemas/forecasting.py). Zero `any` usage.
 */

export type ForecastTier =
  | 'STRONG_EMERGENCE'
  | 'MODERATE_EMERGENCE'
  | 'EARLY_SIGNAL'
  | 'LOW_MOMENTUM';

export type TrajectoryPhase =
  | 'ACCELERATING'
  | 'GROWING'
  | 'PERSISTENT'
  | 'STABLE'
  | 'WEAKENING'
  | 'INSUFFICIENT_DATA';

export type ConfidenceTier =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INSUFFICIENT_DATA';

export interface EmergingTrendForecast {
  topic_id: string;
  topic_name?: string | null;
  topic_keywords?: string[];
  cutoff_at: string;
  horizon_hours: number;
  forecast_score: number;
  forecast_rank: number;
  forecast_tier: ForecastTier;
  trajectory_phase: TrajectoryPhase;
  confidence_tier: ConfidenceTier;

  // Supporting Temporal Features (derived strictly from messages <= T)
  historical_message_count: number;
  recent_message_count: number;
  messages_24h: number;
  baseline_message_count: number;
  growth_velocity: number;
  velocity_6h: number;
  acceleration_factor: number | null;
  persistence_score: number;
  channel_diffusion_rate: number;
  domain_diffusion_rate: number;
  burstiness_index: number | null;

  // Feature Availability Metadata
  publication_kinetics_available: boolean;
  acceleration_available: boolean;
  engagement_signal_available: boolean;

  generated_at: string;
}

export interface ForecastArtifactSummary {
  artifact_id: string;
  generated_at_utc: string;
  cutoff_at_utc: string;
  horizon_hours: number;
  forecasting_strategy: string;
  forecasting_strategy_version: string;
  score_version: string;
  total_candidate_topics: number;
  returned_topics_count: number;
  metadata: Record<string, unknown>;
}

export interface EmergingTrendsApiResponse {
  artifact: ForecastArtifactSummary;
  forecasts: EmergingTrendForecast[];
}

export interface ForecastingStatusResponse {
  status: string;
  artifact_available: boolean;
  artifact_id: string | null;
  cutoff_at_utc: string | null;
  generated_at_utc: string | null;
  total_candidate_topics: number;
  total_forecasts: number;
  forecasting_strategy: string | null;
  forecasting_strategy_version: string | null;
  score_version: string | null;
  horizon_hours: number;
  supported_horizons: number[];
  last_modified_utc: string | null;
}

export interface EmergingTrendsQueryParams {
  horizon_hours?: number;
  min_score?: number;
  tier?: ForecastTier | 'All';
  limit?: number;
}
