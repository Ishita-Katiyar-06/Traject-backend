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
      className={`rounded-[26px] bg-white border border-[rgba(228,233,245,0.85)] shadow-dashboard p-6 transition-all duration-200 ${
        interactive
          ? 'cursor-pointer hover:shadow-dashboard-hover hover:bg-[#F8FAFD] hover:border-slate-300/80'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
