import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NarrativeSummaryResponse } from '../../types/api';
import { ArrowUpRight, Radio, Layers } from 'lucide-react';
import {
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatDecimal,
  COORDINATION_WORDING,
  REACH_WORDING,
} from '../../utils/telemetryFormatters';

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
    <div
      role="link"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-[22px] border border-[rgba(228,233,245,0.85)] bg-white hover:bg-[#F8FAFD] hover:border-slate-300 shadow-xs transition-all duration-150 cursor-pointer gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 select-none"
    >
      {/* Left Column: Narrative ID, Tier, Claim, Evidence Coverage */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-mono text-[11px] font-bold text-[#8591A5] bg-[#F1F4F9] px-2.5 py-0.5 rounded-full">
            {narrative.narrative_id}
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
          >
            {tierBadge.label} Priority
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${densityBadge.bg} ${densityBadge.text}`}
            title="Sample density / coverage across messages, not confidence or probability"
          >
            {densityBadge.label} Coverage
          </span>
          {narrative.is_cross_source && (
            <>
              <span className="text-slate-300 text-[11px]">•</span>
              <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full" title={`Observed across ${narrative.distinct_sources_count} distinct channels`}>
                Cross-Source ({narrative.distinct_sources_count || 2})
              </span>
            </>
          )}
          {narrative.is_cross_domain && (
            <>
              <span className="text-slate-300 text-[11px]">•</span>
              <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full" title={`Spans ${narrative.distinct_domains_count} strategic domains`}>
                Cross-Domain ({narrative.distinct_domains_count || 2})
              </span>
            </>
          )}
          {narrative.has_coordination_signals && (
            <>
              <span className="text-slate-300 text-[11px]">•</span>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {COORDINATION_WORDING.primary}
              </span>
            </>
          )}
        </div>

        <h3 className="text-[16px] font-bold text-[#111727] font-sans leading-snug group-hover:text-[#2F65F6] transition-colors duration-150">
          {narrative.headline_claim}
        </h3>

        <div className="flex items-center gap-3 mt-3 flex-wrap text-[11px] text-[#8591A5]">
          <span className="inline-flex items-center gap-1 font-medium">
            <Radio className="w-3 h-3 text-[#2F65F6]" />
            <span>Parent Topic: <strong className="text-[#111727]">#{narrative.promoted_from_topic_id}</strong></span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1 font-medium">
            <Layers className="w-3 h-3 text-slate-400" />
            <span><strong className="text-[#111727]">{narrative.message_count}</strong> messages</span>
          </span>
          {narrative.domains_represented && narrative.domains_represented.length > 0 && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                {narrative.domains_represented.map((dom) => (
                  <span key={dom} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                    {dom}
                  </span>
                ))}
              </span>
            </>
          )}
          {narrative.last_observed_at && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono">
                Last observed: {new Date(narrative.last_observed_at).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right Column: 4G Scores Cluster & Link Arrow */}
      <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[rgba(228,233,245,0.85)]">
        {/* Backend Priority Signal Score */}
        <div className="text-left lg:text-right">
          <div className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider mb-0.5">
            Priority Signal Score
          </div>
          <div className="font-mono text-[22px] font-extrabold tracking-tight text-[#111727]">
            {formatDecimal(narrative.priority_signal_score, 3)}
          </div>
        </div>

        {/* 4G Sub-Scores */}
        <div className="hidden sm:grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
          <div className="bg-[#F8FAFD] p-2 rounded-[12px] border border-slate-200/60" title="Spread Score">
            <div className="text-[#8591A5] text-[9px]">SPREAD</div>
            <div className="font-bold text-[#111727] mt-0.5">{formatDecimal(narrative.sub_scores.spread_score, 2)}</div>
          </div>
          <div className="bg-[#F8FAFD] p-2 rounded-[12px] border border-slate-200/60" title={COORDINATION_WORDING.tooltip}>
            <div className="text-[#8591A5] text-[9px]">COORD</div>
            <div className="font-bold text-[#111727] mt-0.5">{formatDecimal(narrative.sub_scores.coordination_score, 2)}</div>
          </div>
          <div className="bg-[#F8FAFD] p-2 rounded-[12px] border border-slate-200/60" title={REACH_WORDING.tooltip}>
            <div className="text-[#8591A5] text-[9px]">REACH</div>
            <div className="font-bold text-[#111727] mt-0.5">{formatDecimal(narrative.sub_scores.reach_score, 2)}</div>
          </div>
          <div className="bg-[#F8FAFD] p-2 rounded-[12px] border border-slate-200/60" title="Friction Score">
            <div className="text-[#8591A5] text-[9px]">FRICT</div>
            <div className="font-bold text-[#111727] mt-0.5">{formatDecimal(narrative.sub_scores.friction_score, 2)}</div>
          </div>
        </div>

        <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-[#8591A5] group-hover:bg-[#2F65F6] group-hover:text-white transition-colors duration-150 shrink-0">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
