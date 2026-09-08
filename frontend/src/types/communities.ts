/**
 * TESSERA — Community Intelligence Data Contracts
 *
 * Models dynamic observed information communities and source clusters
 * derived from live narrative co-occurrence and source registry domains.
 */

export interface CommunityMemberSource {
  username: string;
  display_name: string;
  domain: string;
  source_type: 'independent' | 'publisher' | 'official' | 'republication' | string;
  message_count: number;
  narratives_count: number;
  top_topics: string[];
}

export interface CommunityNarrativeSnippet {
  narrative_id: string;
  narrative_name?: string;
  headline_claim: string;
  promoted_from_topic_id?: string;
  priority_signal_score: number;
  priority_tier: 'critical' | 'high' | 'elevated' | 'routine';
  distinct_sources_count: number;
  message_count: number;
  is_cross_domain: boolean;
}

export interface CommunityCluster {
  id: string;
  name: string;
  domain: string;
  domain_display: string;
  description: string;
  accent_color: string;
  sources: CommunityMemberSource[];
  source_count: number;
  total_messages: number;
  active_narratives_count: number;
  top_narratives: CommunityNarrativeSnippet[];
  cross_domain_overlap_ratio: number;
  avg_priority_score: number;
  primary_languages: string[];
  co_occurring_communities: Array<{
    community_id: string;
    community_name: string;
    shared_narratives_count: number;
  }>;
}

export interface CommunitySummaryKPIs {
  total_communities: number;
  total_monitored_sources: number;
  total_corpus_messages: number;
  cross_community_resonance_count: number;
  top_priority_community: string;
}

export type CommunityGroupingMode = 'domain' | 'co_occurrence';
