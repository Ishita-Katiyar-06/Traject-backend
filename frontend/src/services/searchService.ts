/**
 * TRAJECT Global Search Service (Milestone 5B)
 *
 * Backed by the real Milestone 5A telemetry API (telemetryApi.ts).
 * Searches precomputed narratives and semantic topic clusters.
 * Zero mock data dependencies.
 */

import { telemetryApi } from './telemetryApi';
import type { NarrativeSummaryResponse, TopicSummaryResponse, TrendSummaryResponse } from '../types/api';

export type SearchCategory = 'Trends' | 'Narratives' | 'Communities';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  route: string;
}

export const searchService = {
  /**
   * Search real 5A narrative and trend entities
   */
  async search(query: string): Promise<SearchResultItem[]> {
    try {
      const [narrativesRes, topicsRes] = await Promise.all([
        telemetryApi.getNarratives({ page: 1, page_size: 50, sort_by: 'priority_signal_score', order: 'desc' }),
        telemetryApi.getTrends({ page: 1, page_size: 50, sort_by: 'message_count', order: 'desc' }),
      ]);

      const q = query.trim().toLowerCase();

      if (!q) {
        return this.buildDefaultResults(narrativesRes.data, topicsRes.data);
      }

      const results: SearchResultItem[] = [];

      // 1. Match Narrative candidates
      for (const n of narrativesRes.data) {
        const matchesName = n.narrative_name?.toLowerCase().includes(q);
        const matchesClaim = n.headline_claim.toLowerCase().includes(q);
        const matchesId = n.narrative_id.toLowerCase().includes(q);
        const matchesTopic = n.promoted_from_topic_id.toLowerCase().includes(q);

        if (matchesName || matchesClaim || matchesId || matchesTopic) {
          const cleanParentId = n.promoted_from_topic_id.replace(/^topic_|^trend_/, '');
          results.push({
            id: n.narrative_id,
            category: 'Narratives',
            title: n.narrative_name || n.headline_claim,
            subtitle: `${n.narrative_id.toUpperCase()} • Priority: ${n.priority_tier.toUpperCase()} (${n.priority_signal_score.toFixed(3)}) • ${n.message_count} msgs • Trend #${cleanParentId}`,
            route: `/narratives/${encodeURIComponent(n.narrative_id)}`,
          });
        }
      }

      // 2. Match Trend clusters
      const trendList = (topicsRes.data || []) as (TrendSummaryResponse | TopicSummaryResponse)[];
      for (const t of trendList) {
        const trendId = 'trend_id' in t ? t.trend_id : t.topic_id;
        const cleanId = (trendId || t.topic_id).replace(/^topic_|^trend_/, '');
        const trendName = t.trend_name || '';
        const matchesName = trendName.toLowerCase().includes(q);
        const matchesSummary = (t.trend_summary || '').toLowerCase().includes(q);
        const matchesId =
          t.topic_id.toLowerCase().includes(q) ||
          trendId.toLowerCase().includes(q) ||
          cleanId.toLowerCase().includes(q);
        const keywords = t.representative_keywords.map((k) => k.keyword.toLowerCase());
        const matchesKeyword = keywords.some((k) => k.includes(q));

        if (matchesName || matchesSummary || matchesId || matchesKeyword) {
          const kwList = t.representative_keywords.slice(0, 3).map((k) => k.keyword).join(', ');
          results.push({
            id: trendId,
            category: 'Trends',
            title: trendName ? `Trend #${cleanId} — ${trendName}` : `Trend #${cleanId}`,
            subtitle: `${t.message_count} observations (${t.percentage_of_dataset.toFixed(1)}%) • Keywords: ${kwList}`,
            route: `/trends/${encodeURIComponent(trendId)}`,
          });
        }
      }

      // 3. Match Community clusters
      try {
        const { communityService } = await import('./communityService');
        const communities = await communityService.getCommunities();
        for (const c of communities) {
          const matchesName = c.name.toLowerCase().includes(q);
          const matchesDomain = c.domain_display.toLowerCase().includes(q);
          const matchesSource = c.sources.some((s) => s.username.toLowerCase().includes(q) || s.display_name.toLowerCase().includes(q));
          if (matchesName || matchesDomain || matchesSource) {
            results.push({
              id: c.id,
              category: 'Communities',
              title: c.name,
              subtitle: `${c.domain_display} • ${c.source_count} sources • ${c.total_messages.toLocaleString()} messages`,
              route: `/communities/${encodeURIComponent(c.id)}`,
            });
          }
        }
      } catch (_) {}

      return results;
    } catch (err) {
      console.warn('Global search query encountered an error:', err);
      return [];
    }
  },

  /**
   * Return top prioritized entities when search input is empty
   */
  buildDefaultResults(
    narratives: NarrativeSummaryResponse[],
    topics: (TrendSummaryResponse | TopicSummaryResponse)[]
  ): SearchResultItem[] {
    const defaultItems: SearchResultItem[] = [];

    // Top 3 Narratives by Priority Signal Score
    for (const n of narratives.slice(0, 3)) {
      defaultItems.push({
        id: n.narrative_id,
        category: 'Narratives',
        title: n.narrative_name || n.headline_claim,
        subtitle: `${n.narrative_id.toUpperCase()} • Priority: ${n.priority_tier.toUpperCase()} (${n.priority_signal_score.toFixed(3)}) • ${n.message_count} msgs`,
        route: `/narratives/${encodeURIComponent(n.narrative_id)}`,
      });
    }

    // Top 3 Trends by message count
    for (const t of topics.slice(0, 3)) {
      const trendId = 'trend_id' in t ? (t as any).trend_id : t.topic_id;
      const cleanId = (trendId || t.topic_id).replace(/^topic_|^trend_/, '');
      const kwList = t.representative_keywords.slice(0, 3).map((k) => k.keyword).join(', ');
      defaultItems.push({
        id: trendId,
        category: 'Trends',
        title: t.trend_name ? `Trend #${cleanId} — ${t.trend_name}` : `Trend #${cleanId}`,
        subtitle: `${t.message_count} observations • Keywords: ${kwList}`,
        route: `/trends/${encodeURIComponent(trendId)}`,
      });
    }

    return defaultItems;
  },
};
