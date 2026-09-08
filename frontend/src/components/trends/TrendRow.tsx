import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { TrendSummaryResponse, TopicSummaryResponse } from '../../types/api';
import { ArrowUpRight } from 'lucide-react';
import { formatPercent } from '../../utils/telemetryFormatters';
import { listItemEnter } from '../../utils/motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export interface TrendRowProps {
  trend: TrendSummaryResponse | TopicSummaryResponse;
}

export const TrendRow: React.FC<TrendRowProps> = ({ trend }) => {
  const navigate = useNavigate();

  const trendId = 'trend_id' in trend ? trend.trend_id : trend.topic_id;

  const handleNavigate = () => {
    navigate(`/trends/${trendId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  };

  const topKeyword = trend.representative_keywords[0]?.keyword || `Cluster #${trend.cluster_label}`;
  const cleanId = trendId.replace(/^topic_|^trend_/, '');

  return (
    <motion.div
      variants={listItemEnter}
      role="link"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 rounded-[20px] border border-slate-200/80 dark:border-[#252B32] bg-white dark:bg-[#171C22] hover:bg-[#F8FAFD] dark:hover:bg-[#1A2027] hover:border-[#2F65F6]/40 dark:hover:border-[#2F65F6]/40 shadow-xs hover:shadow-dashboard transition-all duration-200 cursor-pointer gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 select-none"
    >
      {/* Left Column: Trend ID, Cluster Label, Keywords */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono text-[11px] font-bold text-[#2F65F6] dark:text-[#93C5FD] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40">
            TREND #{cleanId}
          </span>
          <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
          <span className="text-[12px] font-medium text-[#64748B] dark:text-slate-400">
            Cluster #{trend.cluster_label}
          </span>
          {trend.percentage_of_dataset > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-700 text-[11px]">•</span>
              <span className="text-[11px] font-mono font-semibold text-[#64748B] dark:text-slate-400 bg-slate-100 dark:bg-[#12161C] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323A]">
                {formatPercent(trend.percentage_of_dataset)} of dataset
              </span>
            </>
          )}
        </div>

        <h3 className="text-[16px] font-bold text-[#111727] dark:text-slate-100 font-sans leading-snug group-hover:text-[#2F65F6] dark:group-hover:text-[#5878C7] transition-colors duration-150">
          Trend: {topKeyword}
        </h3>

        {/* c-TF-IDF Keywords */}
        {trend.representative_keywords && trend.representative_keywords.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#8591A5] dark:text-slate-500 uppercase tracking-wider mr-1">
              c-TF-IDF:
            </span>
            {trend.representative_keywords.slice(0, 5).map((kw, i) => (
              <span
                key={i}
                className="text-[11px] font-medium text-[#475569] dark:text-slate-300 bg-[#F6F8FC] dark:bg-[#1D232A] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#2B323A]"
              >
                #{kw.keyword} <span className="text-[#8591A5] dark:text-slate-400 text-[10px]">({kw.score.toFixed(2)})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Message Volume & Link Arrow */}
      <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-[#252B32]">
        <div className="text-left md:text-right">
          <div className="text-[10px] font-bold text-[#8591A5] dark:text-slate-400 uppercase tracking-wider mb-0.5">
            Messages Ingested
          </div>
          <div className="font-mono text-[20px] font-bold text-[#111727] dark:text-slate-100">
            <AnimatedNumber value={trend.message_count} />
          </div>
        </div>

        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1D232A] flex items-center justify-center text-[#8591A5] dark:text-slate-400 group-hover:bg-[#2F65F6] group-hover:text-white transition-all duration-150 shrink-0">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};
