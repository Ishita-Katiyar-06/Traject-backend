import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, ArrowUpRight } from 'lucide-react';

export interface AssociatedTopicItem {
  id: string;
  name: string;
  activityLevel?: string;
}

export interface CommunityTopicsProps {
  topics: AssociatedTopicItem[];
  className?: string;
}

export const CommunityTopics: React.FC<CommunityTopicsProps> = ({ topics, className = '' }) => {
  const navigate = useNavigate();

  if (!topics || topics.length === 0) return null;

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4 text-[#2F65F6]" />
        <h4 className="text-[16px] font-bold text-[#111727]">
          Top Associated Topics
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {topics.map((top) => (
          <button
            key={top.id}
            type="button"
            onClick={() => navigate(`/topics/${top.id}`)}
            className="group flex items-center justify-between p-3.5 rounded-[16px] border border-[rgba(228,233,245,0.85)] bg-[#F8FAFD] hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs text-left transition-all duration-150 select-none"
          >
            <div className="min-w-0 pr-2">
              <span className="font-mono text-[10px] text-[#8591A5] uppercase tracking-wider block">
                {top.id.toUpperCase()}
              </span>
              <span className="text-[13px] font-bold text-[#111727] group-hover:text-[#2F65F6] transition-colors truncate block mt-0.5">
                {top.name}
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#8591A5] group-hover:text-[#2F65F6] transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
