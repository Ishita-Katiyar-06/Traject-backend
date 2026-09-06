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
    sm: 'px-2 py-0.5 text-[11px] font-mono leading-tight',
    md: 'px-2.5 py-0.5 text-[12px] font-sans',
  };

  const variantClasses = {
    neutral: 'bg-[#F1F4F9] text-[#475569] border border-slate-200/60',
    signal: 'bg-[#FF6D5A]/12 text-[#FF6D5A] border border-[#FF6D5A]/25',
    data: 'bg-[#2F65F6]/10 text-[#2F65F6] border border-[#2F65F6]/25',
    critical: 'bg-rose-50 text-[#C0503E] border border-rose-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded-full ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
