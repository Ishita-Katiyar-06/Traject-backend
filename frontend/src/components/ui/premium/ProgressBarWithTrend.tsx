import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export interface ProgressBarWithTrendProps {
  label: string;
  percentage: number;
  trend?: 'up' | 'down';
  color?: string;
  className?: string;
}

export const ProgressBarWithTrend: React.FC<ProgressBarWithTrendProps> = ({
  label,
  percentage,
  trend,
  color = '#2F65F6',
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 font-jakarta ${className}`}>
      {/* Label */}
      <span className="w-24 sm:w-28 text-[13px] sm:text-[14px] font-bold text-[#111727] truncate shrink-0">
        {label}
      </span>

      {/* Progress Track */}
      <div className="flex-1 h-2 rounded-full bg-[#E5EAF3] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>

      {/* Value & Trend Indicator */}
      <div className="flex items-center gap-1.5 w-14 justify-end shrink-0">
        <span className="text-[12px] font-bold text-[#111727]">
          {percentage}%
        </span>

        {trend === 'up' && (
          <div
            className="w-4 h-4 rounded-full bg-[#2F65F6] text-white flex items-center justify-center shadow-xs"
            title="Increased"
          >
            <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        )}

        {trend === 'down' && (
          <div
            className="w-4 h-4 rounded-full bg-[#FF8833] text-white flex items-center justify-center shadow-xs"
            title="Decreased"
          >
            <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        )}
      </div>
    </div>
  );
};
