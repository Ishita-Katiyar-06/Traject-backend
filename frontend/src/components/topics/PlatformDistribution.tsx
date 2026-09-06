import React from 'react';

export interface PlatformDistributionProps {
  x: number;
  telegram: number;
  migrationNote?: string;
  className?: string;
}

export const PlatformDistribution: React.FC<PlatformDistributionProps> = ({
  x,
  telegram,
  migrationNote,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-[16px] font-bold text-[#111727]">
          Platform Distribution
        </h4>
        <span className="font-mono text-[11px] text-[#8591A5]">
          Cross-Platform Shares
        </span>
      </div>

      {/* Horizontal Stacked Bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-[#EEF1F8] border border-[rgba(228,233,245,0.8)] p-[1px]">
        <div
          style={{ width: `${x}%` }}
          className="bg-[#111727] rounded-l-full transition-all duration-normal"
          title={`X: ${x}%`}
        />
        <div
          style={{ width: `${telegram}%` }}
          className="bg-[#2F65F6] rounded-r-full transition-all duration-normal"
          title={`Telegram: ${telegram}%`}
        />
      </div>

      {/* Breakdown Readouts */}
      <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[12px]">
        <div className="flex items-center gap-1.5 text-[#111727] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#111727]" />
          <span>X (Twitter) {x}%</span>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[#2F65F6] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#2F65F6]" />
          <span>Telegram {telegram}%</span>
        </div>
      </div>

      {migrationNote && (
        <p className="text-[12px] text-[#475569] font-sans pt-2 border-t border-[rgba(228,233,245,0.8)] leading-relaxed">
          {migrationNote}
        </p>
      )}
    </div>
  );
};
