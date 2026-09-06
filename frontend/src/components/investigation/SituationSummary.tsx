import React from 'react';
import { Activity, Radio, Globe, BookOpen } from 'lucide-react';

export interface SituationSummaryProps {
  summary: {
    leadText: string;
    activityRate: string;
    platforms: string;
    languages: string;
    currentFraming: string;
  };
  className?: string;
}

export const SituationSummary: React.FC<SituationSummaryProps> = ({ summary, className = '' }) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-5 font-sans ${className}`}>
      <div>
        <h3 className="text-[17px] font-bold font-sans text-[#111727]">
          Situation Picture
        </h3>
        <p className="text-[14px] text-[#475569] leading-relaxed mt-1 font-normal">
          {summary.leadText}
        </p>
      </div>

      {/* Structured Observational Attribute Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2 border-t border-[rgba(228,233,245,0.85)]">
        <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#8591A5] text-[10px] font-bold uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-[#FF6D5A]" />
            <span>MEASURED ACTIVITY</span>
          </div>
          <div className="text-[15px] font-bold text-[#111727]">
            {summary.activityRate}
          </div>
        </div>

        <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#8591A5] text-[10px] font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-[#2F65F6]" />
            <span>PRIMARY PLATFORMS</span>
          </div>
          <div className="text-[14px] font-bold text-[#111727]">
            {summary.platforms}
          </div>
        </div>

        <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#8591A5] text-[10px] font-bold uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5 text-[#64748B]" />
            <span>LANGUAGES</span>
          </div>
          <div className="text-[14px] font-bold text-[#111727]">
            {summary.languages}
          </div>
        </div>

        <div className="p-4 rounded-[20px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#8591A5] text-[10px] font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-[#FF6D5A]" />
            <span>CURRENT NARRATIVE</span>
          </div>
          <div className="text-[14px] font-bold text-[#FF6D5A] truncate" title={summary.currentFraming}>
            {summary.currentFraming}
          </div>
        </div>
      </div>
    </div>
  );
};
