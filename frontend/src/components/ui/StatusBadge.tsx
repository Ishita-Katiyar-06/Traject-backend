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
    signal: 'bg-[#FF6D5A]',
    data: 'bg-[#2F65F6]',
    critical: 'bg-[#C0503E]',
    confirmed: 'bg-[#6B9E78]',
    neutral: 'bg-[#8591A5]',
  };

  const badgeStyles = {
    signal: 'bg-[#FF6D5A]/10 text-[#FF6D5A] border-[#FF6D5A]/25',
    data: 'bg-[#2F65F6]/10 text-[#2F65F6] border-[#2F65F6]/25',
    critical: 'bg-rose-50 text-[#C0503E] border-rose-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    neutral: 'bg-[#F1F4F9] text-[#475569] border-slate-200/80',
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
