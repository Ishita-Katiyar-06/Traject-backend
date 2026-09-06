import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CommunityDetail } from '../../data/mock/communities';
import { Badge } from '../ui/Badge';
import { ArrowUpRight } from 'lucide-react';

export interface CommunityRowProps {
  community: CommunityDetail;
}

export const CommunityRow: React.FC<CommunityRowProps> = ({ community }) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/communities/${community.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  };

  const activityBadgeVariant =
    community.activityLevel === 'High'
      ? 'signal'
      : community.activityLevel === 'Moderate'
      ? 'data'
      : 'neutral';

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-[20px] border border-[rgba(228,233,245,0.85)] bg-white hover:bg-[#F8FAFD] hover:border-slate-300/80 shadow-xs transition-all duration-150 cursor-pointer gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 select-none"
    >
      {/* Left Column: Community Name, Description, Platforms, Languages */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono text-[11px] font-bold text-[#8591A5] bg-[#F1F4F9] px-2 py-0.5 rounded-full">
            {community.id.toUpperCase()}
          </span>
          <span className="text-slate-300 text-[11px]">•</span>
          <Badge variant={activityBadgeVariant} size="sm">
            {community.activityLevel} Activity
          </Badge>
          <span className="text-slate-300 text-[11px]">•</span>
          <span className="text-[12px] font-medium text-[#8591A5]">
            Active {community.lastActive}
          </span>
        </div>

        <h3 className="text-[15px] font-bold text-[#111727] font-sans leading-snug group-hover:text-[#2F65F6] transition-colors duration-150">
          {community.name}
        </h3>

        <p className="text-[13px] text-[#475569] line-clamp-1 mt-1 leading-normal font-normal">
          {community.description}
        </p>

        {/* Platforms and Languages */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[11px]">
          <div className="flex items-center gap-1.5">
            {community.platforms.x > 0 && <Badge variant="neutral" size="sm">X ({community.platforms.x}%)</Badge>}
            {community.platforms.telegram > 0 && <Badge variant="data" size="sm">Telegram ({community.platforms.telegram}%)</Badge>}
          </div>
          <span className="text-slate-300">•</span>
          <span className="text-[#8591A5] font-medium">
            Hindi {community.languages.hindi}% • Hinglish {community.languages.hinglish}% • English {community.languages.english}%
          </span>
        </div>
      </div>

      {/* Right Column: Volume, Trend, Arrow */}
      <div className="flex items-center justify-between sm:justify-end gap-5 sm:gap-6 shrink-0 pt-2 sm:pt-0 border-t border-[rgba(228,233,245,0.85)] sm:border-t-0">
        <div className="text-left sm:text-right">
          <div className="text-[11px] font-semibold text-[#8591A5] uppercase tracking-wider mb-0.5">
            Volume
          </div>
          <div className="font-sans text-[17px] font-bold text-[#111727] tracking-tight">
            {community.volume.toLocaleString()}{' '}
            <span className="text-[12px] font-normal text-[#8591A5]">posts</span>
          </div>
        </div>

        <div className="text-left sm:text-right hidden md:block">
          <div className="text-[11px] font-semibold text-[#8591A5] uppercase tracking-wider mb-0.5">
            Trend
          </div>
          <span className="font-sans text-[13px] font-semibold text-[#111727]">
            {community.trend}
          </span>
        </div>

        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[#8591A5] group-hover:bg-[#2F65F6] group-hover:text-white transition-colors duration-150">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
