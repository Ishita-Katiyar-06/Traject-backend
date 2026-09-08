import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Users, ArrowRight } from 'lucide-react';
import type { CommunityCluster } from '../../types/communities';
import { listItemEnter } from '../../utils/motion';

export interface CommunityCardProps {
  community: CommunityCluster;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({ community }) => {
  return (
    <motion.div
      variants={listItemEnter}
      className="group rounded-[24px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] p-6 shadow-dashboard hover:shadow-dashboard-hover transition-all duration-200 flex flex-col justify-between font-sans"
    >
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

          <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#8591A5] dark:text-slate-400">
            <Users className="w-3.5 h-3.5" />
            <span>{community.source_count} sources</span>
          </div>
        </div>

        {/* Community Name & Description */}
        <Link
          to={`/communities/${encodeURIComponent(community.id)}`}
          className="group-hover:text-[#2F65F6] dark:group-hover:text-[#5878C7] transition-colors"
        >
          <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight leading-snug">
            {community.name}
          </h3>
        </Link>
        <p className="text-[13px] text-[#64748B] dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed font-normal">
          {community.description}
        </p>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/70 dark:border-[#252B32]">
          <div>
            <span className="text-[10px] font-mono text-[#8591A5] dark:text-slate-400 uppercase block">
              Messages
            </span>
            <span className="text-[14px] font-bold font-mono text-[#111727] dark:text-slate-100">
              {community.total_messages.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-[#8591A5] dark:text-slate-400 uppercase block">
              Narratives
            </span>
            <span className="text-[14px] font-bold font-mono text-[#111727] dark:text-slate-100">
              {community.active_narratives_count}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-[#8591A5] dark:text-slate-400 uppercase block">
              Avg Score
            </span>
            <span className="text-[14px] font-bold font-mono text-[#2F65F6] dark:text-[#93C5FD]">
              {community.avg_priority_score.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Member Sources Chips */}
        <div className="mb-4">
          <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Observed Member Channels
          </span>
          <div className="flex flex-wrap gap-1.5">
            {community.sources.map((src) => (
              <span
                key={src.username}
                className="px-2 py-0.5 rounded-md bg-[#F1F4F9] dark:bg-[#1D232A] text-[#475569] dark:text-slate-300 text-[11px] font-mono hover:text-[#2F65F6] dark:hover:text-[#93C5FD] transition-colors border border-slate-200/60 dark:border-[#2B323A]"
              >
                {src.username}
              </span>
            ))}
          </div>
        </div>

        {/* Prominent Shared Narratives Preview */}
        {community.top_narratives.length > 0 && (
          <div className="space-y-2 mb-4 pt-3 border-t border-slate-100 dark:border-[#252B32]">
            <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 uppercase tracking-wider block">
              Top Narrative Focus
            </span>
            {community.top_narratives.slice(0, 2).map((narrative) => (
              <div
                key={narrative.narrative_id}
                className="p-2.5 rounded-[12px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] text-[12px] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-[#2F65F6] dark:text-[#93C5FD]">
                    {narrative.narrative_id}
                  </span>
                  <span className="font-mono text-[10px] text-[#8591A5] dark:text-slate-400">
                    Score: {narrative.priority_signal_score.toFixed(3)}
                  </span>
                </div>
                <p className="text-[12px] text-[#334155] dark:text-slate-200 font-medium truncate">
                  {narrative.headline_claim}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation Button */}
      <Link
        to={`/communities/${encodeURIComponent(community.id)}`}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200/80 dark:border-[#252B32] bg-white dark:bg-[#1A2027] text-[12px] font-semibold text-[#111727] dark:text-slate-200 hover:bg-[#F8FAFD] dark:hover:bg-[#20262E] hover:border-[#2F65F6]/40 transition-all group/btn"
      >
        <span>Inspect Community Network</span>
        <ArrowRight className="w-3.5 h-3.5 text-[#8591A5] group-hover/btn:translate-x-1 group-hover/btn:text-[#2F65F6] transition-all" />
      </Link>
    </motion.div>
  );
};
