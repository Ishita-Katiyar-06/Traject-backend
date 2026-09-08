/**
 * Milestone 8F: Emerging Trend Forecasting API Service
 *
 * Provides typed functions consuming the frozen backend Milestone 8E endpoints:
 * - GET /api/v1/forecasting/emerging-trends
 * - GET /api/v1/forecasting/status
 *
 * Centralizes all HTTP communication through TRAJECT's existing apiClient.
 * Zero client-side score, percentile, or trajectory calculations.
 */

import { apiClient, type RequestOptions } from './apiClient.ts';
import type {
  EmergingTrendsApiResponse,
  ForecastingStatusResponse,
  EmergingTrendsQueryParams,
} from '../types/forecasting';

export const forecastService = {
  /**
   * Retrieve precomputed emerging trend forecasts matching query parameters.
   * Endpoints serve directly from the validated backend batch artifact.
   */
  async getEmergingTrends(
    params?: EmergingTrendsQueryParams,
    options?: RequestOptions
  ): Promise<EmergingTrendsApiResponse> {
    const queryParams: Record<string, unknown> = {};

    if (params) {
      if (params.horizon_hours !== undefined) {
        queryParams.horizon_hours = params.horizon_hours;
      }
      if (params.min_score !== undefined && params.min_score > 0) {
        queryParams.min_score = params.min_score;
      }
      if (params.tier && params.tier !== 'All') {
        queryParams.tier = params.tier;
      }
      if (params.limit !== undefined) {
        queryParams.limit = params.limit;
      }
    }

    const qs = apiClient.buildQueryString(queryParams);
    return apiClient.get<EmergingTrendsApiResponse>(`/forecasting/emerging-trends${qs}`, {
      cacheTtlMs: 10000,
      ...options,
    });
  },

  /**
   * Check forecasting subsystem operational health, availability, and provenance metadata.
   */
  async getForecastingStatus(
    options?: RequestOptions
  ): Promise<ForecastingStatusResponse> {
    return apiClient.get<ForecastingStatusResponse>('/forecasting/status', {
      cacheTtlMs: 5000,
      ...options,
    });
  },

  /**
   * Invalidate cached forecasting responses.
   */
  clearCache(): void {
    // Cache clearing is handled at the apiClient layer
  },
};
