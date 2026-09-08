import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  GitBranch,
  Layers,
  Clock,
  Radio,
  FileText,
} from 'lucide-react';
import { TrendWithNarratives, getCleanNarrativeId } from '../../services/trendService';
import { formatPercent, formatPriorityTierBadge } from '../../utils/telemetryFormatters';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { listItemEnter } from '../../utils/motion';

export interface TrendNarrativeTreeProps {
  trends: TrendWithNarratives[];
  defaultExpanded?: boolean;
}

export const TrendNarrativeTree: React.FC<TrendNarrativeTreeProps> = ({
  trends,
  defaultExpanded = true,
}) => {
  return (
    <div className="space-y-4" role="tree" aria-label="Hierarchical Trend and Narrative Tree">
      {trends.map((trend) => (
        <TrendTreeNode
          key={trend.trend_id || trend.topic_id}
          trend={trend}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </div>
  );
};

interface TrendTreeNodeProps {
  trend: TrendWithNarratives;
  defaultExpanded?: boolean;
}

export const TrendTreeNode: React.FC<TrendTreeNodeProps> = ({
  trend,
  defaultExpanded = true,
}) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const trendId = trend.trend_id || trend.topic_id;
  const cleanTrendId = trend.cleanId;

  const handleToggleExpand = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleNavigateTrend = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    navigate(`/trends/${trendId}`);
  };

  const handleTrendKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(`/trends/${trendId}`);
    } else if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setIsExpanded((prev) => !prev);
    }
  };

  const narrativeCount = trend.narratives.length;

  return (
    <motion.div
      variants={listItemEnter}
      initial="initial"
      animate="animate"
      className="rounded-[24px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs hover:border-amber-400/40 dark:hover:border-amber-400/30 transition-all duration-200 overflow-hidden"
      role="treeitem"
      aria-expanded={isExpanded}
    >
      {/* 1. Parent Trend Node Header */}
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        {/* Left Side: Expand/Collapse control + Trend Identity + Metadata */}
        <div className="flex items-start md:items-center gap-3.5 flex-1 min-w-0">
          {/* Dedicated Expand/Collapse button */}
          <button
            type="button"
            onClick={handleToggleExpand}
            aria-label={isExpanded ? `Collapse Trend #${cleanTrendId}` : `Expand Trend #${cleanTrendId}`}
            className="mt-0.5 md:mt-0 p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#20262E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-amber-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {/* Trend Identity Badge & Contextual Metadata */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button
                type="button"
                onClick={handleNavigateTrend}
                onKeyDown={handleTrendKeyDown}
                className="group/btn inline-flex items-center gap-1.5 font-mono text-[12px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/25 dark:border-amber-400/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                title={`Open dossier for Trend #${cleanTrendId}`}
              >
                <Radio className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                <span>TREND #{cleanTrendId}</span>
              </button>

              {trend.percentage_of_dataset > 0 && (
                <>
                  <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
                  <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#13171C] px-2.5 py-0.5 rounded-full border border-slate-200/70 dark:border-[#2B323D]">
                    {formatPercent(trend.percentage_of_dataset)} of dataset
                  </span>
                </>
              )}

              <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {narrativeCount === 1 ? '1 Associated Narrative' : `${narrativeCount} Associated Narratives`}
              </span>
            </div>

            {/* Meaningful Trend Name */}
            {trend.trend_name && (
              <h3
                onClick={handleNavigateTrend}
                className="text-[16px] font-bold text-slate-900 dark:text-white hover:text-[#2F65F6] dark:hover:text-[#60A5FA] transition-colors cursor-pointer mt-1"
              >
                {trend.trend_name}
              </h3>
            )}

            {/* Evidence-Grounded Summary Preview */}
            {trend.trend_summary && (
              <p className="text-[12.5px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                {trend.trend_summary}
              </p>
            )}

            {/* Representative Keywords */}
            {trend.representative_keywords && trend.representative_keywords.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-0.5">
                  Keywords:
                </span>
                {trend.representative_keywords.slice(0, 5).map((kw, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-[#20262E] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323D]"
                  >
                    #{kw.keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Message Volume & Trend Navigation Action */}
        <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-[#252B32]">
          <div className="text-left md:text-right">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-0.5">
              Messages Observed
            </div>
            <div className="font-mono text-[18px] font-bold text-slate-900 dark:text-white">
              <AnimatedNumber value={trend.message_count} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleNavigateTrend}
            aria-label={`View dossier for Trend #${cleanTrendId}`}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#20262E] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#2F65F6] hover:text-white dark:hover:bg-[#2F65F6] dark:hover:text-white transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]"
            title={`View Trend #${cleanTrendId} Dossier`}
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Hierarchical Child Narratives Sub-Tree */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="border-t border-slate-100 dark:border-[#252B32] bg-slate-50/50 dark:bg-[#13171C]/90 px-5 py-4"
          >
            {trend.narratives.length > 0 ? (
              <div className="relative pl-6 ml-3 border-l-2 border-slate-200 dark:border-[#2B323D] space-y-2.5 my-1" role="group">
                {trend.narratives.map((narrative, idx) => {
                  const isLast = idx === trend.narratives.length - 1;
                  return (
                    <NarrativeTreeNode
                      key={narrative.narrative_id}
                      narrative={narrative}
                      parentTrendId={trendId}
                      parentCleanTrendId={cleanTrendId}
                      isLast={isLast}
                    />
                  );
                })}
              </div>
            ) : (
              /* Truthful Empty State */
              <div className="relative pl-6 ml-3 border-l-2 border-slate-200 dark:border-[#2B323D] py-3">
                <div className="absolute -left-[25px] top-1/2 -translate-y-1/2 w-6 h-[2px] bg-slate-200 dark:border-[#2B323D]" />
                <div className="flex items-center gap-2.5 text-[12px] text-slate-500 dark:text-slate-400 py-1.5 px-3 rounded-full bg-white dark:bg-[#181C22] border border-slate-200/60 dark:border-[#2B323D] w-fit">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>No narratives are currently associated with this Trend.</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface NarrativeTreeNodeProps {
  narrative: TrendWithNarratives['narratives'][0];
  parentTrendId: string;
  parentCleanTrendId: string;
  isLast: boolean;
}

export const NarrativeTreeNode: React.FC<NarrativeTreeNodeProps> = ({
  narrative,
  parentTrendId,
  parentCleanTrendId,
  isLast: _isLast,
}) => {
  const navigate = useNavigate();
  const cleanNarrativeId = getCleanNarrativeId(narrative.narrative_id);

  const handleClick = () => {
    // Navigate to existing narrative route, preserving trend context in state & query parameter
    navigate(`/narratives/${narrative.narrative_id}?trend=${encodeURIComponent(parentTrendId)}`, {
      state: {
        fromTrend: parentTrendId,
        cleanTrendId: parentCleanTrendId,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className="relative group">
      {/* Tree Connector Branch Line */}
      <div
        className="absolute -left-[26px] top-1/2 -translate-y-1/2 w-6 h-[2px] bg-slate-200 dark:border-[#2B323D] group-hover:bg-[#2F65F6]/60 transition-colors"
        aria-hidden="true"
      />

      {/* Clickable Narrative Child Node Card */}
      <div
        role="treeitem"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-[18px] bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-[#2B323D] hover:bg-slate-50 dark:hover:bg-[#1E242E] hover:border-[#2F65F6]/50 dark:hover:border-[#2F65F6]/40 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]"
      >
        {/* Left Column: Narrative ID, Priority Badge, Headline Claim */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/40 inline-flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              <span>NARRATIVE #{cleanNarrativeId}</span>
            </span>

            {narrative.is_dominant ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40">
                Dominant Viewpoint
              </span>
            ) : narrative.is_dominant === false ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 dark:bg-slate-850/40 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/40">
                Alternative Perspective
              </span>
            ) : null}

            {(() => {
              const tierBadge = formatPriorityTierBadge(narrative.priority_tier);
              return (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
                >
                  {tierBadge.label} Priority
                </span>
              );
            })()}

            <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Score: {narrative.priority_signal_score.toFixed(3)}
            </span>
          </div>

          <div className="text-[14px] font-bold text-slate-900 dark:text-white group-hover:text-[#2F65F6] dark:group-hover:text-[#60A5FA] transition-colors line-clamp-1">
            {narrative.narrative_name || narrative.headline_claim}
          </div>
          {narrative.narrative_summary && (
            <div className="text-[12px] text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
              {narrative.narrative_summary}
            </div>
          )}
        </div>

        {/* Right Column: Message Count & Arrow indicator */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#252B32] text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>
              <strong className="text-slate-900 dark:text-white">{narrative.message_count}</strong> msgs
            </span>
          </div>

          {narrative.first_observed_at && (
            <div className="hidden lg:flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{new Date(narrative.first_observed_at).toLocaleDateString()}</span>
            </div>
          )}

          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#20262E] flex items-center justify-center text-slate-400 group-hover:bg-[#2F65F6] group-hover:text-white transition-all duration-150 shrink-0">
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
};
