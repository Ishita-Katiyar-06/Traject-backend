import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'elevated';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'surface',
  interactive = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`rounded-card bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] shadow-dashboard p-6 transition-all duration-200 ${
        interactive
          ? 'cursor-pointer hover:shadow-dashboard-hover hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] hover:border-slate-300/80 dark:hover:border-slate-700'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
