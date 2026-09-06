import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopicSummaryResponse } from '../../types/api';
import { ArrowUpRight } from 'lucide-react';
import { formatPercent } from '../../utils/telemetryFormatters';

export interface TopicRowProps {
  topic: TopicSummaryResponse;
}

export const TopicRow: React.FC<TopicRowProps> = ({ topic }) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/topics/${topic.topic_id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  };

  const topKeyword = topic.representative_keywords[0]?.keyword || `Cluster #${topic.cluster_label}`;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 rounded-[22px] border border-[rgba(228,233,245,0.85)] bg-white hover:bg-[#F8FAFD] hover:border-slate-300 shadow-xs transition-all duration-150 cursor-pointer gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 select-none"
    >
      {/* Left Column: Topic ID, Cluster Label, Keywords */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono text-[11px] font-bold text-[#8591A5] bg-[#F1F4F9] px-2.5 py-0.5 rounded-full">
            {topic.topic_id.toUpperCase()}
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <span className="text-[12px] font-medium text-[#64748B]">
            Cluster #{topic.cluster_label}
          </span>
          {topic.percentage_of_dataset > 0 && (
            <>
              <span className="text-slate-300 text-[11px]">•</span>
              <span className="text-[11px] font-mono font-semibold text-[#2F65F6] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                {formatPercent(topic.percentage_of_dataset)} of dataset
              </span>
            </>
          )}
        </div>

        <h3 className="text-[16px] font-bold text-[#111727] font-sans leading-snug group-hover:text-[#2F65F6] transition-colors duration-150">
          Topic: {topKeyword}
        </h3>

        {/* c-TF-IDF Keywords */}
        {topic.representative_keywords && topic.representative_keywords.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider mr-1">
              c-TF-IDF:
            </span>
            {topic.representative_keywords.slice(0, 5).map((kw, i) => (
              <span
                key={i}
                className="text-[11px] font-medium text-[#475569] bg-[#F6F8FC] px-2.5 py-0.5 rounded-full border border-slate-200/60"
              >
                #{kw.keyword} ({kw.score.toFixed(2)})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Message Volume & Link Arrow */}
      <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[rgba(228,233,245,0.85)]">
        <div className="text-left md:text-right">
          <div className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider mb-0.5">
            Messages Ingested
          </div>
          <div className="font-mono text-[20px] font-bold text-[#111727]">
            {topic.message_count.toLocaleString()}
          </div>
        </div>

        <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-[#8591A5] group-hover:bg-[#2F65F6] group-hover:text-white transition-colors duration-150 shrink-0">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
