import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, ArrowUpRight } from 'lucide-react';
import { CommunityDetail } from '../../data/mock/communities';
import { Badge } from '../ui/Badge';

export interface CommunityRelationshipsProps {
  relatedCommunities: CommunityDetail[];
  className?: string;
}

export const CommunityRelationships: React.FC<CommunityRelationshipsProps> = ({
  relatedCommunities,
  className = '',
}) => {
  const navigate = useNavigate();

  if (!relatedCommunities || relatedCommunities.length === 0) return null;

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-[#2F65F6]" />
        <h4 className="text-[16px] font-bold text-[#111727]">
          Related Community Clusters
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {relatedCommunities.map((rel) => (
          <button
            key={rel.id}
            type="button"
            onClick={() => navigate(`/communities/${rel.id}`)}
            className="group flex items-center justify-between p-3.5 rounded-[16px] border border-[rgba(228,233,245,0.85)] bg-[#F8FAFD] hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs text-left transition-all duration-150 select-none"
          >
            <div className="min-w-0 pr-2">
              <span className="font-mono text-[10px] text-[#8591A5] uppercase tracking-wider block">
                {rel.id.toUpperCase()}
              </span>
              <div className="text-[13px] font-bold text-[#111727] group-hover:text-[#2F65F6] transition-colors truncate mt-0.5">
                {rel.name}
              </div>
              <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px] text-[#8591A5]">
                <Badge variant="neutral" size="sm">
                  {rel.activityLevel}
                </Badge>
                <span>{rel.volume.toLocaleString()} posts</span>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#8591A5] group-hover:text-[#2F65F6] transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
