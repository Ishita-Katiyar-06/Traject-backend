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

/**
 * Robust matching helper for Trend search queries.
 * Supports:
 * - Trend IDs: "#89", "89", "089", "#089", "trend 89", "trend #89", "trend_089", "topic 89", "topic_089"
 * - Narrative IDs: "#001", "001", "narrative 1", "narrative_001"
 * - Keywords: "biden", "election", "rocket", "energy", etc.
 * - Trend name & summary text matches
 * - Narrative headline & summary text matches
 */
export function matchesTrendSearch(trend: TrendWithNarratives, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;
  const q = rawQuery.trim().toLowerCase();

  // 1. Check direct trend name & summary
  if (trend.trend_name && trend.trend_name.toLowerCase().includes(q)) return true;
  if (trend.trend_summary && trend.trend_summary.toLowerCase().includes(q)) return true;

  // 2. Check representative keywords
  if (
    trend.representative_keywords &&
    trend.representative_keywords.some((k) => k.keyword && k.keyword.toLowerCase().includes(q))
  ) {
    return true;
  }

  // 3. Direct identifier string contains
  if (trend.cleanId && trend.cleanId.toLowerCase().includes(q)) return true;
  if (trend.trend_id && trend.trend_id.toLowerCase().includes(q)) return true;
  if (trend.topic_id && trend.topic_id.toLowerCase().includes(q)) return true;

  // 4. Normalized Trend ID / Numeric Matching
  // Strips leading hashes, words like "trend", "topic", spaces, dashes, underscores
  const strippedTrendQuery = q
    .replace(/^#+/, '')
    .replace(/^(trend|topic)[_\s#-]?/i, '')
    .trim();

  if (strippedTrendQuery) {
    const cleanLower = trend.cleanId.toLowerCase();
    // Substring or exact match on stripped query
    if (cleanLower === strippedTrendQuery || cleanLower.endsWith(strippedTrendQuery)) {
      return true;
    }
    // Integer numeric match (e.g. searching "89" matches cleanId "089")
    const qInt = parseInt(strippedTrendQuery, 10);
    const trendInt = parseInt(trend.cleanId, 10);
    if (!isNaN(qInt) && !isNaN(trendInt) && qInt === trendInt) {
      return true;
    }
  }

  // 5. Check associated narratives
  if (trend.narratives && trend.narratives.length > 0) {
    for (const n of trend.narratives) {
      if (n.headline_claim && n.headline_claim.toLowerCase().includes(q)) return true;
      if (n.narrative_name && n.narrative_name.toLowerCase().includes(q)) return true;
      if (n.narrative_summary && n.narrative_summary.toLowerCase().includes(q)) return true;
      if (n.narrative_id && n.narrative_id.toLowerCase().includes(q)) return true;

      const cleanNid = getCleanNarrativeId(n.narrative_id);
      if (cleanNid && cleanNid.toLowerCase().includes(q)) return true;

      const strippedNarrativeQuery = q
        .replace(/^#+/, '')
        .replace(/^narrative[_\s#-]?/i, '')
        .trim();

      if (strippedNarrativeQuery) {
        const nInt = parseInt(cleanNid, 10);
        const qnInt = parseInt(strippedNarrativeQuery, 10);
        if (!isNaN(nInt) && !isNaN(qnInt) && nInt === qnInt) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Joins raw trend clusters with their authentic synthesized narratives.
 */
function joinTrendsWithNarratives(
  rawTrends: TrendSummaryResponse[],
  allNarratives: NarrativeSummaryResponse[]
): TrendWithNarratives[] {
  // Build index of narratives by promoted_from_topic_id and narrative_id
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

  return rawTrends.map((trend) => {
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
}

/** In-memory cache of all trends joined with narratives */
let cachedAllTrends: TrendWithNarratives[] | null = null;
let cachedAllNarratives: NarrativeSummaryResponse[] | null = null;

export const trendService = {
  /**
   * Resets local in-memory trend and narrative cache
   */
  clearCache(): void {
    cachedAllTrends = null;
    cachedAllNarratives = null;
  },

  /**
   * Fetches all narratives across all pages and caches in-memory
   */
  async getAllNarratives(options?: { skipCache?: boolean }): Promise<NarrativeSummaryResponse[]> {
    if (cachedAllNarratives && !options?.skipCache) {
      return cachedAllNarratives;
    }

    let allNarratives: NarrativeSummaryResponse[] = [];
    try {
      const firstRes = await telemetryApi.getNarratives({ page: 1, page_size: 100 }, options);
      allNarratives = [...(firstRes.data || [])];

      if (firstRes.meta && firstRes.meta.total_pages > 1) {
        const remainingPages: Promise<any>[] = [];
        for (let p = 2; p <= firstRes.meta.total_pages; p++) {
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
      console.warn('Unable to load full narrative list:', narrativeErr);
    }

    cachedAllNarratives = allNarratives;
    return allNarratives;
  },

  /**
   * Fetches paginated trends and joins each with its authentic associated narratives.
   */
  async getTrendsWithNarratives(
    params?: TrendQueryParams,
    options?: { skipCache?: boolean }
  ): Promise<{
    trends: TrendWithNarratives[];
    meta: TrendListResponse['meta'];
  }> {
    const trendsRes = await telemetryApi.getTrends(params, options);
    const allNarratives = await this.getAllNarratives(options);
    const trends = joinTrendsWithNarratives(trendsRes.data, allNarratives);

    return {
      trends,
      meta: trendsRes.meta,
    };
  },

  /**
   * Fetches the complete catalog of all trends across all pages (345 trends),
   * joins with narratives, and caches for instantaneous global client-side searching.
   */
  async getAllTrendsWithNarratives(
    options?: { skipCache?: boolean }
  ): Promise<TrendWithNarratives[]> {
    if (cachedAllTrends && !options?.skipCache) {
      return cachedAllTrends;
    }

    // 1. Fetch page 1 (up to 100 items)
    const firstTrendsRes = await telemetryApi.getTrends(
      { page: 1, page_size: 100, sort_by: 'message_count', order: 'desc' },
      options
    );

    let allRawTrends: TrendSummaryResponse[] = [...(firstTrendsRes.data || [])];

    // 2. Fetch remaining pages if any
    if (firstTrendsRes.meta && firstTrendsRes.meta.total_pages > 1) {
      const pageRequests: Promise<TrendListResponse>[] = [];
      for (let p = 2; p <= firstTrendsRes.meta.total_pages; p++) {
        pageRequests.push(
          telemetryApi.getTrends(
            { page: p, page_size: 100, sort_by: 'message_count', order: 'desc' },
            options
          )
        );
      }
      const restResults = await Promise.all(pageRequests);
      for (const res of restResults) {
        if (res.data) {
          allRawTrends.push(...res.data);
        }
      }
    }

    // 3. Fetch all narratives & join
    const allNarratives = await this.getAllNarratives(options);
    const joinedTrends = joinTrendsWithNarratives(allRawTrends, allNarratives);

    cachedAllTrends = joinedTrends;
    return joinedTrends;
  },
};
