import React from 'react';

export type GradientVariant = 'peach' | 'cyan' | 'blue' | 'custom';

export interface GradientKpiCardProps {
  title: string;
  metric: string | number;
  subtitle?: string;
  variant?: GradientVariant;
  customGradientClass?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GradientKpiCard: React.FC<GradientKpiCardProps> = ({
  title,
  metric,
  subtitle = 'Avg. Completed',
  variant = 'blue',
  customGradientClass,
  icon,
  className = '',
  onClick,
}) => {
  const getGradientClass = () => {
    if (customGradientClass) return customGradientClass;
    switch (variant) {
      case 'peach':
        return 'bg-gradient-to-br from-[#FFF7F5] to-[#FEEDEA] dark:from-[#251A18] dark:to-[#1C1514] border-rose-100/80 dark:border-rose-950/40';
      case 'cyan':
        return 'bg-gradient-to-br from-[#F0FDFB] to-[#E6F7F5] dark:from-[#112423] dark:to-[#0D1C1B] border-teal-100/80 dark:border-teal-950/40';
      case 'blue':
      default:
        return 'bg-gradient-to-br from-[#F4F7FF] to-[#EAF0FF] dark:from-[#141C2B] dark:to-[#101724] border-blue-100/80 dark:border-blue-950/40';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-[24px] p-6 border shadow-dashboard flex flex-col justify-between font-sans relative overflow-hidden transition-all duration-200 hover:shadow-dashboard-hover ${getGradientClass()} ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between relative z-10">
        <h3 className="text-[14px] font-semibold text-[#111727] dark:text-[#F8FAFC] tracking-tight leading-snug">
          {title}
        </h3>

        {icon && (
          <div className="w-9 h-9 rounded-[14px] bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center text-[#111727] dark:text-[#F8FAFC] shadow-2xs">
            {icon}
          </div>
        )}
      </div>

      {/* Metric */}
      <div className="mt-6 relative z-10">
        <div className="text-[34px] sm:text-[38px] font-bold text-[#111727] dark:text-[#F8FAFC] font-mono tracking-tight leading-none">
          {typeof metric === 'number' && !metric.toString().includes('%')
            ? `${metric}%`
            : metric}
        </div>
        {subtitle && (
          <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-2">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
