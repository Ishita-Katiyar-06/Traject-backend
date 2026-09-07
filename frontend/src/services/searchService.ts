/**
 * TRAJECT Global Search Service (Milestone 5B)
 *
 * Backed by the real Milestone 5A telemetry API (telemetryApi.ts).
 * Searches precomputed narratives and semantic topic clusters.
 * Zero mock data dependencies.
 */

import { telemetryApi } from './telemetryApi';
import type { NarrativeSummaryResponse, TopicSummaryResponse } from '../types/api';

export type SearchCategory = 'Topics' | 'Narratives' | 'Communities' | 'Investigations';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  route: string;
}

export const searchService = {
  /**
   * Search real 5A narrative and topic entities
   */
  async search(query: string): Promise<SearchResultItem[]> {
    try {
      const [narrativesRes, topicsRes] = await Promise.all([
        telemetryApi.getNarratives({ page: 1, page_size: 50, sort_by: 'priority_signal_score', order: 'desc' }),
        telemetryApi.getTopics({ page: 1, page_size: 50, sort_by: 'message_count', order: 'desc' }),
      ]);

      const q = query.trim().toLowerCase();

      if (!q) {
        return this.buildDefaultResults(narrativesRes.data, topicsRes.data);
      }

      const results: SearchResultItem[] = [];

      // 1. Match Narrative candidates
      for (const n of narrativesRes.data) {
        const matchesClaim = n.headline_claim.toLowerCase().includes(q);
        const matchesId = n.narrative_id.toLowerCase().includes(q);
        const matchesTopic = n.promoted_from_topic_id.toLowerCase().includes(q);

        if (matchesClaim || matchesId || matchesTopic) {
          results.push({
            id: n.narrative_id,
            category: 'Narratives',
            title: n.headline_claim,
            subtitle: `Priority: ${n.priority_tier.toUpperCase()} (${n.priority_signal_score.toFixed(3)}) • ${n.message_count} msgs • Topic #${n.promoted_from_topic_id}`,
            route: `/narratives/${encodeURIComponent(n.narrative_id)}`,
          });
        }
      }

      // 2. Match Topic clusters
      for (const t of topicsRes.data) {
        const matchesId = t.topic_id.toLowerCase().includes(q);
        const keywords = t.representative_keywords.map((k) => k.keyword.toLowerCase());
        const matchesKeyword = keywords.some((k) => k.includes(q));

        if (matchesId || matchesKeyword) {
          const kwList = t.representative_keywords.slice(0, 3).map((k) => k.keyword).join(', ');
          results.push({
            id: t.topic_id,
            category: 'Topics',
            title: `Topic Cluster #${t.topic_id}`,
            subtitle: `${t.message_count} observations (${t.percentage_of_dataset.toFixed(1)}%) • Keywords: ${kwList}`,
            route: `/topics/${encodeURIComponent(t.topic_id)}`,
          });
        }
      }

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
    topics: TopicSummaryResponse[]
  ): SearchResultItem[] {
    const defaultItems: SearchResultItem[] = [];

    // Top 3 Narratives by Priority Signal Score
    for (const n of narratives.slice(0, 3)) {
      defaultItems.push({
        id: n.narrative_id,
        category: 'Narratives',
        title: n.headline_claim,
        subtitle: `Priority: ${n.priority_tier.toUpperCase()} (${n.priority_signal_score.toFixed(3)}) • ${n.message_count} msgs`,
        route: `/narratives/${encodeURIComponent(n.narrative_id)}`,
      });
    }

    // Top 3 Topics by message count
    for (const t of topics.slice(0, 3)) {
      const kwList = t.representative_keywords.slice(0, 3).map((k) => k.keyword).join(', ');
      defaultItems.push({
        id: t.topic_id,
        category: 'Topics',
        title: `Topic Cluster #${t.topic_id}`,
        subtitle: `${t.message_count} observations • Keywords: ${kwList}`,
        route: `/topics/${encodeURIComponent(t.topic_id)}`,
      });
    }

    return defaultItems;
  },
};
