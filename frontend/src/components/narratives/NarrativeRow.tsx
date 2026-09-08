import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { NarrativeSummaryResponse } from '../../types/api';
import { ArrowUpRight, Radio, Layers } from 'lucide-react';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatDecimal,
  COORDINATION_WORDING,
} from '../../utils/telemetryFormatters';
import { listItemEnter } from '../../utils/motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export interface NarrativeRowProps {
  narrative: NarrativeSummaryResponse;
}

export const NarrativeRow: React.FC<NarrativeRowProps> = ({ narrative }) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/narratives/${narrative.narrative_id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  };

  const tierBadge = formatPriorityTierBadge(narrative.priority_tier);
  const densityBadge = formatEvidenceDensityBadge(narrative.evidence_density);

  return (
    <motion.div
      variants={listItemEnter}
      role="link"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-[20px] border border-slate-200/80 dark:border-[#252B32] bg-white dark:bg-[#171C22] hover:bg-[#F8FAFD] dark:hover:bg-[#1A2027] hover:border-[#2F65F6]/40 dark:hover:border-[#2F65F6]/40 shadow-xs hover:shadow-dashboard transition-all duration-200 cursor-pointer gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 select-none"
    >
      {/* Left Column: Narrative ID, Tier, Claim, Evidence Coverage */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-mono text-[11px] font-bold text-[#64748B] dark:text-slate-400 bg-[#F1F4F9] dark:bg-[#12161C] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323A]">
            {narrative.narrative_id}
          </span>
          <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
          >
            {tierBadge.label} Priority
          </span>
          <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            title="Sample density / coverage across messages, not confidence or probability"
          >
            {densityBadge.label} Coverage
          </span>
          {narrative.is_cross_source && (
            <>
              <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
              <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 px-2.5 py-0.5 rounded-full" title={`Observed across ${narrative.distinct_sources_count} distinct channels`}>
                Cross-Source ({narrative.distinct_sources_count || 2})
              </span>
            </>
          )}
          {narrative.is_cross_domain && (
            <>
              <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
              <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 px-2.5 py-0.5 rounded-full" title={`Spans ${narrative.distinct_domains_count} strategic domains`}>
                Cross-Domain ({narrative.distinct_domains_count || 2})
              </span>
            </>
          )}
          {narrative.has_coordination_signals && (
            <>
              <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2.5 py-0.5 rounded-full">
                {COORDINATION_WORDING.primary}
              </span>
            </>
          )}
        </div>

        <h3 className="text-[16px] font-bold text-[#111727] dark:text-slate-100 font-sans leading-snug group-hover:text-[#2F65F6] dark:group-hover:text-[#5878C7] transition-colors duration-150">
          {narrative.narrative_name || narrative.headline_claim}
        </h3>
        {narrative.narrative_summary && (
          <p className="text-[13px] text-[#64748B] dark:text-slate-400 font-sans mt-1 line-clamp-2 leading-relaxed">
            {narrative.narrative_summary}
          </p>
        )}

        <div className="flex items-center gap-3 mt-3 flex-wrap text-[12px] text-[#8591A5] dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-medium">
            <Radio className="w-3.5 h-3.5 text-[#2F65F6]" />
            <span>Parent Trend: <strong className="text-[#111727] dark:text-slate-200 font-mono">#{narrative.promoted_from_topic_id.replace(/^topic_|^trend_/, '')}</strong></span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="inline-flex items-center gap-1 font-medium">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span><strong className="text-[#111727] dark:text-slate-200 font-mono">{narrative.message_count.toLocaleString()}</strong> messages</span>
          </span>
          {narrative.first_observed_at && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="font-mono text-[11px]">
                First seen: {new Date(narrative.first_observed_at).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right Column: Priority Signal Score & 4G Sub-Scores */}
      <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-[#252B32]">
        <div className="text-left lg:text-right">
          <div className="text-[10px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider mb-0.5">
            Priority Score
          </div>
          <div className="font-mono text-[22px] font-extrabold text-[#111727] dark:text-slate-100 leading-tight">
            <AnimatedNumber value={narrative.priority_signal_score} decimals={3} />
          </div>
        </div>

        {/* 4G Sub-scores */}
        <div className="hidden sm:grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
          <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
            <div className="text-[#8591A5] dark:text-slate-400 font-medium">SPREAD</div>
            <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(narrative.sub_scores.spread_score, 2)}</div>
          </div>
          <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
            <div className="text-[#8591A5] dark:text-slate-400 font-medium">COORD</div>
            <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(narrative.sub_scores.coordination_score, 2)}</div>
          </div>
          <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
            <div className="text-[#8591A5] dark:text-slate-400 font-medium">REACH</div>
            <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(narrative.sub_scores.reach_score, 2)}</div>
          </div>
          <div className="bg-[#F8FAFD] dark:bg-[#12161C] p-2 rounded-[10px] border border-slate-200/60 dark:border-[#252B32] min-w-[50px]">
            <div className="text-[#8591A5] dark:text-slate-400 font-medium">FRICT</div>
            <div className="font-bold text-[#111727] dark:text-slate-200 mt-0.5">{formatDecimal(narrative.sub_scores.friction_score, 2)}</div>
          </div>
        </div>

        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1D232A] flex items-center justify-center text-[#8591A5] dark:text-slate-400 group-hover:bg-[#2F65F6] group-hover:text-white transition-all duration-150 shrink-0">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};
