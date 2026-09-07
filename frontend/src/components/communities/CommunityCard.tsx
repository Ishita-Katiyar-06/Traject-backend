import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import type { CommunityCluster } from '../../types/communities';

export interface CommunityCardProps {
  community: CommunityCluster;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({ community }) => {
  return (
    <div className="group rounded-[24px] bg-white dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between font-sans">
      <div>
        {/* Top Header Row: Domain Badge & Source Count */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide flex items-center gap-1.5"
            style={{
              backgroundColor: `${community.accent_color}18`,
              color: community.accent_color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: community.accent_color }}
            />
            {community.domain_display}
          </span>

          <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#8591A5] dark:text-[#7A8699]">
            <Users className="w-3.5 h-3.5" />
            <span>{community.source_count} sources</span>
          </div>
        </div>

        {/* Community Name & Description */}
        <Link
          to={`/communities/${encodeURIComponent(community.id)}`}
          className="group-hover:text-[#2F65F6] transition-colors"
        >
          <h3 className="text-[17px] font-bold text-[#111727] dark:text-[#F8FAFC] tracking-tight leading-snug">
            {community.name}
          </h3>
        </Link>
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1.5 line-clamp-2 leading-relaxed">
          {community.description}
        </p>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-[16px] bg-[#F8FAFD] dark:bg-[#171C22] border border-[rgba(228,233,245,0.7)] dark:border-[#252B32]">
          <div>
            <span className="text-[10px] font-mono text-[#8591A5] dark:text-[#7A8699] uppercase block">
              Messages
            </span>
            <span className="text-[14px] font-bold font-mono text-[#111727] dark:text-[#F8FAFC]">
              {community.total_messages.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-[#8591A5] dark:text-[#7A8699] uppercase block">
              Narratives
            </span>
            <span className="text-[14px] font-bold font-mono text-[#111727] dark:text-[#F8FAFC]">
              {community.active_narratives_count}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-[#8591A5] dark:text-[#7A8699] uppercase block">
              Avg Score
            </span>
            <span className="text-[14px] font-bold font-mono text-[#2F65F6]">
              {community.avg_priority_score.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Member Sources Chips */}
        <div className="mb-4">
          <span className="text-[11px] font-mono text-[#8591A5] dark:text-[#7A8699] uppercase tracking-wider mb-2 block">
            Observed Member Channels
          </span>
          <div className="flex flex-wrap gap-1.5">
            {community.sources.map((src) => (
              <span
                key={src.username}
                className="px-2 py-0.5 rounded-md bg-[#F1F4F9] dark:bg-[#20262E] text-[#475569] dark:text-[#CBD5E1] text-[11px] font-mono hover:text-[#2F65F6] transition-colors"
              >
                {src.username}
              </span>
            ))}
          </div>
        </div>

        {/* Prominent Shared Narratives Preview */}
        {community.top_narratives.length > 0 && (
          <div className="space-y-2 mb-4 pt-2 border-t border-[rgba(228,233,245,0.7)] dark:border-[#252B32]">
            <span className="text-[11px] font-mono text-[#8591A5] dark:text-[#7A8699] uppercase tracking-wider block">
              Top Narrative Focus
            </span>
            {community.top_narratives.slice(0, 2).map((narrative) => (
              <div
                key={narrative.narrative_id}
                className="text-[12px] text-[#334155] dark:text-[#CBD5E1] line-clamp-1 flex items-center justify-between gap-2"
              >
                <span className="truncate">• {narrative.headline_claim}</span>
                <span className="shrink-0 text-[10px] font-mono font-bold text-[#8591A5] dark:text-[#7A8699]">
                  {narrative.priority_signal_score.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="pt-3 border-t border-[rgba(228,233,245,0.7)] dark:border-[#252B32] flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#8591A5] dark:text-[#7A8699]">
          Cross-Domain Overlap: {(community.cross_domain_overlap_ratio * 100).toFixed(0)}%
        </span>
        <Link
          to={`/communities/${encodeURIComponent(community.id)}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2F65F6] hover:text-[#214EC2] transition-colors"
        >
          <span>Inspect Cluster</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
};
