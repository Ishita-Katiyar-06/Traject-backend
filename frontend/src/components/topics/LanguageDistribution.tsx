import React from 'react';

export interface LanguageDistributionProps {
  hindi: number;
  hinglish: number;
  english: number;
  className?: string;
}

export const LanguageDistribution: React.FC<LanguageDistributionProps> = ({
  hindi,
  hinglish,
  english,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-[16px] font-bold text-[#111727]">
          Language Distribution
        </h4>
        <span className="font-mono text-[11px] text-[#8591A5]">
          Multilingual Ingestion
        </span>
      </div>

      {/* Horizontal Stacked Bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-[#EEF1F8] border border-[rgba(228,233,245,0.8)] p-[1px]">
        <div
          style={{ width: `${hindi}%` }}
          className="bg-[#2F65F6] rounded-l-full transition-all duration-normal"
          title={`Hindi: ${hindi}%`}
        />
        <div
          style={{ width: `${hinglish}%` }}
          className="bg-[#9B72F4] transition-all duration-normal"
          title={`Hinglish: ${hinglish}%`}
        />
        <div
          style={{ width: `${english}%` }}
          className="bg-[#CBD5E1] rounded-r-full transition-all duration-normal"
          title={`English: ${english}%`}
        />
      </div>

      {/* Breakdown Readouts */}
      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[12px]">
        <div className="flex items-center gap-1.5 text-[#2F65F6] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#2F65F6]" />
          <span>Hindi {hindi}%</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[#9B72F4] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#9B72F4]" />
          <span>Hinglish {hinglish}%</span>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[#64748B] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#CBD5E1]" />
          <span>English {english}%</span>
        </div>
      </div>

      <p className="text-[12px] text-[#8591A5] font-sans pt-2 border-t border-[rgba(228,233,245,0.8)] leading-relaxed">
        Regional vernacular discussions represent the primary share of recent growth.
      </p>
    </div>
  );
};
