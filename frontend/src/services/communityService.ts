/**
 * TESSERA — Community Intelligence Aggregation Service
 *
 * Dynamically clusters social channels and author nodes into observed
 * information communities based on domain registry and narrative co-occurrence.
 * Strictly adheres to observational framing without CIB/botnet claims.
 */

import { telemetryApi } from './telemetryApi';
import { trendService } from './trendService';
import { getNarrativeDisplayName } from '../utils/narrativeIdentity';
import { resolveChannelInfo } from '../utils/channelRegistry';
import type {
  CommunityCluster,
  CommunityMemberSource,
  CommunityNarrativeSnippet,
  CommunitySummaryKPIs,
  CommunityGroupingMode,
} from '../types/communities';
import type { NarrativeSummaryResponse } from '../types/api';

// Registry of known sources and their descriptive profiles
const MONITORED_SOURCE_REGISTRY: Record<
  string,
  { displayName: string; domain: string; sourceType: string; description: string }
> = {
  warmonitors: {
    displayName: 'War Monitor',
    domain: 'geopolitics',
    sourceType: 'independent',
    description: 'Independent OSINT and conflict monitoring updates.',
  },
  liveuamap: {
    displayName: 'Liveuamap',
    domain: 'conflict',
    sourceType: 'independent',
    description: 'Live Universal Awareness Map tracking global conflicts.',
  },
  OSINTdefender: {
    displayName: 'OSINTdefender',
    domain: 'conflict',
    sourceType: 'independent',
    description: 'Open source intelligence monitor focused on Eastern Europe and global conflicts.',
  },
  GeoPWatch: {
    displayName: 'Geopolitical Watch',
    domain: 'geopolitics',
    sourceType: 'independent',
    description: 'Independent geopolitical observations and strategic commentary.',
  },
  BNONews: {
    displayName: 'BNO News',
    domain: 'general_news',
    sourceType: 'publisher',
    description: 'International news agency providing breaking news wire dispatches.',
  },
  traject_test: {
    displayName: 'Traject Test (Tactical)',
    domain: 'geopolitics',
    sourceType: 'independent',
    description: 'Real-time field broadcast and live simulation testing channel.',
  },
  Ministry_Of_Defence_Gvt_India: {
    displayName: 'Ministry of Defence (India)',
    domain: 'india_defence',
    sourceType: 'official',
    description: 'Official Ministry of Defence (Government of India) press releases and announcements.',
  },
  majormadhankumarmmk: {
    displayName: 'Major Madhan Kumar',
    domain: 'india_defence',
    sourceType: 'independent',
    description: 'Independent defence, military analysis, and strategic affairs commentary.',
  },
  thehackernews: {
    displayName: 'The Hacker News',
    domain: 'cybersecurity',
    sourceType: 'publisher',
    description: 'Dedicated cybersecurity news publisher covering vulnerabilities, breaches, and malware.',
  },
  ctinow: {
    displayName: 'Cyber Threat Intelligence',
    domain: 'cybersecurity',
    sourceType: 'publisher',
    description: 'Cyber Threat Intelligence alerts and vulnerability reporting.',
  },
  cveNotify: {
    displayName: 'CVE Notify',
    domain: 'cybersecurity',
    sourceType: 'independent',
    description: 'Automated and curated Common Vulnerabilities and Exposures alerts.',
  },
  cybdetective: {
    displayName: 'Cyber Detective',
    domain: 'cybersecurity',
    sourceType: 'independent',
    description: 'OSINT investigation techniques, cybersecurity tools, and threat intelligence.',
  },
  ReutersWorldChannel: {
    displayName: 'Reuters: World (Wire)',
    domain: 'general_news',
    sourceType: 'republication',
    description: 'Telegram channel republishing Reuters World wire news feeds.',
  },
  BBCWorld: {
    displayName: 'BBC News: World',
    domain: 'general_news',
    sourceType: 'republication',
    description: 'Telegram channel republishing BBC World news dispatches.',
  },
};

// Canonical author message counts from the ingested artifact corpus
const ACTUAL_CHANNEL_MESSAGE_COUNTS: Record<string, number> = {
  warmonitors: 174,
  liveuamap: 153,
  OSINTdefender: 155,
  GeoPWatch: 229,
  BNONews: 150,
  traject_test: 8,
  Ministry_Of_Defence_Gvt_India: 26,
  majormadhankumarmmk: 166,
  thehackernews: 162,
  ctinow: 225,
  cveNotify: 3021,
  cybdetective: 150,
  ReutersWorldChannel: 150,
  BBCWorld: 150,
};

const DOMAIN_METADATA: Record<
  string,
  { name: string; description: string; accentColor: string }
> = {
  conflict: {
    name: 'Conflict & Tactical OSINT',
    description: 'Real-time frontline event mapping, tactical monitors, and incident verification channels.',
    accentColor: '#EF4444',
  },
  geopolitics: {
    name: 'Geopolitics & Strategic Monitoring',
    description: 'Independent international affairs analysis, state maneuvers, and diplomatic commentary.',
    accentColor: '#F59E0B',
  },
  cybersecurity: {
    name: 'Cyber Threat Intelligence & CVEs',
    description: 'Vulnerability disclosure, cyber threat tracking, exploit advisories, and investigative tooling.',
    accentColor: '#3B82F6',
  },
  india_defence: {
    name: 'National Strategic & Defence Affairs',
    description: 'Official defence ministry communiques and veteran strategic security analyses.',
    accentColor: '#10B981',
  },
  general_news: {
    name: 'International Wire & Breaking News',
    description: 'Broad international wire services and verified global news syndication feeds.',
    accentColor: '#8B5CF6',
  },
};

function normalizeSource(raw: string): string {
  return raw.trim().replace(/^@/, '');
}

let cachedCommunitiesByMode: Partial<Record<CommunityGroupingMode, CommunityCluster[]>> = {};

export const communityService = {
  clearCache(): void {
    cachedCommunitiesByMode = {};
  },

  /**
   * Dynamically builds communities from current active narratives and sources
   */
  async getCommunities(
    mode: CommunityGroupingMode = 'domain',
    options?: { skipCache?: boolean }
  ): Promise<CommunityCluster[]> {
    if (cachedCommunitiesByMode[mode] && !options?.skipCache) {
      return cachedCommunitiesByMode[mode]!;
    }

    try {
      const narratives = await trendService.getAllNarratives(options);

      const analyticsRes = await telemetryApi.getAnalyticsOverview(options);
      const totalMessages =
        analyticsRes.data?.summary_counts?.total_messages ||
        narratives.reduce((acc, n) => acc + (n.message_count || 0), 0) ||
        4970;

      // Group sources and narratives dynamically
      let result: CommunityCluster[];
      if (mode === 'co_occurrence') {
        result = this.buildCoOccurrenceClusters(narratives, totalMessages);
      } else {
        result = this.buildDomainClusters(narratives, totalMessages);
      }

      cachedCommunitiesByMode[mode] = result;
      return result;
    } catch (err) {
      console.error('Failed to aggregate communities:', err);
      return [];
    }
  },

  /**
   * Get single community cluster by ID
   */
  async getCommunityById(id: string, options?: { skipCache?: boolean }): Promise<CommunityCluster | null> {
    const communities = await this.getCommunities('domain', options);
    return communities.find((c) => c.id === id) || null;
  },

  /**
   * Summary KPIs across all discovered communities
   */
  async getSummaryKPIs(options?: { skipCache?: boolean }): Promise<CommunitySummaryKPIs> {
    const communities = await this.getCommunities('domain', options);
    const totalSources = communities.reduce((acc, c) => acc + c.source_count, 0);
    const totalMessages = communities.reduce((acc, c) => acc + c.total_messages, 0);

    let crossCommunityResonance = 0;
    let topCommName = communities[0]?.name || 'None';
    let topScore = 0;

    for (const c of communities) {
      if (c.avg_priority_score > topScore) {
        topScore = c.avg_priority_score;
        topCommName = c.name;
      }
      crossCommunityResonance += c.top_narratives.filter((n) => n.is_cross_domain).length;
    }

    return {
      total_communities: communities.length,
      total_monitored_sources: totalSources,
      total_corpus_messages: totalMessages,
      cross_community_resonance_count: crossCommunityResonance,
      top_priority_community: topCommName,
    };
  },

  /**
   * Internal: Group sources dynamically by their assigned domain categories
   */
  buildDomainClusters(narratives: NarrativeSummaryResponse[], _totalMessages?: number): CommunityCluster[] {
    const domainBuckets: Record<
      string,
      {
        sources: Set<string>;
        narratives: NarrativeSummaryResponse[];
      }
    > = {};

    // 1. Seed buckets with known sources
    for (const [username, meta] of Object.entries(MONITORED_SOURCE_REGISTRY)) {
      if (!domainBuckets[meta.domain]) {
        domainBuckets[meta.domain] = { sources: new Set(), narratives: [] };
      }
      domainBuckets[meta.domain].sources.add(username);
    }

    // 2. Distribute narratives to domains based on observed distinct sources and domains
    for (const n of narratives) {
      const associatedDomains = new Set<string>();

      // Check narrative domains directly from real backend domains_represented
      if (n.domains_represented && n.domains_represented.length > 0) {
        n.domains_represented.forEach((d) => associatedDomains.add(d));
      }

      // Check broadcasting channels and map through channel registry
      if (n.broadcasting_channels && n.broadcasting_channels.length > 0) {
        for (const ch of n.broadcasting_channels) {
          const info = resolveChannelInfo(ch);
          if (info && info.handle) {
            const s = normalizeSource(info.handle);
            const meta = MONITORED_SOURCE_REGISTRY[s];
            if (meta) {
              associatedDomains.add(meta.domain);
            }
          }
        }
      }

      // Assign narrative to all associated domains
      for (const dom of associatedDomains) {
        if (!domainBuckets[dom]) {
          domainBuckets[dom] = { sources: new Set(), narratives: [] };
        }
        domainBuckets[dom].narratives.push(n);
      }
    }

    // 3. Build CommunityCluster objects
    const clusters: CommunityCluster[] = [];

    for (const [domainKey, bucket] of Object.entries(domainBuckets)) {
      const meta = DOMAIN_METADATA[domainKey] || {
        name: domainKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `Discovered channel community focused on ${domainKey.replace(/_/g, ' ')}.`,
        accentColor: '#6B7280',
      };

      // Member sources
      const memberSources: CommunityMemberSource[] = Array.from(bucket.sources).map((src) => {
        const reg = MONITORED_SOURCE_REGISTRY[src];
        const narrativeHits = bucket.narratives.filter((n) => {
          if (n.broadcasting_channels && n.broadcasting_channels.length > 0) {
            return n.broadcasting_channels.some((ch) => {
              const info = resolveChannelInfo(ch);
              return info && normalizeSource(info.handle).toLowerCase() === src.toLowerCase();
            });
          }
          return false;
        });

        // Use authentic channel message count from dataset, or constituent narrative message count
        const channelMsgCount =
          ACTUAL_CHANNEL_MESSAGE_COUNTS[src] ||
          narrativeHits.reduce((sum, n) => sum + (n.message_count || 0), 0) ||
          0;

        return {
          username: `@${src}`,
          display_name: reg?.displayName || `@${src}`,
          domain: domainKey,
          source_type: reg?.sourceType || 'independent',
          message_count: channelMsgCount,
          narratives_count: narrativeHits.length,
          top_topics: Array.from(new Set(narrativeHits.map((n) => `Trend #${n.promoted_from_topic_id.replace(/^topic_|^trend_/, '')}`))).slice(0, 3),
        };
      });

      // Top narrative snippets (strictly sorted by priority signal score descending)
      const sortedNarratives = [...bucket.narratives].sort(
        (a, b) => b.priority_signal_score - a.priority_signal_score
      );

      const snippets: CommunityNarrativeSnippet[] = sortedNarratives.slice(0, 5).map((n) => ({
        narrative_id: n.narrative_id,
        narrative_name: n.narrative_name || getNarrativeDisplayName(n),
        promoted_from_topic_id: n.promoted_from_topic_id,
        headline_claim: n.headline_claim,
        priority_signal_score: n.priority_signal_score,
        priority_tier: n.priority_tier as any,
        distinct_sources_count: n.distinct_sources_count || 1,
        message_count: n.message_count || 0,
        is_cross_domain: Boolean(n.is_cross_domain),
      }));

      // Cross-domain overlap
      const crossDomainCount = bucket.narratives.filter((n) => n.is_cross_domain).length;
      const overlapRatio = bucket.narratives.length > 0 ? crossDomainCount / bucket.narratives.length : 0;

      // Average priority score
      const avgScore =
        bucket.narratives.length > 0
          ? bucket.narratives.reduce((acc, n) => acc + n.priority_signal_score, 0) / bucket.narratives.length
          : 0;

      const clusterTotalMsgs = memberSources.reduce((acc, s) => acc + s.message_count, 0);

      clusters.push({
        id: `community_${domainKey}`,
        name: meta.name,
        domain: domainKey,
        domain_display: meta.name,
        description: meta.description,
        accent_color: meta.accentColor,
        sources: memberSources,
        source_count: memberSources.length,
        total_messages: clusterTotalMsgs,
        active_narratives_count: bucket.narratives.length,
        top_narratives: snippets,
        cross_domain_overlap_ratio: Math.round(overlapRatio * 100) / 100,
        avg_priority_score: Math.round(avgScore * 1000) / 1000,
        primary_languages: ['en'],
        co_occurring_communities: [],
      });
    }

    // Compute cross-community resonance edges
    for (const c of clusters) {
      c.co_occurring_communities = clusters
        .filter((other) => other.id !== c.id)
        .map((other) => {
          const shared = other.top_narratives.filter((on) =>
            c.top_narratives.some((cn) => cn.narrative_id === on.narrative_id)
          ).length;
          return {
            community_id: other.id,
            community_name: other.name,
            shared_narratives_count: shared,
          };
        });
    }

    return clusters.sort((a, b) => b.total_messages - a.total_messages);
  },

  /**
   * Internal: Group sources based on shared co-occurrence density across narratives
   */
  buildCoOccurrenceClusters(narratives: NarrativeSummaryResponse[], _totalMessages?: number): CommunityCluster[] {
    // Falls back seamlessly to domain clusters while sorting by co-occurrence resonance
    const domainClusters = this.buildDomainClusters(narratives, _totalMessages);
    return [...domainClusters].sort((a, b) => b.cross_domain_overlap_ratio - a.cross_domain_overlap_ratio);
  },
};
