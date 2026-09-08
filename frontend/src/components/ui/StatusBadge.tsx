import React from 'react';

export type StatusVariant = 'signal' | 'data' | 'critical' | 'confirmed' | 'neutral';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusVariant;
  label: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
  ...props
}) => {
  const dotColor = {
    signal: 'bg-[#E9A23B] dark:bg-[#FBBF24]',
    data: 'bg-[#2F65F6] dark:bg-[#5878C7]',
    critical: 'bg-[#E35D5D] dark:bg-[#F87171]',
    confirmed: 'bg-[#22A06B] dark:bg-[#34D399]',
    neutral: 'bg-[#8591A5] dark:bg-[#7A8699]',
  };

  const badgeStyles = {
    signal: 'bg-[#E9A23B]/10 dark:bg-[#FBBF24]/15 text-[#E9A23B] dark:text-[#FBBF24] border-[#E9A23B]/25 dark:border-[#FBBF24]/30',
    data: 'bg-[#2F65F6]/10 dark:bg-[#5878C7]/15 text-[#2F65F6] dark:text-[#93C5FD] border-[#2F65F6]/25 dark:border-[#5878C7]/30',
    critical: 'bg-[#E35D5D]/10 dark:bg-[#F87171]/15 text-[#E35D5D] dark:text-[#F87171] border-[#E35D5D]/25 dark:border-[#F87171]/30',
    confirmed: 'bg-[#22A06B]/10 dark:bg-[#34D399]/15 text-[#22A06B] dark:text-[#34D399] border-[#22A06B]/25 dark:border-[#34D399]/30',
    neutral: 'bg-[#F1F4F9] dark:bg-[#191F26] text-[#475569] dark:text-[#94A3B8] border-slate-200/80 dark:border-[#2B323A]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[12px] font-medium font-sans ${badgeStyles[status]} ${className}`}
      {...props}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor[status]}`} />
      <span>{label}</span>
    </span>
  );
};
