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
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div className={`flex items-center gap-3 font-sans ${className}`}>
      {/* Label */}
      <span className="w-24 sm:w-28 text-[13px] font-medium text-[#475569] dark:text-[#CBD5E1] truncate shrink-0">
        {label}
      </span>

      {/* Progress Track */}
      <div className="flex-1 h-2 rounded-full bg-[#E5EAF3] dark:bg-[#1E252D] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>

      {/* Value & Trend Indicator */}
      <div className="flex items-center gap-1.5 w-16 justify-end shrink-0">
        <span className="text-[12px] font-bold font-mono text-[#111727] dark:text-[#F8FAFC]">
          {percentage}%
        </span>

        {trend === 'up' && (
          <div
            className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2F65F6] dark:text-[#93C5FD] border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center shadow-2xs"
            title="Upward trend observed"
          >
            <ArrowUp className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
        )}

        {trend === 'down' && (
          <div
            className="w-4 h-4 rounded-full bg-amber-50 dark:bg-amber-950/50 text-[#E9A23B] dark:text-[#FBBF24] border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center shadow-2xs"
            title="Downward trend observed"
          >
            <ArrowDown className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
        )}
      </div>
    </div>
  );
};
