import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatPriorityTierBadge } from '../../utils/telemetryFormatters';
import { getNarrativeDisplayName } from '../../utils/narrativeIdentity';
import { communityService } from '../../services/communityService';
import type { CommunityCluster } from '../../types/communities';

export const CommunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunityCluster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sources' | 'narratives' | 'resonance'>('sources');

  const loadCommunity = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await communityService.getCommunityById(id);
      setCommunity(data);
    } catch (err) {
      console.error('Failed to load community detail:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto pb-12 font-sans">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-24 w-full rounded-[24px]" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="text-center py-24 space-y-4 font-sans">
        <Users className="w-12 h-12 mx-auto text-[#8591A5] dark:text-slate-500" />
        <h3 className="text-[18px] font-bold text-[#111727] dark:text-slate-100">
          Community Cluster Not Found
        </h3>
        <p className="text-[13px] text-[#8591A5] dark:text-slate-400">
          The requested community identifier does not match any active cluster in the current corpus.
        </p>
        <Link to="/communities">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Communities
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-[1400px] mx-auto pb-12 font-sans">
      {/* 1. Back Navigation & Action Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/communities"
          className="inline-flex items-center gap-2 text-[13px] font-mono text-[#8591A5] hover:text-[#111727] dark:hover:text-[#F8FAFC] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Communities</span>
        </Link>
      </div>

      {/* 2. Community Hero Banner */}
      <div className="p-6 sm:p-8 rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs transition-all space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide shadow-2xs"
                style={{
                  backgroundColor: `${community.accent_color}18`,
                  color: community.accent_color,
                }}
              >
                {community.domain_display}
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[#8591A5] dark:text-slate-400">
                Cluster ID: {community.id}
              </span>
            </div>

            <h1 className="text-[24px] sm:text-[28px] font-extrabold text-[#111727] dark:text-slate-100 tracking-tight">
              {community.name}
            </h1>

            <p className="text-[14px] text-[#64748B] dark:text-slate-400 max-w-2xl leading-relaxed">
              {community.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-5 rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] text-center min-w-[130px] shadow-xs">
              <span className="text-[10px] font-mono text-[#8591A5] dark:text-slate-400 uppercase tracking-wider block">
                Avg Priority
              </span>
              <span className="text-[26px] font-extrabold font-mono text-[#2F65F6] dark:text-[#93C5FD]">
                {community.avg_priority_score.toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        {/* Analytical KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-[#252B32]">
          <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 uppercase block">
              Member Sources
            </span>
            <span className="text-[20px] font-bold font-mono text-[#111727] dark:text-slate-100 mt-1 block">
              {community.source_count} channels
            </span>
          </div>
          <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 uppercase block">
              Corpus Messages
            </span>
            <span className="text-[20px] font-bold font-mono text-[#111727] dark:text-slate-100 mt-1 block">
              {community.total_messages.toLocaleString()}
            </span>
          </div>
          <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 uppercase block">
              Active Narratives
            </span>
            <span className="text-[20px] font-bold font-mono text-[#111727] dark:text-slate-100 mt-1 block">
              {community.active_narratives_count}
            </span>
          </div>
          <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 uppercase block">
              Cross-Domain Overlap
            </span>
            <span className="text-[20px] font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
              {(community.cross_domain_overlap_ratio * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs - Crextio Pill Capsule Dock */}
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#F5F1E5] dark:bg-[#1E2229] border border-[#E5DFD3] dark:border-[#2D333F] self-start shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'sources'
              ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
              : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
          }`}
        >
          Member Sources ({community.sources.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('narratives')}
          className={`px-4 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'narratives'
              ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
              : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
          }`}
        >
          Shared Narratives ({community.top_narratives.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('resonance')}
          className={`px-4 py-1.5 rounded-full text-[12px] font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'resonance'
              ? 'bg-white dark:bg-[#252B35] text-[#111727] dark:text-white shadow-xs'
              : 'text-[#8591A5] hover:text-[#111727] dark:hover:text-white'
          }`}
        >
          Cross-Community Resonance ({community.co_occurring_communities.length})
        </button>
      </div>

      {/* 4. Tab Contents */}
      {activeTab === 'sources' && (
        <div className="rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] font-sans">
              <thead className="bg-[#FAFBFD] dark:bg-[#12161C] border-b border-slate-100 dark:border-[#282F3A] text-[11px] font-mono text-[#8591A5] dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Source Channel</th>
                  <th className="px-6 py-4">Publisher Type</th>
                  <th className="px-6 py-4">Ingested Volume</th>
                  <th className="px-6 py-4">Narrative Presence</th>
                  <th className="px-6 py-4">Top Trend Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#252B32]">
                {community.sources.map((src) => (
                  <tr key={src.username} className="hover:bg-[#FAFBFD] dark:hover:bg-[#1D232A] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#111727] dark:text-slate-100">
                        {src.display_name}
                      </div>
                      <div className="text-[12px] font-mono text-[#8591A5] dark:text-slate-400 mt-0.5">
                        {src.username}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-[#F1F4F9] dark:bg-[#1D232A] text-[#475569] dark:text-slate-300 text-[11px] font-mono capitalize border border-slate-200/60 dark:border-[#2B323A]">
                        {src.source_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-[#111727] dark:text-slate-100">
                      {src.message_count.toLocaleString()} msgs
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-[#2F65F6] dark:text-[#93C5FD]">
                      {src.narratives_count} narratives
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {src.top_topics.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#2F65F6] dark:text-[#93C5FD] text-[11px] font-mono border border-blue-100 dark:border-blue-900/40"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'narratives' && (
        <div className="space-y-3">
          {community.top_narratives.map((n) => (
            <div
              key={n.narrative_id}
              className="p-5 sm:p-6 rounded-[24px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-amber-400/80 dark:hover:border-amber-500/50 hover:shadow-xs transition-all"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-200/70 dark:border-rose-900/50 tracking-wide uppercase">
                    {n.narrative_id.toUpperCase()}
                  </span>
                  {(() => {
                    const tb = formatPriorityTierBadge(n.priority_tier);
                    return (
                      <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full border ${tb.bg} ${tb.text} ${tb.border}`}>
                        {tb.label} Priority
                      </span>
                    );
                  })()}
                  {n.is_cross_domain && (
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
                      Cross-Domain
                    </span>
                  )}
                </div>

                <Link
                  to={`/narratives/${encodeURIComponent(n.narrative_id)}`}
                  className="text-[16px] font-bold text-[#111727] dark:text-slate-100 hover:text-[#2F65F6] dark:hover:text-[#5878C7] transition-colors block"
                >
                  {getNarrativeDisplayName(n)}
                </Link>

                <div className="text-[12px] font-mono text-[#8591A5] dark:text-slate-400 flex items-center gap-3">
                  <span>{n.message_count.toLocaleString()} messages</span>
                  <span>•</span>
                  <span>{n.distinct_sources_count} sources</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] font-mono text-[#8591A5] dark:text-slate-400 uppercase tracking-wider block">
                    Signal Score
                  </span>
                  <span className="text-[20px] font-extrabold font-mono text-[#2F65F6] dark:text-[#93C5FD]">
                    {n.priority_signal_score.toFixed(3)}
                  </span>
                </div>

                <Link to={`/narratives/${encodeURIComponent(n.narrative_id)}`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                    className="text-[12px] font-mono rounded-full"
                  >
                    Inspect
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'resonance' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {community.co_occurring_communities.map((co) => (
            <div
              key={co.community_id}
              className="p-6 sm:p-7 rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2B323D] shadow-xs hover:border-amber-400/80 dark:hover:border-amber-500/50 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono uppercase text-[#8591A5] dark:text-slate-400 tracking-wider block">
                  Resonant Cluster
                </span>
                <h4 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 mt-1">
                  {co.community_name}
                </h4>
                <div className="mt-3.5 p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] text-[12px] font-mono text-[#475569] dark:text-slate-300">
                  <span className="text-[22px] font-extrabold text-[#2F65F6] dark:text-[#93C5FD] block leading-tight">
                    {co.shared_narratives_count}
                  </span>
                  <span className="mt-0.5 block">Shared active narratives</span>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-[#252B32]">
                <Link
                  to={`/communities/${encodeURIComponent(co.community_id)}`}
                  className="text-[12px] font-mono font-bold text-[#2F65F6] dark:text-[#93C5FD] hover:underline inline-flex items-center gap-1"
                >
                  <span>View Resonant Community</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
