import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopicDetail } from '../../data/mock/topics';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface RelatedTopicsProps {
  relatedTopics: TopicDetail[];
  className?: string;
}

export const RelatedTopics: React.FC<RelatedTopicsProps> = ({ relatedTopics, className = '' }) => {
  const navigate = useNavigate();

  if (!relatedTopics || relatedTopics.length === 0) return null;

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div>
        <h4 className="text-[16px] font-bold text-[#111727]">
          Related Topics
        </h4>
        <p className="text-[#8591A5] text-[12px] font-mono mt-0.5">
          Correlated semantic clusters tracked across adjacent channels
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {relatedTopics.map((rel) => (
          <button
            key={rel.id}
            type="button"
            onClick={() => navigate(`/topics/${rel.id}`)}
            className="group flex items-start justify-between p-3.5 rounded-[16px] border border-[rgba(228,233,245,0.85)] bg-[#F8FAFD] hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs text-left transition-all duration-150 select-none"
          >
            <div className="min-w-0 pr-2">
              <span className="font-mono text-[10px] text-[#8591A5] uppercase tracking-wider block mb-0.5">
                {rel.id.toUpperCase()}
              </span>
              <div className="text-[13px] font-bold text-[#111727] font-sans group-hover:text-[#2F65F6] transition-colors truncate">
                {rel.name}
              </div>
              <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px]">
                <Badge variant={rel.activityLevel === 'High' ? 'signal' : 'neutral'} size="sm">
                  {rel.activityLevel}
                </Badge>
                <span className={rel.changePercent > 0 ? 'text-[#FF6D5A] font-semibold' : 'text-[#8591A5]'}>
                  {rel.changePercent > 0 ? `+${rel.changePercent}%` : `${rel.changePercent}%`}
                </span>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#8591A5] group-hover:text-[#2F65F6] transition-colors shrink-0 mt-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
};
