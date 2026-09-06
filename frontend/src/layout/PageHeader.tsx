import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[rgba(228,233,245,0.85)] ${className}`}>
      <div>
        <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111727] tracking-tight leading-tight font-sans">
          {title}
        </h1>
        {description && (
          <p className="text-[#8591A5] mt-1.5 text-[14px] font-sans max-w-2xl leading-relaxed font-normal">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap mt-1 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
};
