import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'signal' | 'data' | 'critical' | 'confirmed';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] font-mono leading-tight gap-1',
    md: 'px-2.5 py-0.5 text-[12px] font-sans gap-1.5',
  };

  const variantClasses = {
    neutral:
      'bg-[#F1F4F9] dark:bg-[#191F26] text-[#475569] dark:text-[#94A3B8] border border-slate-200/60 dark:border-[#2B323A]',
    signal:
      'bg-[#E9A23B]/10 dark:bg-[#FBBF24]/15 text-[#E9A23B] dark:text-[#FBBF24] border border-[#E9A23B]/25 dark:border-[#FBBF24]/30',
    data:
      'bg-[#2F65F6]/10 dark:bg-[#5878C7]/15 text-[#2F65F6] dark:text-[#93C5FD] border border-[#2F65F6]/25 dark:border-[#5878C7]/30',
    critical:
      'bg-[#E35D5D]/10 dark:bg-[#F87171]/15 text-[#E35D5D] dark:text-[#F87171] border border-[#E35D5D]/25 dark:border-[#F87171]/30',
    confirmed:
      'bg-[#22A06B]/10 dark:bg-[#34D399]/15 text-[#22A06B] dark:text-[#34D399] border border-[#22A06B]/25 dark:border-[#34D399]/30',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-full ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
