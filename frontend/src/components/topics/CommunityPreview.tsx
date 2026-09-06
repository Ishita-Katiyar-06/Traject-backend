import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface CommunityPreviewItem {
  name: string;
  activityLevel: 'High' | 'Moderate' | 'Rising' | 'Stable';
}

export interface CommunityPreviewProps {
  communities: CommunityPreviewItem[];
  className?: string;
}

export const CommunityPreview: React.FC<CommunityPreviewProps> = ({ communities, className = '' }) => {
  const navigate = useNavigate();

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#2F65F6]" />
          <h4 className="text-[16px] font-bold text-[#111727]">
            Active Communities Preview
          </h4>
        </div>
        <button
          type="button"
          onClick={() => navigate('/communities')}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8591A5] hover:text-[#2F65F6] transition-colors group"
        >
          <span>View all communities</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="divide-y divide-[rgba(228,233,245,0.8)]">
        {communities.map((comm, i) => {
          const commRoute = comm.name.toLowerCase().includes('northern')
            ? '/communities/com-301'
            : comm.name.toLowerCase().includes('infrastructure') || comm.name.toLowerCase().includes('spot')
            ? '/communities/com-302'
            : comm.name.toLowerCase().includes('freight')
            ? '/communities/com-303'
            : '/communities/com-301';

          return (
            <button
              key={i}
              type="button"
              onClick={() => navigate(commRoute)}
              className="w-full py-3 flex items-center justify-between text-left hover:bg-[#F8FAFD] -mx-2 px-2 rounded-[12px] transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#111727] font-semibold group-hover:text-[#2F65F6] transition-colors">
                  {comm.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#8591A5] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <Badge
                variant={
                  comm.activityLevel === 'High'
                    ? 'signal'
                    : comm.activityLevel === 'Rising'
                    ? 'data'
                    : 'neutral'
                }
                size="sm"
              >
                {comm.activityLevel}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
};
