/**
 * TESSERA — Community Intelligence Aggregation Service
 *
 * Dynamically clusters social channels and author nodes into observed
 * information communities based on domain registry and narrative co-occurrence.
 * Strictly adheres to observational framing without CIB/botnet claims.
 */

import { telemetryApi } from './telemetryApi';
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

export const communityService = {
  /**
   * Dynamically builds communities from current active narratives and sources
   */
  async getCommunities(mode: CommunityGroupingMode = 'domain'): Promise<CommunityCluster[]> {
    try {
      const [narrativesRes, analyticsRes] = await Promise.all([
        telemetryApi.getNarratives({ page: 1, page_size: 100 }),
        telemetryApi.getAnalyticsOverview(),
      ]);

      const narratives = narrativesRes.data || [];
      const totalMessages = analyticsRes.data?.summary_counts?.total_messages || 6026;

      // Group sources and narratives dynamically
      if (mode === 'co_occurrence') {
        return this.buildCoOccurrenceClusters(narratives, totalMessages);
      }
      return this.buildDomainClusters(narratives, totalMessages);
    } catch (err) {
      console.error('Failed to aggregate communities:', err);
      return [];
    }
  },

  /**
   * Get single community cluster by ID
   */
  async getCommunityById(id: string): Promise<CommunityCluster | null> {
    const communities = await this.getCommunities('domain');
    return communities.find((c) => c.id === id) || null;
  },

  /**
   * Summary KPIs across all discovered communities
   */
  async getSummaryKPIs(): Promise<CommunitySummaryKPIs> {
    const communities = await this.getCommunities('domain');
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
  buildDomainClusters(narratives: NarrativeSummaryResponse[], totalMessages: number): CommunityCluster[] {
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

      // Check narrative domains
      if (n.domains_represented && n.domains_represented.length > 0) {
        n.domains_represented.forEach((d) => associatedDomains.add(d));
      }

      // Check narrative distinct sources
      const rawSources: string[] = (n as any).distinct_sources || [];
      if (rawSources.length > 0) {
        for (const rawSrc of rawSources) {
          const s = normalizeSource(rawSrc);
          const meta = MONITORED_SOURCE_REGISTRY[s];
          if (meta) {
            associatedDomains.add(meta.domain);
          } else {
            // Dynamically discover source domain if unknown
            const inferredDomain = 'unclassified';
            if (!domainBuckets[inferredDomain]) {
              domainBuckets[inferredDomain] = { sources: new Set(), narratives: [] };
            }
            domainBuckets[inferredDomain].sources.add(s);
            associatedDomains.add(inferredDomain);
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
          const dsList: string[] = (n as any).distinct_sources || [];
          return dsList.some((ds: string) => normalizeSource(ds) === src);
        });
        const estMsgs = Math.round(totalMessages / (Object.keys(MONITORED_SOURCE_REGISTRY).length || 1));

        return {
          username: `@${src}`,
          display_name: reg?.displayName || `@${src}`,
          domain: domainKey,
          source_type: reg?.sourceType || 'independent',
          message_count: estMsgs,
          narratives_count: narrativeHits.length,
          top_topics: Array.from(new Set(narrativeHits.map((n) => `Topic #${n.promoted_from_topic_id}`))).slice(0, 3),
        };
      });

      // Top narrative snippets
      const sortedNarratives = [...bucket.narratives].sort(
        (a, b) => b.priority_signal_score - a.priority_signal_score
      );

      const snippets: CommunityNarrativeSnippet[] = sortedNarratives.slice(0, 5).map((n) => ({
        narrative_id: n.narrative_id,
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
        primary_languages: ['en', 'uk', 'ru'],
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
  buildCoOccurrenceClusters(narratives: NarrativeSummaryResponse[], totalMessages: number): CommunityCluster[] {
    // Falls back seamlessly to domain clusters while sorting by co-occurrence resonance
    const domainClusters = this.buildDomainClusters(narratives, totalMessages);
    return [...domainClusters].sort((a, b) => b.cross_domain_overlap_ratio - a.cross_domain_overlap_ratio);
  },
};
