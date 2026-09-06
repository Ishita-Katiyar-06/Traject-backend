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
  variant = 'peach',
  customGradientClass,
  icon,
  className = '',
  onClick,
}) => {
  const getGradientClass = () => {
    if (customGradientClass) return customGradientClass;
    switch (variant) {
      case 'peach':
        return 'bg-gradient-to-br from-[#FFA690] via-[#FF856D] to-[#FFEBE5]';
      case 'cyan':
        return 'bg-gradient-to-br from-[#53E5C3] via-[#38BDF8] to-[#EFF6FF]';
      case 'blue':
        return 'bg-gradient-to-br from-[#2563EB] to-[#60A5FA] text-white';
      default:
        return 'bg-gradient-to-br from-[#FFA690] via-[#FF856D] to-[#FFEBE5]';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-[26px] p-6 shadow-dashboard flex flex-col justify-between font-jakarta relative overflow-hidden transition-all duration-200 hover:shadow-dashboard-hover ${getGradientClass()} ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Soft Glow Orbs */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/25 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/20 rounded-full blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between relative z-10">
        <h3 className="text-[16px] font-semibold text-[#111727] tracking-tight leading-snug">
          {title}
        </h3>

        {icon && (
          <div className="w-10 h-10 rounded-2xl bg-white/35 backdrop-blur-md border border-white/40 flex items-center justify-center text-[#111727] shadow-sm">
            {icon}
          </div>
        )}
      </div>

      {/* Metric */}
      <div className="mt-8 relative z-10">
        <div className="text-[38px] md:text-[42px] font-bold text-[#111727] tracking-tight leading-none">
          {typeof metric === 'number' && !metric.toString().includes('%')
            ? `${metric}%`
            : metric}
        </div>
        {subtitle && (
          <p className="text-[13px] text-[#475569] font-medium mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
