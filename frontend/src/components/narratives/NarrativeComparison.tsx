import React from 'react';
import { ArrowRight, History } from 'lucide-react';

export interface NarrativeComparisonProps {
  previousFraming: string;
  currentFraming: string;
  framingShiftDescription: string;
  changePercent: number;
  className?: string;
}

export const NarrativeComparison: React.FC<NarrativeComparisonProps> = ({
  previousFraming,
  currentFraming,
  framingShiftDescription,
  changePercent,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] bg-white dark:bg-[#171C22] p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#FF6D5A] dark:text-[#FFA194]" />
          <h4 className="text-[17px] font-bold font-sans text-[#111727] dark:text-[#F8FAFC]">
            How the Framing Changed
          </h4>
        </div>
        <span className="font-sans text-[12px] text-[#8591A5] dark:text-[#94A3B8]">
          Shift: <strong className="text-[#FF6D5A] dark:text-[#FFA194] font-bold">+{changePercent}%</strong>
        </span>
      </div>

      {/* Then vs Now Two-Column Block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch">
        {/* Then Block */}
        <div className="p-4 rounded-[20px] bg-[#F8FAFD] dark:bg-[#191F26] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-[#94A3B8] block">
            Earlier Dominant Framing (Then)
          </span>
          <p className="text-[14px] font-medium text-[#64748B] dark:text-[#CBD5E1] font-sans leading-snug">
            "{previousFraming}"
          </p>
        </div>

        {/* Now Block */}
        <div className="p-4 rounded-[20px] bg-[#FFF8F7] dark:bg-[#241919] border border-[#FFD8D3] dark:border-[rgba(232,120,104,0.32)] space-y-1.5 relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6D5A] dark:text-[#FFA194] block">
              Current Dominant Framing (Now)
            </span>
            <span className="w-2 h-2 rounded-full bg-[#FF6D5A] dark:bg-[#FFA194]" />
          </div>
          <p className="text-[14px] font-bold text-[#111727] dark:text-[#F8FAFC] font-sans leading-snug">
            "{currentFraming}"
          </p>
        </div>
      </div>

      {/* Observational Shift Summary */}
      <div className="pt-3 border-t border-[rgba(228,233,245,0.85)] dark:border-[#252B32] text-[13px] text-[#475569] dark:text-[#CBD5E1] font-sans leading-relaxed flex items-start gap-2">
        <ArrowRight className="w-4 h-4 text-[#FF6D5A] dark:text-[#FFA194] shrink-0 mt-0.5" />
        <span>{framingShiftDescription}</span>
      </div>
    </div>
  );
};
