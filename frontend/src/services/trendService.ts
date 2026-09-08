/**
 * TRAJECT Trend Service
 *
 * Provides structured Trend entities joined with their authentic
 * associated Narratives synthesized from the underlying pipeline.
 * Zero mock data dependencies.
 */

import { telemetryApi } from './telemetryApi';
import type {
  TrendSummaryResponse,
  NarrativeSummaryResponse,
  TrendQueryParams,
  TrendListResponse,
} from '../types/api';

export interface TrendWithNarratives extends TrendSummaryResponse {
  cleanId: string;
  narratives: NarrativeSummaryResponse[];
}

/**
 * Normalizes an identifier by stripping topic_ or trend_ prefixes
 * e.g. "trend_089" -> "089", "topic_089" -> "089"
 */
export function getCleanTrendId(identifier: string): string {
  if (!identifier) return '';
  return identifier.replace(/^trend_|^topic_/, '');
}

/**
 * Normalizes a narrative identifier by stripping narrative_ prefix
 * e.g. "narrative_001" -> "001"
 */
export function getCleanNarrativeId(identifier: string): string {
  if (!identifier) return '';
  return identifier.replace(/^narrative_/, '');
}

export const trendService = {
  /**
   * Fetches trends and joins each with its authentic associated narratives.
   */
  async getTrendsWithNarratives(
    params?: TrendQueryParams,
    options?: { skipCache?: boolean }
  ): Promise<{
    trends: TrendWithNarratives[];
    meta: TrendListResponse['meta'];
  }> {
    // 1. Fetch trends
    const trendsRes = await telemetryApi.getTrends(params, options);

    // 2. Fetch all narrative candidates (safely, page_size <= 100)
    let allNarratives: NarrativeSummaryResponse[] = [];
    try {
      const firstNarrativesRes = await telemetryApi.getNarratives({ page: 1, page_size: 100 }, options);
      allNarratives = [...(firstNarrativesRes.data || [])];

      if (firstNarrativesRes.meta && firstNarrativesRes.meta.total_pages > 1) {
        const remainingPages: Promise<any>[] = [];
        for (let p = 2; p <= firstNarrativesRes.meta.total_pages; p++) {
          remainingPages.push(
            telemetryApi.getNarratives({ page: p, page_size: 100 }, options)
          );
        }
        const rest = await Promise.all(remainingPages);
        for (const r of rest) {
          allNarratives.push(...(r.data || []));
        }
      }
    } catch (narrativeErr) {
      console.warn('Unable to load full narrative associations for trends:', narrativeErr);
    }

    // 2. Build index of narratives by promoted_from_topic_id and narrative_id
    const narrativesByCleanId = new Map<string, NarrativeSummaryResponse[]>();
    for (const narrative of allNarratives) {
      const cleanPromotedId = getCleanTrendId(narrative.promoted_from_topic_id);
      const rawPromotedId = narrative.promoted_from_topic_id?.trim() || '';

      const existingClean = narrativesByCleanId.get(cleanPromotedId) || [];
      existingClean.push(narrative);
      narrativesByCleanId.set(cleanPromotedId, existingClean);

      if (rawPromotedId && rawPromotedId !== cleanPromotedId) {
        const existingRaw = narrativesByCleanId.get(rawPromotedId) || [];
        if (!existingRaw.some((x) => x.narrative_id === narrative.narrative_id)) {
          existingRaw.push(narrative);
          narrativesByCleanId.set(rawPromotedId, existingRaw);
        }
      }
    }

    const narrativeById = new Map<string, NarrativeSummaryResponse>();
    for (const narrative of allNarratives) {
      narrativeById.set(narrative.narrative_id, narrative);
    }

    // 3. Attach authentic narratives to each Trend parent
    const trends: TrendWithNarratives[] = trendsRes.data.map((trend) => {
      const cleanId = getCleanTrendId(trend.trend_id || trend.topic_id);

      const matchedNarratives: NarrativeSummaryResponse[] = [];
      const seenIds = new Set<string>();

      // A. Match by associated_narrative_ids from backend
      if (trend.associated_narrative_ids && trend.associated_narrative_ids.length > 0) {
        for (const nid of trend.associated_narrative_ids) {
          const n = narrativeById.get(nid);
          if (n && !seenIds.has(n.narrative_id)) {
            matchedNarratives.push(n);
            seenIds.add(n.narrative_id);
          }
        }
      }

      // B. Match by clean ID, topic_id, or trend_id
      const candidateKeys = [cleanId, trend.topic_id, trend.trend_id].filter(Boolean) as string[];
      for (const key of candidateKeys) {
        const byKey = narrativesByCleanId.get(key) || [];
        for (const n of byKey) {
          if (!seenIds.has(n.narrative_id)) {
            matchedNarratives.push(n);
            seenIds.add(n.narrative_id);
          }
        }
      }

      // Sort deterministically by priority_signal_score descending
      matchedNarratives.sort((a, b) => b.priority_signal_score - a.priority_signal_score);

      return {
        ...trend,
        cleanId,
        narratives: matchedNarratives,
      };
    });

    return {
      trends,
      meta: trendsRes.meta,
    };
  },
};
