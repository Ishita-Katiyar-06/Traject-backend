import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'elevated' | 'contrast';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'surface',
  interactive = false,
  className = '',
  ...props
}) => {
  const variantClass =
    variant === 'contrast'
      ? 'bg-[#181D24] text-white shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#2B323D]'
      : variant === 'elevated'
      ? 'bg-white/95 dark:bg-[#1D232A] shadow-elevated border-slate-200/90 dark:border-[#37404B]'
      : 'bg-white/90 dark:bg-[#181C22]/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-slate-200/80 dark:border-[#2B323D]';

  return (
    <div
      className={`rounded-[22px] border p-6 transition-all duration-200 ${variantClass} ${
        interactive
          ? 'cursor-pointer hover:shadow-dashboard-hover hover:border-slate-300 dark:hover:border-slate-700'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
